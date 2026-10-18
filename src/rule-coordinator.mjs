import { compileNewsRules, NEWS_BASE } from './news-rules.mjs';

const clone = value => structuredClone(value);
export function createRuleCoordinator(native) {
  const owners = ['protection', 'news'];
  const records = { protection: { dynamic: [], session: [] }, news: { dynamic: [], session: [] } };
  const maps = { dynamic: new Map(), session: new Map() };
  let queue = Promise.resolve();
  const key = (owner, kind) => `combined:dnr:${owner}:${kind}`;
  const area = (owner, kind) => owner === 'protection' && kind === 'dynamic' ? native.storage.local : native.storage.session;
  function entries(owner, kind, next = records[owner]) {
    const base = owner === 'news' ? NEWS_BASE : 0;
    const rows = owner === 'news' ? (kind === 'session' ? compileNewsRules(next.dynamic, next.session) : [])
      : next[kind].map(rule => ({ rule, originalId: rule.id, originalKind: kind }));
    if (rows.length >= NEWS_BASE) throw new Error('Rule namespace capacity exceeded.');
    return rows.map((row, index) => ({ ...row, actual: { ...row.rule, id: base + index + 1 } }));
  }
  async function install(owner, kind, next = records[owner]) {
    const apiKind = kind[0].toUpperCase() + kind.slice(1);
    const existing = await native.declarativeNetRequest[`get${apiKind}Rules`]();
    const belongs = id => owner === 'news' ? id > NEWS_BASE && id < 2 * NEWS_BASE : id > 0 && id < NEWS_BASE;
    const rows = entries(owner, kind, next);
    await native.declarativeNetRequest[`update${apiKind}Rules`]({
      removeRuleIds: existing.filter(rule => belongs(rule.id)).map(rule => rule.id), addRules: rows.map(row => row.actual),
    });
    for (const [id, value] of maps[kind]) if (value.owner === owner) maps[kind].delete(id);
    for (const row of rows) maps[kind].set(row.actual.id, { owner, id: row.originalId, kind: row.originalKind });
  }
  const ready = (async () => {
    for (const owner of owners) for (const kind of ['dynamic', 'session']) {
      const data = await area(owner, kind).get(key(owner, kind));
      records[owner][kind] = data[key(owner, kind)] ?? [];
    }
    await install('protection', 'dynamic');
    await install('protection', 'session');
    await install('news', 'session');
  })();
  function serial(task) {
    const result = queue.catch(() => {}).then(() => ready).then(task);
    queue = result.catch(() => {});
    return result;
  }
  async function status() {
    await native.storage.local.set({ 'combined:ruleStatus': {
      protectionDynamic: records.protection.dynamic.length, protectionSession: records.protection.session.length,
      newsSourceRules: records.news.dynamic.length, newsInstalledRules: entries('news', 'session').length,
      guardedNewsTabs: records.news.session.length, updated: new Date().toISOString(),
    } });
  }
  function update(owner, kind, changes) {
    return serial(async () => {
      const remove = new Set(changes.removeRuleIds ?? []);
      const pending = new Map(records[owner][kind].filter(rule => !remove.has(rule.id)).map(rule => [rule.id, rule]));
      for (const rule of changes.addRules ?? []) {
        if (!Number.isInteger(rule.id) || rule.id <= 0 || pending.has(rule.id)) throw new Error('Invalid or duplicate rule ID.');
        if (owner === 'news' && kind === 'session' && (rule.action.type !== 'allow' || !rule.condition.tabIds?.length))
          throw new Error('Unrecognized publisher tab guard.');
        pending.set(rule.id, clone(rule));
      }
      const next = { ...records[owner], [kind]: [...pending.values()].sort((a, b) => a.id - b.id) };
      const storage = area(owner, kind);
      // Persist the intent first. A suspended worker replays it at its next start.
      await storage.set({ [key(owner, kind)]: next[kind] });
      try { await install(owner, owner === 'news' ? 'session' : kind, next); }
      catch (error) { await storage.set({ [key(owner, kind)]: records[owner][kind] }); throw error; }
      records[owner] = next;
      // A diagnostics write must never turn an already-applied update into an error.
      status().catch(error => console.error('Combined diagnostics:', error));
    });
  }
  function translate(owner, rule) {
    const kind = rule.rulesetId === '_dynamic' ? 'dynamic' : rule.rulesetId === '_session' ? 'session' : null;
    if (!kind) return owner === 'protection' ? rule : null;
    const record = maps[kind].get(rule.ruleId);
    return record?.owner === owner ? { ...rule, ruleId: record.id, rulesetId: '_' + record.kind } : null;
  }
  function chromeFor(owner) {
    if (!owners.includes(owner)) throw new Error('Unknown rule owner.');
    let callbackError;
    function finish(promise, callback) {
      if (!callback) return promise;
      promise.then(value => callback(value), error => {
        callbackError = { message: error.message };
        try { callback(); } finally { callbackError = undefined; }
      });
    }
    const runtime = new Proxy(native.runtime, { get(target, name) {
      if (name === 'lastError' && callbackError) return callbackError;
      const value = Reflect.get(target, name);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const debugListeners = new Map();
    const debug = native.declarativeNetRequest.onRuleMatchedDebug && {
      addListener(listener) {
        if (debugListeners.has(listener)) return;
        const wrapped = info => { const rule = translate(owner, info.rule); if (rule) listener({ ...info, rule }); };
        debugListeners.set(listener, wrapped); native.declarativeNetRequest.onRuleMatchedDebug.addListener(wrapped);
      },
      removeListener(listener) { const wrapped = debugListeners.get(listener); if (wrapped) native.declarativeNetRequest.onRuleMatchedDebug.removeListener(wrapped); debugListeners.delete(listener); },
      hasListener(listener) { return debugListeners.has(listener); },
    };
    const dnr = new Proxy(native.declarativeNetRequest, { get(target, name) {
      if (name === 'onRuleMatchedDebug') return debug;
      if (['getDynamicRules', 'getSessionRules'].includes(name)) {
        const kind = name === 'getDynamicRules' ? 'dynamic' : 'session';
        return callback => finish(serial(() => clone(records[owner][kind])), callback);
      }
      if (['updateDynamicRules', 'updateSessionRules'].includes(name)) {
        const kind = name === 'updateDynamicRules' ? 'dynamic' : 'session';
        return (changes, callback) => finish(update(owner, kind, changes), callback);
      }
      if (name === 'getMatchedRules' || name === 'testMatchOutcome') return (request, callback) => finish((async () => {
        await ready;
        const result = await target[name](request);
        if (result.rulesMatchedInfo) result.rulesMatchedInfo = result.rulesMatchedInfo.flatMap(info => {
          const rule = translate(owner, info.rule); return rule ? [{ ...info, rule }] : [];
        });
        if (result.matchedRules) result.matchedRules = result.matchedRules.map(rule => translate(owner, rule)).filter(Boolean);
        return result;
      })(), callback);
      if (owner === 'protection' && ['MAX_NUMBER_OF_SESSION_RULES', 'MAX_NUMBER_OF_UNSAFE_SESSION_RULES', 'MAX_NUMBER_OF_REGEX_RULES'].includes(name)) {
        const reserve = name === 'MAX_NUMBER_OF_REGEX_RULES' ? 600 : 1800;
        return Math.max(0, Number(target[name]) - reserve);
      }
      const value = Reflect.get(target, name);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    return new Proxy(native, { get(target, name) {
      if (name === 'declarativeNetRequest') return dnr;
      if (name === 'runtime') return runtime;
      const value = Reflect.get(target, name);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  return { chromeFor, ready };
}
