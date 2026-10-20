import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { DEFAULTS } from '../src/settings.js';

const bundle = await build({ entryPoints: ['src/options.js'], bundle: true, write: false, format: 'iife', platform: 'browser' });

async function settingsPage() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      checked: false, disabled: false, value: '', textContent: '',
      classList: { toggle() {} }, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; },
    });
    return elements.get(id);
  }
  let saved = structuredClone({ ...DEFAULTS, allowlist: ['keep.test'], rules: ['keep.test##.banner'] });
  let failNext = false;
  const requests = [];
  const status = { state: 'ready', error: null };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    document: { getElementById: element, querySelectorAll: () => [...elements.values()] },
    chrome: { runtime: {
      getManifest: () => ({ version: 'test' }),
      async sendMessage(request) {
        requests.push(request);
        if (request.type === 'state') return structuredClone({ settings: saved, status, recent: [] });
        if (request.type === 'set-toggle') {
          if (failNext) { failNext = false; throw new Error('Could not apply protection.'); }
          saved = { ...saved, [request.key]: request.value };
          return structuredClone({ settings: saved, status });
        }
        throw new Error(`Unexpected request: ${request.type}`);
      },
    } },
    fetch: async () => ({ json: async () => ({ builtAt: 'test', profiles: {} }) }),
  });
  await new Promise(setImmediate);
  return { element, requests, saved: () => saved, failNext: () => { failNext = true; } };
}

test('settings switches save immediately without submitting or replacing unfinished text edits', async () => {
  const page = await settingsPage();
  page.element('allowlist').value = 'https://unfinished.test/path';
  page.element('rules').value = 'unfinished rule draft';
  for (const [key, value] of [['enabled', false], ['supplemental', false], ['youtubeRecovery', true]]) {
    page.element(key).checked = value;
    await page.element(key).listeners.change();
    assert.equal(page.saved()[key], value);
    assert.equal(page.element(key).disabled, false);
  }
  assert.deepEqual(page.saved().allowlist, ['keep.test']);
  assert.deepEqual(page.saved().rules, ['keep.test##.banner']);
  assert.equal(page.element('allowlist').value, 'https://unfinished.test/path');
  assert.equal(page.element('rules').value, 'unfinished rule draft');
  assert.equal(page.requests.filter(request => request.type === 'set-toggle').length, 3);
  assert.match(page.element('message').textContent, /Saved automatically/);
});

test('a failed switch save restores the saved checkbox state and keeps the draft', async () => {
  const page = await settingsPage();
  page.element('rules').value = 'keep this draft';
  page.failNext();
  page.element('enabled').checked = false;
  await page.element('enabled').listeners.change();
  assert.equal(page.saved().enabled, true);
  assert.equal(page.element('enabled').checked, true);
  assert.equal(page.element('enabled').disabled, false);
  assert.equal(page.element('rules').value, 'keep this draft');
  assert.match(page.element('message').textContent, /Could not apply protection/);
});
