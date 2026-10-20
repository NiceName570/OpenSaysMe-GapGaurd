import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSources, dnrKey } from '../scripts/merge.mjs';
import { cleanSettings, isAllowed } from '../src/settings.js';
import { dedupeDnr } from '../scripts/dedupe-dnr.mjs';
import { SourceMap } from '../node_modules/@adguard/dnr-converter/dist/ruleset/source-map.js';
import { MetadataRules } from '../node_modules/@adguard/dnr-converter/dist/ruleset/metadata-rule.js';
import { parseCompactRuleset, MetadataRuleset } from '@adguard/dnr-converter';
import { preprocess } from '../scripts/preprocess.mjs';

test('merging removes duplicates without merging different resource scopes or exceptions', () => {
  const result = mergeSources([
    { name: 'a', content: '! header\n||ads.test^$script\n@@||ads.test/good^\nnews.test##.banner' },
    { name: 'b', content: '||ads.test^$script\n||ads.test^$image\nnews.test##.banner\n@@||ads.test/good^' },
  ]);
  assert.equal(result.unique, 4);
  assert.equal(result.rows[1].duplicates, 3);
  assert.match(result.content, /\$image/);
  assert.match(result.content, /@@/);
});

test('network keys ignore JSON property order but preserve important semantics', () => {
  const a = { id: 1, action: { type: 'block' }, condition: { urlFilter: '||ad.test^', resourceTypes: ['script'] } };
  assert.equal(dnrKey(a), dnrKey({ ...a, id: 55, priority: 1, condition: { resourceTypes: ['script'], urlFilter: '||ad.test^' } }));
  assert.notEqual(dnrKey(a), dnrKey({ ...a, action: { type: 'allow' } }));
});

test('site exceptions respect hostname boundaries', () => {
  assert.equal(isAllowed('www.example.com', ['example.com']), true);
  assert.equal(isAllowed('notexample.com', ['example.com']), false);
  assert.equal(isAllowed('example.com.attacker.test', ['example.com']), false);
  assert.throws(() => cleanSettings({ allowlist: ['https://example.com/path'] }));
});

test('settings import rejects malformed and executable custom rules', () => {
  assert.throws(() => cleanSettings({ enabled: 'false' }));
  assert.throws(() => cleanSettings({ rules: ['example.com#%#alert(1)'] }));
  assert.throws(() => cleanSettings({ rules: 'not an array' }));
  const value = cleanSettings({ allowlist: ['EXAMPLE.COM.', 'example.com'], rules: ['a##.ad', 'a##.ad'] });
  assert.deepEqual(value.allowlist, ['example.com']);
  assert.deepEqual(value.rules, ['a##.ad']);
});

test('DNR deduplication remaps all source entries to surviving IDs', () => {
  const sources = new SourceMap([
    { declarativeRuleId: 2, sourceRuleIndex: 10, filterId: 1001 },
    { declarativeRuleId: 3, sourceRuleIndex: 20, filterId: 1001 },
  ]);
  const result = dedupeDnr([
    ...MetadataRules.create({ metadata: {}, lazyMetadata: { sourceMapRaw: sources.serialize() } }, new Set([2, 3]), false),
    { id: 2, action: { type: 'block' }, condition: { urlFilter: '||ad.test^' } },
    { id: 3, action: { type: 'block' }, condition: { urlFilter: '||ad.test^' } },
  ]);
  assert.equal(result.removed, 1);
  assert.equal(result.rules.length, 2);
  const compact = parseCompactRuleset('ruleset_1001', result.rules);
  const remapped = SourceMap.deserializeSources(compact.lazyMetadata.sourceMapRaw);
  assert.deepEqual(remapped.map(row => row.declarativeRuleId), [2, 2]);
  assert.equal(compact.metadata.safeRulesCount, 1);
});

test('runtime metadata uses bounded chunks and rejects the previous object format', () => {
  const meta = new MetadataRuleset({ ruleset_1001: 'abc' }, { text: 'x'.repeat(100000) });
  const serialized = meta.serialize(false);
  const rules = JSON.parse(serialized);
  assert.ok(rules.length > 1);
  for (const rule of rules) assert.ok(Buffer.byteLength(JSON.stringify(rule.metadata)) <= 65536);
  assert.equal(MetadataRuleset.deserialize(serialized).getChecksum('ruleset_1001'), 'abc');
  assert.throws(() => MetadataRuleset.deserialize(JSON.stringify([{ id: 1, condition: { urlFilter: 'dummy.rule.adguard.com' }, metadata: { checksums: {} } }])), /metadata\.chunk/);
});

test('filter includes and browser conditions preserve only applicable branches', async () => {
  const result = await preprocess('!#if env_chromium\na\n!#if cap_html_filtering\nb\n!#else\nc\n!#endif\n!#else\nd\n!#endif\n!#include test.txt', async name => name === 'test.txt' ? 'e' : 'wrong');
  assert.equal(result, 'a\nc\ne');
  await assert.rejects(() => preprocess('!#if unknown_feature\na\n!#endif'));
  await assert.rejects(() => preprocess('!#if env_chromium\na'));
});
