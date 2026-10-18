// Compare complete rule text. Never collapse rules merely because domains match:
// exceptions, resource types, and first/third-party scope change their meaning.
export function mergeSources(sources) {
  const seen = new Set();
  const rows = [];
  const lines = [];
  for (const source of sources) {
    let duplicates = 0;
    let added = 0;
    for (const raw of source.content.split(/\r?\n/)) {
      const rule = raw.trim();
      if (!rule || rule.startsWith('!') || rule.startsWith('[')) continue;
      if (seen.has(rule)) { duplicates++; continue; }
      seen.add(rule);
      lines.push(rule);
      added++;
    }
    rows.push({ name: source.name, url: source.url, sha256: source.sha256, added, duplicates });
  }
  return { content: lines.join('\n'), rows, unique: lines.length };
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export function dnrKey(rule) {
  return JSON.stringify(stable({ priority: rule.priority ?? 1, action: rule.action, condition: rule.condition }));
}
