import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { SourceMap } from '../node_modules/@adguard/dnr-converter/dist/ruleset/source-map.js';
import { dnrKey } from './merge.mjs';

const manifest = JSON.parse(await fs.readFile('extension/manifest.json', 'utf8'));
// Resolve the reader from the runtime engine, not merely from the build tool.
// This catches a valid compiler artifact that the actual browser engine cannot read.
const require = createRequire(import.meta.url);
const engineRequire = createRequire(require.resolve('@adguard/tswebextension/mv3'));
let runtimeEntry;
for (const base of engineRequire.resolve.paths('@adguard/dnr-converter')) {
  const directory = path.join(base, '@adguard/dnr-converter');
  try {
    const info = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    runtimeEntry = path.join(directory, info.exports?.['.']?.import ?? info.main);
    console.log(`Checking the engine's actual DNR reader: ${info.version}`);
    break;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.ok(runtimeEntry, 'Cannot resolve the runtime engine DNR reader');
const runtime = await import(pathToFileURL(runtimeEntry).href);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.declarative_net_request.rule_resources.filter(row => row.enabled).length, 1, 'Exactly one profile must be active');
const metadata = runtime.MetadataRuleset.deserialize(await fs.readFile('extension/filters/declarative/ruleset_0/ruleset_0.json', 'utf8'));
assert.throws(() => runtime.MetadataRuleset.deserialize(JSON.stringify([{ id: 1, action: { type: 'block' }, condition: { urlFilter: 'dummy.rule.adguard.com' }, metadata: { checksums: {} } }])), /metadata\.chunk/, 'Runtime must reject the legacy metadata format from the reported failure');
for (const resource of manifest.declarative_net_request.rule_resources) {
  const raw = await fs.readFile(path.join('extension', resource.path), 'utf8');
  assert.equal(metadata.getChecksum(resource.id), createHash('sha256').update(raw).digest('hex'));
  const rules = JSON.parse(raw);
  const compact = runtime.parseCompactRuleset(resource.id, rules);
  const filterId = Number(resource.id.replace('ruleset_', ''));
  const restored = runtime.RulesetWithSourceMap.fromCompact(resource.id, compact, [new runtime.Filter(filterId, compact.filterContent)]);
  assert.equal((await restored.getDeclarativeRules()).length, compact.declarativeRules.length);
  for (const chunk of rules.slice(0, compact.metadataRulesCount)) {
    assert.ok(Buffer.byteLength(JSON.stringify(chunk.metadata)) <= 65536, 'Metadata value exceeds browser bound');
  }
  const ids = new Set();
  const keys = new Set();
  for (const rule of rules) {
    assert.ok(Number.isInteger(rule.id) && rule.id > 0 && !ids.has(rule.id), `Invalid/duplicate ID ${rule.id}`);
    ids.add(rule.id);
    assert.ok(['block', 'allow', 'allowAllRequests', 'redirect', 'modifyHeaders', 'upgradeScheme'].includes(rule.action.type));
    if (rule.action.redirect?.extensionPath) await fs.access(path.join('extension', rule.action.redirect.extensionPath.replace(/^\//, '')));
  }
  for (const rule of compact.declarativeRules) {
    const key = dnrKey(rule);
    assert.ok(!keys.has(key), `Duplicate DNR action/condition in ${resource.id}`);
    keys.add(key);
  }
  assert.ok(rules.length <= 290000, 'Static rule budget exceeded (including metadata chunks)');
  assert.ok(compact.declarativeRules.filter(rule => rule.condition.regexFilter).length <= 1000, 'Regex budget exceeded');
  const networkIds = new Set(compact.declarativeRules.map(rule => rule.id));
  for (const source of SourceMap.deserializeSources(compact.lazyMetadata.sourceMapRaw)) {
    assert.ok(networkIds.has(source.declarativeRuleId), `Dangling source map ${source.declarativeRuleId}`);
  }
  const counts = compact.metadata;
  assert.equal(counts.safeRulesCount + counts.unsafeRulesCount, compact.declarativeRules.length);
  console.log(`${resource.id}: ${compact.declarativeRules.length} unique network rules; ${compact.metadataRulesCount} metadata chunks; actual engine reader, checksums and source maps valid.`);
}
for (const file of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
  ...manifest.content_scripts.flatMap(row => row.js), 'adguard-assistant.js', 'popup.js', 'options.js', 'style.css']) {
  await fs.access(path.join('extension', file));
}
console.log('Package structure and rule checks passed. Live Edge testing is assigned to the user.');
