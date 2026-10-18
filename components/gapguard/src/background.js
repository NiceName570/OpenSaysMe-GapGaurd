import browser from 'webextension-polyfill';
import { TsWebExtension, MESSAGE_HANDLER_NAME, FilterList } from '@adguard/tswebextension/mv3';
import { localScriptRules } from '../sources/local-script-rules.js';
import { DEFAULTS, cleanSettings, isAllowed } from './settings.js';

TsWebExtension.setLocalScriptRules(localScriptRules);
const engine = new TsWebExtension('/web-accessible-resources/redirects');
const engineHandler = engine.getMessageHandler();
let settings = { ...DEFAULTS };
let status = { state: 'starting', error: null };
let queue = Promise.resolve();
const stats = new Map();
const recent = [];

function configuration(value) {
  const list = new FilterList(value.rules.join('\n'));
  return {
    filtersPath: 'filters', rulesetsPath: 'filters/declarative',
    staticFiltersIds: [value.supplemental ? 1002 : 1001], customFilters: [],
    allowlist: value.allowlist, trustedDomains: [],
    userrules: { content: list.getContent(), conversionData: list.getConversionData() },
    declarativeLogEnabled: false, logLevel: 'error',
    settings: {
      assistantUrl: 'adguard-assistant.js', gpcScriptUrl: 'unused.js', hideDocumentReferrerScriptUrl: 'unused.js',
      filteringEnabled: value.enabled, allowlistEnabled: true, allowlistInverted: false,
      collectStats: false, debugScriptlets: false, stealthModeEnabled: false,
      stealth: { selfDestructFirstPartyCookies: false, selfDestructFirstPartyCookiesTime: 0,
        selfDestructThirdPartyCookies: false, selfDestructThirdPartyCookiesTime: 0,
        hideReferrer: false, hideSearchQueries: false, blockChromeClientData: false,
        sendDoNotTrack: false, blockWebRTC: false },
    },
  };
}

function validateResult(result) {
  const errors = [
    ...(result.staticFiltersStatus?.errors ?? []),
    ...(result.dynamicRules?.errors ?? []), ...(result.dynamicRules?.limitations ?? []),
  ];
  if (errors.length) throw new Error(errors.map(error => error.message ?? String(error)).join('; '));
}

function badge() {
  return browser.action.setBadgeText({ text: status.state === 'error' ? '!' : settings.enabled ? '' : 'OFF' });
}

const ready = (async () => {
  try {
    settings = cleanSettings((await browser.storage.local.get('gapguardSettings')).gapguardSettings ?? DEFAULTS);
    await engine.initStorage();
    validateResult(await engine.start(configuration(settings)));
    status = { state: 'ready', error: null };
  } catch (error) { status = { state: 'error', error: error.message }; console.error('GapGuard startup:', error); }
  await badge();
})();

async function apply(next) {
  const previous = settings;
  try {
    validateResult(await engine.configure(configuration(next)));
    await browser.storage.local.set({ gapguardSettings: next });
    settings = next;
    status = { state: 'ready', error: null };
  } catch (error) {
    try { validateResult(await engine.configure(configuration(previous))); }
    catch (rollback) { status = { state: 'error', error: `Update failed: ${error.message}; restore failed: ${rollback.message}` }; await badge(); throw new Error(status.error); }
    status = { state: 'ready', error: null };
    throw error;
  }
  await badge();
}

function serialize(task) {
  const pending = queue.then(task);
  queue = pending.catch(() => {});
  return pending;
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.handlerName === MESSAGE_HANDLER_NAME) return ready.then(() => engineHandler(message, sender));
  if (message?.channel !== 'gapguard') return undefined;
  // Content scripts can ask only whether the local recovery tool should run.
  if (message.type === 'recovery-status') {
    return ready.then(() => {
      const url = new URL(sender.url ?? 'https://invalid.local');
      return { enabled: status.state === 'ready' && settings.enabled && settings.youtubeRecovery && !isAllowed(url.hostname, settings.allowlist) };
    });
  }
  if (!sender.url?.startsWith(browser.runtime.getURL(''))) return Promise.reject(new Error('Extension pages only.'));
  return ready.then(async () => {
    if (message.type === 'state') {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      let host = null;
      try { const url = new URL(tab?.url); if (/^https?:$/.test(url.protocol)) host = url.hostname; } catch {}
      return { settings, status, host, tabId: tab?.id, count: stats.get(tab?.id) ?? 0, recent: recent.slice(-30).reverse() };
    }
    if (message.type === 'save') return serialize(async () => { await apply(cleanSettings(message.settings)); return { ok: true }; });
    if (message.type === 'set-toggle') return serialize(async () => {
      if (!['enabled', 'supplemental', 'youtubeRecovery'].includes(message.key)) throw new Error('Unknown protection switch.');
      if (typeof message.value !== 'boolean') throw new Error('Protection switches must be true or false.');
      await apply(cleanSettings({ ...settings, [message.key]: message.value }));
      return { settings, status };
    });
    if (message.type === 'toggle-site') return serialize(async () => {
      const host = cleanSettings({ allowlist: [message.host] }).allowlist[0];
      const matching = settings.allowlist.filter(domain => host === domain || host.endsWith(`.${domain}`));
      const allowlist = matching.length ? settings.allowlist.filter(domain => !matching.includes(domain)) : [...settings.allowlist, host];
      await apply(cleanSettings({ ...settings, allowlist }));
      return { ok: true };
    });
    if (message.type === 'picker') {
      if (status.state !== 'ready' || !settings.enabled) throw new Error('Enable protection before picking an element.');
      const tab = await browser.tabs.get(message.tabId);
      if (!/^https?:\/\//.test(tab.url ?? '')) throw new Error('Open a regular website first.');
      await engine.openAssistant(message.tabId);
      return { ok: true };
    }
    if (message.type === 'clear-log') { recent.length = 0; stats.clear(); return { ok: true }; }
    throw new Error('Unknown request.');
  });
});

engine.onAssistantCreateRule.subscribe(rule => {
  serialize(async () => { await ready; await apply(cleanSettings({ ...settings, rules: [...settings.rules, rule] })); }).catch(console.error);
});

// Exact DNR match events, bounded in memory. Strip query strings and fragments.
browser.declarativeNetRequest.onRuleMatchedDebug?.addListener(info => {
  if (info.rule.rulesetId === '_dynamic' && info.rule.ruleId < 0) return;
  const tabId = info.request.tabId;
  let url;
  try { const parsed = new URL(info.request.url); url = `${parsed.origin}${parsed.pathname}`; } catch { return; }
  recent.push({ time: new Date().toISOString(), url, ruleset: info.rule.rulesetId, ruleId: info.rule.ruleId });
  if (recent.length > 100) recent.shift();
  stats.set(tabId, (stats.get(tabId) ?? 0) + 1);
});
browser.tabs.onRemoved.addListener(tabId => stats.delete(tabId));
browser.webNavigation.onCommitted.addListener(details => { if (details.frameId === 0) stats.delete(details.tabId); });
