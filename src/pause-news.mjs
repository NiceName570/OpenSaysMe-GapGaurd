// Upstream News/Research callbacks remain registered, but cannot act while off.
export function pausableNewsApi(scoped, master) {
  function done(value, callback) { if (callback) { callback(value); return; } return Promise.resolve(value); }
  const listeners = new WeakMap();
  function event(original, type) {
    if (!original?.addListener) return original;
    return {
      addListener(listener, ...options) {
        const wrapped = (...args) => {
          if (master.isEnabled()) return listener(...args);
          if (type === 'message') {
            const [request, sender, reply] = args;
            if (request?.channel === 'combined' || request?.channel === 'gapguard' || request?.handlerName) return false;
            if (request?.mode === 'getoptions') {
              let domain = ''; try { domain = new URL(sender.url ?? sender.tab?.url).hostname; } catch {}
              reply({ mode: 'options', disabled: true, options: { disabledOn: [domain] } });
            } else if (request?.mode === 'unpaywall') reply({ mode: 'unpaywallResponse', disabled: true, data: { is_oa: false } });
            else if (request?.mode || request?.request || request?.osm) reply({ disabled: true });
          }
          return false;
        };
        listeners.set(listener, wrapped); original.addListener(wrapped, ...options);
      },
      removeListener(listener) { const wrapped = listeners.get(listener); if (wrapped) original.removeListener(wrapped); listeners.delete(listener); },
      hasListener(listener) { return listeners.has(listener); },
    };
  }
  const cache = new Map();
  return new Proxy(scoped, { get(target, name) {
    if (!['runtime', 'webRequest', 'webNavigation', 'tabs', 'scripting', 'cookies', 'contextMenus', 'action'].includes(name)) return target[name];
    if (!cache.has(name)) cache.set(name, new Proxy(target[name], { get(namespace, method) {
      const value = namespace[method];
      if ((name === 'runtime' && method === 'onMessage') || (['webRequest', 'webNavigation', 'tabs', 'contextMenus'].includes(name) && String(method).startsWith('on')))
        return event(value, name === 'runtime' ? 'message' : 'event');
      const mutation = name === 'scripting' && ['executeScript', 'insertCSS'].includes(method)
        || name === 'cookies' && method === 'remove' || name === 'tabs' && ['update', 'reload'].includes(method)
        || name === 'action' && ['setIcon', 'setBadgeText', 'setTitle'].includes(method);
      if (mutation) return (...args) => {
        if (master.isEnabled()) return value.apply(namespace, args);
        return done(name === 'scripting' ? [] : null, typeof args.at(-1) === 'function' ? args.at(-1) : undefined);
      };
      return typeof value === 'function' ? value.bind(namespace) : value;
    } }));
    return cache.get(name);
  } });
}
