import { createRuleCoordinator } from './rule-coordinator.mjs';
import { createMasterSwitch } from './master-switch.mjs';
import { pausableNewsApi } from './pause-news.mjs';
globalThis.CombinedRuntime = createRuleCoordinator(chrome);
globalThis.CombinedMaster = createMasterSwitch(chrome, globalThis.CombinedRuntime);
globalThis.CombinedNewsChrome = pausableNewsApi(globalThis.CombinedRuntime.chromeFor('news'), globalThis.CombinedMaster);
globalThis.CombinedRuntime.ready.catch(error => {
  console.error('Combined rule coordinator:', error);
  chrome.storage.local.set({ 'combined:startupError': error.message }).catch(console.error);
});
globalThis.CombinedRuntime.ready.then(() => chrome.storage.local.remove('combined:startupError')).catch(() => {});
