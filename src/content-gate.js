(() => {
  if (globalThis.__openSaysMePower) return;
  const power = { enabled: false };
  const updatePage = () => document.documentElement?.setAttribute('data-osm-enabled', String(power.enabled));
  power.timers = {
    setTimeout(callback, delay, ...args) { return globalThis.setTimeout(() => { if (power.enabled) callback(...args); }, delay); },
    setInterval(callback, delay, ...args) { return globalThis.setInterval(() => { if (power.enabled) callback(...args); }, delay); },
    requestAnimationFrame(callback) { return globalThis.requestAnimationFrame(time => { if (power.enabled) callback(time); }); },
    MutationObserver: class extends MutationObserver { constructor(callback) { super((...args) => { if (power.enabled) callback(...args); }); } },
  };
  power.ready = chrome.runtime.sendMessage({ channel: 'combined', type: 'state' }).then(state => {
    power.enabled = state.enabled === true;
    updatePage();
    return power.enabled;
  }).catch(() => false);
  chrome.runtime.onMessage.addListener(message => {
    if (message?.channel === 'combined' && message.type === 'power-changed') { power.enabled = message.enabled === true; updatePage(); }
  });
  globalThis.__openSaysMePower = power;
  document.addEventListener('DOMContentLoaded', updatePage, { once: true });
})();
