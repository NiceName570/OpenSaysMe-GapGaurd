// Execute only the publisher-rule generator against in-memory browser APIs.
// No browser process or network requests are used.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { compileNewsRules } from '../src/news-rules.mjs';
const { RE2 } = createRequire(import.meta.url)('@adguard/re2-wasm');
const data = {};
const events = new Map();
function event(name) {
  if (!events.has(name)) events.set(name, { addListener() {}, removeListener() {}, hasListener() { return false; } });
  return events.get(name);
}
const area = {
  get(keys, callback) {
    const result = keys == null ? { ...data } : typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {};
    for (const key of typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(result)) if (key in data) result[key] = data[key];
    if (callback) { callback(result); return; } return Promise.resolve(result);
  },
  set(values, callback) { Object.assign(data, values); if (callback) { callback(); return; } return Promise.resolve(); },
  remove(keys, callback) { for (const key of [keys].flat()) delete data[key]; if (callback) { callback(); return; } return Promise.resolve(); },
};
let generated;
const dnr = {
  async isRegexSupported({ regex }) { try { new RE2(regex, 'u', 1979); return { isSupported: true }; } catch { return { isSupported: false, reason: 'regexUnsupported' }; } },
  async getDynamicRules() { return []; }, async updateDynamicRules({ addRules }) { generated = addRules; }, async updateSessionRules() {},
};
const namespaces = new Map();
const chrome = new Proxy({ storage: { local: area, onChanged: event('storage') }, declarativeNetRequest: dnr,
  runtime: { id: 'fixture', getManifest: () => ({ name: 'OpenSaysMe + GapGuard', version: '0.1.0' }), getURL: file => 'chrome-extension://fixture/' + file,
    onMessage: event('message'), onInstalled: event('installed'), lastError: undefined } }, {
  get(target, key) {
    if (key in target) return target[key];
    if (!namespaces.has(key)) namespaces.set(key, new Proxy({}, { get(object, name) {
      if (String(name).startsWith('on')) return event(key + '.' + name);
      return (...args) => { const callback = args.at(-1); if (typeof callback === 'function') callback([]); else return Promise.resolve([]); };
    } }));
    return namespaces.get(key);
  },
});
const files = ['shared/storage.js', 'shared/mv3-compat.js', 'shared/bpc-mv3.js', 'sites.js', 'background.js'];
const source = files.map(file => fs.readFileSync('components/opensaysme/' + file, 'utf8')).join('\n;\n') + '\nglobalThis.fixtureReady = osmBpcReady;';
const errors = [];
const context = { chrome, console: { log() {}, error: error => errors.push(String(error)) }, setTimeout: () => 0, clearTimeout() {}, URL, Map, Set, structuredClone,
  fetch: () => Promise.reject(new Error('Network disabled in publisher fixture')) };
vm.runInNewContext(source, context);
await context.fixtureReady;
assert.ok(generated.length > 500, 'Publisher defaults did not initialize.');
const compiled = compileNewsRules(generated);
for (const { rule } of compiled) {
  if (rule.condition.regexFilter) new RE2(rule.condition.regexFilter, 'u', 1979);
  assert.ok(!(rule.condition.regexFilter && rule.condition.urlFilter));
  assert.ok(!['allow', 'allowAllRequests'].includes(rule.action.type));
}
assert.deepEqual(errors, []);
const report = { sourceRules: generated.length, installedRules: compiled.length, regexRules: compiled.filter(row => row.rule.condition.regexFilter).length,
  unsafeRules: compiled.filter(row => ['modifyHeaders', 'redirect'].includes(row.rule.action.type)).length, nativeAllowRules: 0, liveNetworkRequests: 0 };
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/publisher-generation-check.json', JSON.stringify(report, null, 2) + '\n');
console.log('Publisher generator and RE2 checks passed: ' + JSON.stringify(report));
