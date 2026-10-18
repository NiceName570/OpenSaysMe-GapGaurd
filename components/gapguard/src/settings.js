export const DEFAULTS = Object.freeze({ enabled: true, supplemental: true, youtubeRecovery: false, allowlist: [], rules: [] });

export function cleanSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Settings must be an object.');
  const result = { ...DEFAULTS };
  for (const key of ['enabled', 'supplemental', 'youtubeRecovery']) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') throw new Error(`${key} must be true or false.`);
      result[key] = value[key];
    }
  }
  if (value.allowlist !== undefined && !Array.isArray(value.allowlist)) throw new Error('Exceptions must be a list of hostnames.');
  result.allowlist = [...new Set((value.allowlist ?? []).map(host => {
    if (typeof host !== 'string') throw new Error('Invalid hostname.');
    const normalized = host.trim().toLowerCase().replace(/\.$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
      throw new Error(`Use a hostname without a URL or path: ${host}`);
    }
    return normalized;
  }))];
  if (result.allowlist.length > 1000) throw new Error('Too many site exceptions.');
  if (value.rules !== undefined && (!Array.isArray(value.rules) || value.rules.some(rule => typeof rule !== 'string'))) throw new Error('Rules must be a list of strings.');
  result.rules = [...new Set((value.rules ?? []).map(rule => rule.trim()).filter(Boolean))];
  if (result.rules.length > 5000 || result.rules.join('\n').length > 500000) throw new Error('Too many custom rules.');
  // Custom JavaScript is not part of the settings import surface.
  if (result.rules.some(rule => /#(?:@)?%#/.test(rule))) throw new Error('JavaScript injection rules are not supported as custom rules.');
  return result;
}

export function isAllowed(host, allowlist) {
  return allowlist.some(domain => host === domain || host.endsWith(`.${domain}`));
}
