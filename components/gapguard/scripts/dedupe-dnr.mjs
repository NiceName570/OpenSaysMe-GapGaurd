import { isSafeRule } from '@adguard/dnr-converter';
// Pinned converter 2.0.0. Its source-map codec is internal, so checks verify the
// round trip explicitly whenever the dependency is updated.
import { SourceMap } from '../node_modules/@adguard/dnr-converter/dist/ruleset/source-map.js';
import { MetadataRules } from '../node_modules/@adguard/dnr-converter/dist/ruleset/metadata-rule.js';
import { dnrKey } from './merge.mjs';

export function dedupeDnr(rules) {
  const { payload, declarativeRules } = MetadataRules.read('build', rules);
  const retained = [];
  const keys = new Map();
  const aliases = new Map();
  for (const rule of declarativeRules) {
    const key = dnrKey(rule);
    if (keys.has(key)) aliases.set(rule.id, keys.get(key));
    else { keys.set(key, rule.id); retained.push(rule); }
  }
  const metadata = payload;
  const sources = SourceMap.deserializeSources(metadata.lazyMetadata.sourceMapRaw);
  const seen = new Set();
  const remapped = sources.map(source => ({ ...source,
    declarativeRuleId: aliases.get(source.declarativeRuleId) ?? source.declarativeRuleId,
  })).filter(source => {
    const key = `${source.declarativeRuleId}:${source.sourceRuleIndex}:${source.filterId}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  metadata.lazyMetadata.sourceMapRaw = new SourceMap(remapped).serialize();
  metadata.metadata.safeRulesCount = retained.filter(isSafeRule).length;
  metadata.metadata.unsafeRulesCount = retained.length - metadata.metadata.safeRulesCount;
  metadata.metadata.regexpRulesCount = retained.filter(rule => rule.condition.regexFilter).length;
  const usedIds = new Set([...retained, ...(metadata.metadata.unsafeRules ?? [])].map(rule => rule.id));
  const chunks = MetadataRules.create(metadata, usedIds, false);
  return { rules: [...chunks, ...retained], networkRules: retained, metadataRulesCount: chunks.length, removed: aliases.size };
}
