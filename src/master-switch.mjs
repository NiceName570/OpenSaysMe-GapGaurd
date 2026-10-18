export function createMasterSwitch(native, coordinator) {
  let enabled = false;
  let problem = null;
  let queue = Promise.resolve();
  const hooks = new Map();
  const pendingFetches = new Set();
  const ready = native.storage.local.get('combined:enabled').then(data => { enabled = data['combined:enabled'] !== false; return coordinator.ready; });
  const state = () => ({ enabled, problem });
  function register(name, hook) {
    hooks.set(name, hook);
    ready.then(() => hook(enabled)).catch(error => { problem = `${name}: ${error.message}`; });
  }
  async function badge() {
    if (!native.action?.setBadgeText) return;
    await native.action.setBadgeText({ text: enabled ? '' : 'OFF' });
    if (native.action.setIcon) await native.action.setIcon({ path: { 19: `images/opensaysme${enabled ? '' : '-disabled'}-19.png`, 38: `images/opensaysme${enabled ? '' : '-disabled'}-38.png` } });
  }
  function setEnabled(value) {
    if (typeof value !== 'boolean') return Promise.reject(new Error('Power must be on or off.'));
    const result = queue.catch(() => {}).then(() => ready).then(async () => {
      const previous = enabled;
      problem = null;
      try {
        if (!value) {
          enabled = false;
          for (const controller of pendingFetches) controller.abort();
          await native.storage.local.set({ 'combined:enabled': false });
          await coordinator.setEnabled(false);
        }
        for (const hook of hooks.values()) await hook(value);
        if (value) { await coordinator.setEnabled(true); enabled = true; }
        await native.storage.local.set({ 'combined:enabled': enabled });
        await badge();
        const tabs = await native.tabs?.query({}) ?? [];
        await Promise.allSettled(tabs.filter(tab => tab.id >= 0 && /^https?:/.test(tab.url ?? '')).map(tab => native.tabs.sendMessage(tab.id, { channel: 'combined', type: 'power-changed', enabled })));
        return state();
      } catch (error) {
        problem = error.message;
        try {
          enabled = previous;
          for (const hook of hooks.values()) await hook(previous);
          await coordinator.setEnabled(previous);
          await native.storage.local.set({ 'combined:enabled': previous });
        } catch (rollback) {
          enabled = false;
          await coordinator.setEnabled(false).catch(() => {});
          await native.storage.local.set({ 'combined:enabled': false });
          problem += '; recovery: ' + rollback.message;
        }
        await badge().catch(() => {});
        throw new Error(problem);
      }
    });
    queue = result.catch(() => {});
    return result;
  }
  async function gatedFetch(input, options = {}) {
    await ready;
    if (!enabled) throw new Error('OpenSaysMe is off.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    pendingFetches.add(controller);
    try { return await globalThis.fetch(input, { ...options, signal: controller.signal }); }
    finally { pendingFetches.delete(controller); options.signal?.removeEventListener('abort', abort); }
  }
  native.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.channel !== 'combined') return false;
    let task;
    if (message.type === 'state') task = ready.then(state);
    else if (message.type === 'set-enabled' && sender.url?.startsWith(native.runtime.getURL(''))) task = setEnabled(message.enabled);
    else task = Promise.reject(new Error('Unsupported power request.'));
    task.then(reply).catch(error => reply({ ...state(), error: error.message }));
    return true;
  });
  ready.then(badge).catch(error => { problem = error.message; });
  return { ready, register, setEnabled, state, isEnabled: () => enabled, fetch: gatedFetch };
}
