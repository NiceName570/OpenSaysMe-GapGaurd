// Publisher exceptions must never become extension-wide ad-blocking exceptions.
export const NEWS_BASE = 1_000_000;
export const NEWS_PRIORITY = 2_000_000;
const documentExclusions = {
  'bloomberg.com': ['news/terminal/'], 'espn.com': ['watch'],
  'science.org': ['doi/'], 'statista.com': ['outlook/', 'study/'], 'quora.com': ['search?'],
};
const excludedHosts = ['cronicaglobal.elespanol.com', 'video.lastampa.it', 'video.repubblica.it'];
const unique = values => [...new Set(values)];
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function otherUrlCharacters(chars) {
  // Browser request URLs are ASCII-serialized. Positive ASCII ranges avoid the
  // large Unicode automata produced by repeated negated character classes.
  const excluded = new Set(chars.map(char => char.charCodeAt(0)));
  const ranges = [];
  const hex = number => '\\x' + number.toString(16).padStart(2, '0');
  for (let start = 32; start <= 126; start++) {
    if (excluded.has(start)) continue;
    let end = start;
    while (end < 126 && !excluded.has(end + 1)) end++;
    ranges.push(hex(start) + (end === start ? '' : '-' + hex(end)));
    start = end;
  }
  return '[' + ranges.join('') + ']';
}

export function outsidePrefixes(prefixes) {
  const root = { children: new Map() };
  for (const prefix of prefixes) {
    let node = root;
    for (const char of prefix) {
      if (!node.children.has(char)) node.children.set(char, { children: new Map() });
      node = node.children.get(char);
    }
    node.terminal = true;
  }
  function visit(node) {
    if (node.terminal) return null;
    const chars = [...node.children.keys()];
    if (!chars.length) return '.*';
    const alternatives = ['$', otherUrlCharacters(chars)];
    for (const [char, child] of node.children) {
      const tail = visit(child);
      if (tail !== null) alternatives.push(escape(char) + tail);
    }
    return '(?:' + alternatives.join('|') + ')';
  }
  return '^https?://[a-z0-9.:-]+/' + visit(root);
}

export function compileNewsRules(rules, guards = []) {
  const excludedRequests = unique(rules.filter(rule => rule.action.type === 'allow' && !rule.condition.regexFilter && !rule.condition.urlFilter)
    .flatMap(rule => rule.condition.requestDomains ?? []));
  const excludedInitiators = unique(rules.filter(rule => rule.action.type === 'allow' && !rule.condition.regexFilter && !rule.condition.urlFilter)
    .flatMap(rule => rule.condition.initiatorDomains ?? []));
  const excludedTabs = unique(guards.flatMap(rule => rule.condition.tabIds ?? []));
  const emitted = [];
  for (const rule of rules) {
    if (['allow', 'allowAllRequests'].includes(rule.action.type)) continue;
    const types = rule.condition.resourceTypes;
    if (!types?.length) throw new Error('Publisher rules must declare resource types.');
    const groups = [types.filter(type => type === 'main_frame'), types.filter(type => type !== 'main_frame')].filter(group => group.length);
    for (const group of groups) {
      const condition = structuredClone(rule.condition);
      condition.resourceTypes = group;
      condition.excludedRequestDomains = unique([...(condition.excludedRequestDomains ?? []), ...excludedRequests, ...excludedHosts]);
      if (!group.includes('main_frame')) condition.excludedInitiatorDomains = unique([...(condition.excludedInitiatorDomains ?? []), ...excludedInitiators]);
      if (excludedTabs.length) condition.excludedTabIds = unique([...(condition.excludedTabIds ?? []), ...excludedTabs]);
      const restricted = group.includes('main_frame') && condition.requestDomains?.find(domain => documentExclusions[domain]);
      if (restricted) {
        if (condition.regexFilter || condition.urlFilter) throw new Error(`Cannot safely combine publisher URL conditions for ${restricted}.`);
        condition.regexFilter = outsidePrefixes(documentExclusions[restricted]);
      }
      for (const key of ['excludedInitiatorDomains', 'excludedRequestDomains']) if (!condition[key]?.length) delete condition[key];
      emitted.push({ rule: { ...rule, priority: NEWS_PRIORITY + (rule.priority ?? 1), condition }, originalId: rule.id, originalKind: 'dynamic' });
    }
  }
  return emitted;
}
