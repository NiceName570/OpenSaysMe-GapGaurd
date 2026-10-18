import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuleCoordinator } from '../src/rule-coordinator.mjs';
import { outsidePrefixes, compileNewsRules, NEWS_BASE, NEWS_PRIORITY } from '../src/news-rules.mjs';
import { createMasterSwitch } from '../src/master-switch.mjs';
import { pausableNewsApi } from '../src/pause-news.mjs';

const rule = (id, filter = 'ads.test') => ({ id, priority: 1, action: { type: 'block' }, condition: { urlFilter: filter, resourceTypes: ['script'] } });
function fakeBrowser() {
  function storage() {
    const data = {};
    return {
      async get(keys) { if (keys == null) return structuredClone(data); return Object.fromEntries([keys].flat().filter(key => key in data).map(key => [key, structuredClone(data[key])])); },
      async set(values) { Object.assign(data, structuredClone(values)); },
    };
  }
  const values = { dynamic: [], session: [], static: ['ruleset_1002'], mutations: 0 };
  const runtimeListeners = new Set();
  const requestListeners = new Set();
  const listeners = new Set();
  const api = {
    MAX_NUMBER_OF_SESSION_RULES: 5000, MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000, MAX_NUMBER_OF_REGEX_RULES: 1000,
    onRuleMatchedDebug: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    async getEnabledRulesets() { return [...values.static]; },
    async updateEnabledRulesets({ disableRulesetIds = [], enableRulesetIds = [] }) { values.static = [...new Set(values.static.filter(id => !disableRulesetIds.includes(id)).concat(enableRulesetIds))]; },
  };
  let rejectNext = false;
  for (const kind of ['dynamic', 'session']) {
    const cap = kind[0].toUpperCase() + kind.slice(1);
    api[`get${cap}Rules`] = async () => structuredClone(values[kind]);
    api[`update${cap}Rules`] = async ({ removeRuleIds = [], addRules = [] }) => {
      if (rejectNext) { rejectNext = false; throw new Error('Browser rejected rules'); }
      const remove = new Set(removeRuleIds);
      const next = values[kind].filter(item => !remove.has(item.id)).concat(structuredClone(addRules));
      assert.equal(new Set(next.map(item => item.id)).size, next.length, 'native IDs must be unique');
      values[kind] = next;
    };
  }
  return {
    chrome: {
      runtime: { id: 'test-extension', lastError: undefined, getURL: path => 'chrome-extension://test-extension/' + path,
        onMessage: { addListener: fn => runtimeListeners.add(fn), removeListener: fn => runtimeListeners.delete(fn) } },
      storage: { local: storage(), session: storage() }, declarativeNetRequest: api,
      action: { async setBadgeText() {}, async setIcon() {} },
      tabs: { async query() { return []; }, async sendMessage() {}, async update() { values.mutations++; }, async reload() { values.mutations++; } },
      scripting: { async executeScript() { values.mutations++; return []; }, async insertCSS() { values.mutations++; } },
      cookies: { async remove() { values.mutations++; return null; } },
      webRequest: { onCompleted: { addListener: fn => requestListeners.add(fn), removeListener: fn => requestListeners.delete(fn) } },
    },
    values, reject: () => { rejectNext = true; }, emit: info => listeners.forEach(fn => fn(info)),
    request: info => requestListeners.forEach(fn => fn(info)),
  };
}

test('refreshing or clearing either module preserves the other module rules, even with identical original IDs', async () => {
  const browser = fakeBrowser();
  const coordinator = createRuleCoordinator(browser.chrome);
  await coordinator.ready;
  const protection = coordinator.chromeFor('protection').declarativeNetRequest;
  const news = coordinator.chromeFor('news').declarativeNetRequest;
  await protection.updateDynamicRules({ addRules: [rule(1)] });
  await protection.updateSessionRules({ addRules: [rule(1, 'session.test')] });
  await news.updateDynamicRules({ addRules: [rule(1, 'publisher.test')] });
  assert.equal((await protection.getDynamicRules())[0].id, 1);
  assert.equal((await news.getDynamicRules())[0].condition.urlFilter, 'publisher.test');
  await protection.updateSessionRules({ removeRuleIds: (await protection.getSessionRules()).map(item => item.id) });
  assert.equal(browser.values.session.length, 1);
  assert.ok(browser.values.session[0].id > NEWS_BASE);
  await news.updateDynamicRules({ removeRuleIds: [1], addRules: [rule(2, 'new-publisher.test')] });
  assert.equal(browser.values.dynamic.length, 1);
  assert.equal((await protection.getDynamicRules())[0].condition.urlFilter, 'ads.test');
  await news.updateDynamicRules({ removeRuleIds: [2] });
  assert.equal(browser.values.session.length, 0);
  assert.equal(browser.values.dynamic.length, 1);
});

test('publisher allow exceptions become News conditions rather than global protection exceptions', () => {
  const rules = [
    { id: 1, priority: 100, action: { type: 'allow' }, condition: { requestDomains: ['excluded.test'], resourceTypes: ['script'] } },
    { id: 2, priority: 100, action: { type: 'allow' }, condition: { initiatorDomains: ['excluded.test'], resourceTypes: ['script'] } },
    rule(3),
  ];
  const emitted = compileNewsRules(rules);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].rule.action.type, 'block');
  assert.ok(emitted[0].rule.condition.excludedRequestDomains.includes('excluded.test'));
  assert.ok(emitted[0].rule.condition.excludedInitiatorDomains.includes('excluded.test'));
  assert.equal(emitted[0].rule.priority, NEWS_PRIORITY + 1);
});

test('a publisher tab guard only limits publisher rules, and removing it restores them', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome); await coordinator.ready;
  const protection = coordinator.chromeFor('protection').declarativeNetRequest;
  const news = coordinator.chromeFor('news').declarativeNetRequest;
  await protection.updateSessionRules({ addRules: [rule(55)] });
  await news.updateDynamicRules({ addRules: [rule(55)] });
  await news.updateSessionRules({ addRules: [{ id: 1000009, priority: 200, action: { type: 'allow' }, condition: { tabIds: [9], resourceTypes: ['script'] } }] });
  const publisher = browser.values.session.find(item => item.id > NEWS_BASE);
  assert.deepEqual(publisher.condition.excludedTabIds, [9]);
  assert.equal(browser.values.session.find(item => item.id < NEWS_BASE).condition.excludedTabIds, undefined);
  assert.ok(browser.values.session.every(item => item.action.type !== 'allow'));
  await news.updateSessionRules({ removeRuleIds: [1000009] });
  assert.equal(browser.values.session.find(item => item.id > NEWS_BASE).condition.excludedTabIds, undefined);
});

test('document exclusions use RE2-compatible positive expressions without lookaround', () => {
  const source = outsidePrefixes(['news/terminal/', 'watch']);
  const regex = new RegExp(source);
  assert.equal(source.includes('(?='), false); assert.equal(source.includes('(?!'), false);
  for (const url of ['https://publisher.test/', 'https://publisher.test/news/', 'https://publisher.test/news/term', 'https://publisher.test/article', 'https://publisher.test/wat']) assert.ok(regex.test(url), url);
  for (const url of ['https://publisher.test/news/terminal/secret', 'https://publisher.test/watch', 'https://publisher.test/watch/video']) assert.equal(regex.test(url), false, url);
});

test('failed browser updates preserve the previous virtual rules and persisted state', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome); await coordinator.ready;
  const api = coordinator.chromeFor('protection').declarativeNetRequest;
  await api.updateDynamicRules({ addRules: [rule(15)] });
  browser.reject();
  await assert.rejects(api.updateDynamicRules({ removeRuleIds: [15], addRules: [rule(16)] }), /Browser rejected/);
  assert.equal((await api.getDynamicRules())[0].id, 15);
  const restarted = createRuleCoordinator(browser.chrome); await restarted.ready;
  assert.equal((await restarted.chromeFor('protection').declarativeNetRequest.getDynamicRules())[0].id, 15);
});

test('callback API callers receive runtime.lastError on a rejected update', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome); await coordinator.ready;
  const scoped = coordinator.chromeFor('protection'); browser.reject();
  await new Promise(resolve => scoped.declarativeNetRequest.updateDynamicRules({ addRules: [rule(1)] }, () => {
    assert.match(scoped.runtime.lastError.message, /Browser rejected/); resolve();
  }));
  assert.equal(scoped.runtime.lastError, undefined);
});

test('diagnostic events expose original IDs and never leak the other module matches', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome); await coordinator.ready;
  const protection = coordinator.chromeFor('protection').declarativeNetRequest;
  const news = coordinator.chromeFor('news').declarativeNetRequest;
  await protection.updateDynamicRules({ addRules: [rule(987654321)] });
  await news.updateDynamicRules({ addRules: [rule(987654321)] });
  const seenProtection = [], seenNews = [];
  protection.onRuleMatchedDebug.addListener(info => seenProtection.push(info.rule));
  news.onRuleMatchedDebug.addListener(info => seenNews.push(info.rule));
  browser.emit({ rule: { ruleId: browser.values.dynamic[0].id, rulesetId: '_dynamic' } });
  browser.emit({ rule: { ruleId: browser.values.session[0].id, rulesetId: '_session' } });
  assert.deepEqual(seenProtection, [{ ruleId: 987654321, rulesetId: '_dynamic' }]);
  assert.deepEqual(seenNews, [{ ruleId: 987654321, rulesetId: '_dynamic' }]);
});

test('one power switch pauses static, dynamic, and publisher rules, then restores saved preferences', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome);
  const master = createMasterSwitch(browser.chrome, coordinator); await master.ready;
  const protection = coordinator.chromeFor('protection').declarativeNetRequest;
  const news = coordinator.chromeFor('news').declarativeNetRequest;
  await protection.updateDynamicRules({ addRules: [rule(10)] });
  await protection.updateSessionRules({ addRules: [rule(20)] });
  await news.updateDynamicRules({ addRules: [rule(30)] });
  await master.setEnabled(false);
  assert.equal(master.state().enabled, false);
  assert.deepEqual(browser.values.static, []);
  assert.deepEqual(browser.values.dynamic, []);
  assert.deepEqual(browser.values.session, []);
  assert.equal((await protection.getDynamicRules())[0].id, 10);
  // Updates from either component while paused must not turn any native rules on.
  await news.updateDynamicRules({ removeRuleIds: [30], addRules: [rule(31)] });
  await protection.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1002'], enableRulesetIds: ['ruleset_1001'] });
  assert.deepEqual(browser.values.static, []); assert.deepEqual(browser.values.session, []);
  await master.setEnabled(true);
  assert.deepEqual(browser.values.static, ['ruleset_1001']);
  assert.equal(browser.values.dynamic.length, 1); assert.equal(browser.values.session.length, 2);
  assert.equal((await news.getDynamicRules())[0].id, 31);
});

test('saved Off survives a worker restart and a later On restores the desired ruleset', async () => {
  const browser = fakeBrowser(); const first = createRuleCoordinator(browser.chrome);
  const power = createMasterSwitch(browser.chrome, first); await power.ready;
  await first.chromeFor('protection').declarativeNetRequest.updateDynamicRules({ addRules: [rule(77)] });
  await power.setEnabled(false);
  const restarted = createRuleCoordinator(browser.chrome);
  const nextPower = createMasterSwitch(browser.chrome, restarted); await nextPower.ready;
  assert.equal(nextPower.isEnabled(), false); assert.deepEqual(browser.values.dynamic, []); assert.deepEqual(browser.values.static, []);
  await nextPower.setEnabled(true);
  assert.equal(browser.values.dynamic.length, 1); assert.deepEqual(browser.values.static, ['ruleset_1002']);
});

test('Off suppresses queued publisher injections, cookie changes, navigation, and event callbacks', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome);
  const master = createMasterSwitch(browser.chrome, coordinator); await master.ready;
  const news = pausableNewsApi(coordinator.chromeFor('news'), master);
  let completed = 0;
  news.webRequest.onCompleted.addListener(() => completed++);
  browser.request({}); assert.equal(completed, 1);
  await master.setEnabled(false);
  browser.request({}); assert.equal(completed, 1);
  await news.cookies.remove({}); await news.scripting.executeScript({}); await news.tabs.update(1, {});
  assert.equal(browser.values.mutations, 0);
  await assert.rejects(master.fetch('https://example.invalid/'), /is off/);
  await master.setEnabled(true);
  await news.cookies.remove({}); browser.request({});
  assert.equal(browser.values.mutations, 1); assert.equal(completed, 2);
});

test('a failed module pause restores the previous master position and network rules', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome);
  const master = createMasterSwitch(browser.chrome, coordinator); await master.ready;
  await coordinator.chromeFor('protection').declarativeNetRequest.updateDynamicRules({ addRules: [rule(5)] });
  master.register('test module', async value => { if (!value) throw new Error('Pause failed'); });
  await assert.rejects(master.setEnabled(false), /Pause failed/);
  assert.equal(master.isEnabled(), true); assert.equal(browser.values.dynamic.length, 1);
  assert.equal((await browser.chrome.storage.local.get('combined:enabled'))['combined:enabled'], true);
});

test('Off aborts an in-flight research lookup', async () => {
  const browser = fakeBrowser(); const coordinator = createRuleCoordinator(browser.chrome);
  const master = createMasterSwitch(browser.chrome, coordinator); await master.ready;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Lookup aborted')), { once: true }));
  try {
    const rejected = assert.rejects(master.fetch('https://example.invalid/'), /Lookup aborted/);
    await new Promise(setImmediate);
    await master.setEnabled(false);
    await rejected;
  } finally { globalThis.fetch = originalFetch; }
});
