import { createRuleCoordinator } from './rule-coordinator.mjs';
globalThis.CombinedRuntime = createRuleCoordinator(chrome);
globalThis.CombinedRuntime.ready.catch(error => {
  console.error('Combined rule coordinator:', error);
  chrome.storage.local.set({ 'combined:startupError': error.message }).catch(console.error);
});
globalThis.CombinedRuntime.ready.then(() => chrome.storage.local.remove('combined:startupError')).catch(() => {});
