import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { Filter, FilterConverter, MetadataRuleset, DNR_CONVERTER_VERSION } from '@adguard/dnr-converter';
import { FilterList } from '@adguard/tsurlfilter';
import { re2Validator } from '../node_modules/@adguard/dnr-converter/dist/re2-regexp/re2-validator.js';
import { mergeSources, dnrKey } from './merge.mjs';
import { dedupeDnr } from './dedupe-dnr.mjs';
import { preprocess } from './preprocess.mjs';

const root = process.cwd();
const project = JSON.parse(await fs.readFile('package.json', 'utf8'));
const out = path.join(root, 'extension');
const cache = path.join(root, 'sources');
const packaged = path.join(root, 'node_modules/@adguard/dnr-rulesets/dist/filters/edge-mv3');
const sha = text => createHash('sha256').update(text).digest('hex');
const { RE2 } = createRequire(import.meta.url)('@adguard/re2-wasm');
re2Validator.setValidator(async pattern => { new RE2(pattern, 'u', 1979); return true; });
const redirects = JSON.parse(await fs.readFile('node_modules/@adguard/scriptlets/dist/redirects.json', 'utf8'));
const knownRedirects = new Set(redirects.flatMap(resource => [resource.title, ...(resource.aliases ?? [])]));
await fs.mkdir(out, { recursive: true });
await fs.mkdir(cache, { recursive: true });
await fs.mkdir(path.join(root, 'reports'), { recursive: true });

const core = [];
for (const id of [2, 3, 18, 19, 21]) {
  const raw = JSON.parse(await fs.readFile(path.join(packaged, `declarative/ruleset_${id}/ruleset_${id}.json`), 'utf8'));
  const content = raw[0].metadata.filterContent;
  if (!content) throw new Error(`Missing original filter ${id}`);
  const name = content.match(/! Title: (.+)/)?.[1].trim() ?? `AdGuard ${id}`;
  core.push({ name, content, sha256: sha(content), url: 'https://github.com/AdguardTeam/AdGuardFilters' });
  await fs.writeFile(path.join(cache, `adguard-${id}.txt`), content);
}

const extra = [];
const includedAssets = [];
async function loadRemote(filename, url, depth = 0) {
  if (depth > 8) throw new Error('Too many nested filter includes.');
  const file = path.join(cache, filename);
  let content;
  try { if (process.argv.includes('--refresh')) throw new Error('Refresh'); content = await fs.readFile(file, 'utf8'); }
  catch {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    content = await response.text();
    if (!content.includes('!') || /<html/i.test(content)) throw new Error(`Not a filter list: ${url}`);
    await fs.writeFile(file, content);
  }
  includedAssets.push({ url, file: filename, sha256: sha(content) });
  return preprocess(content, async relative => {
    if (!/^[a-zA-Z0-9_.-]+\.txt$/.test(relative)) throw new Error(`Unsupported filter include: ${relative}`);
    const target = new URL(relative, url);
    if (target.origin !== new URL(url).origin) throw new Error('Cross-origin filter include');
    return loadRemote(`include-${relative}`, target.href, depth + 1);
  });
}
for (const [name, filename, url] of [
  ['EasyPrivacy', 'easyprivacy.txt', 'https://easylist.to/easylist/easyprivacy.txt'],
  ['Fanboy Annoyance', 'fanboy-annoyance.txt', 'https://easylist.to/easylist/fanboy-annoyance.txt'],
  ['uBlock filters', 'ublock-filters.txt', 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt'],
  ['uBlock privacy', 'ublock-privacy.txt', 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt'],
  ['uBlock quick fixes', 'ublock-quick-fixes.txt', 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt'],
  ['uBlock unbreak', 'ublock-unbreak.txt', 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt'],
]) {
  const content = await loadRemote(filename, url);
  extra.push({ name, content, url, sha256: sha(content) });
}

const report = { builtAt: new Date().toISOString(), version: project.version, compilerVersion: DNR_CONVERTER_VERSION, includedAssets, profiles: {}, notes: [
  'Exact source-rule duplicates are removed. Different scopes and exception rules are preserved.',
  'Supplemental rules are coverage candidates, not demonstrated improvements until manual testing.',
  'Semantic overlap across different patterns is not claimed to be eliminated.',
  'Ad Remover proprietary code and subscription checks were not copied.',
  'OSKA uses AdGuard lists already represented in the core.',
] };
const meta = new MetadataRuleset();
const resources = [];
for (const [id, name, source] of [[1001, 'Core', core], [1002, 'Combined', [...core, ...extra]]]) {
  console.log(`Merging ${name}…`);
  const merged = mergeSources(source);
  const unsupportedRedirects = [];
  const unsupportedCompatibility = [];
  const compatible = merged.content.split('\n').filter(rule => {
    // This uBlock signature is normalized with arguments dropped by the engine.
    // Keep neither the altered scriptlet nor its paired exception: a widened
    // response-pruning operation would not preserve the original behavior.
    if (rule.includes('json-prune-fetch-response') && rule.includes('/feed/rcmd')) {
      unsupportedCompatibility.push(rule); return false;
    }
    const redirect = rule.match(/(?:\$|,)redirect(?:-rule)?=([^,]+)/)?.[1];
    if (redirect && !knownRedirects.has(redirect)) { unsupportedRedirects.push(rule); return false; }
    return true;
  }).join('\n');
  // Upstream normalization translates compatible third-party syntax, preserves
  // exception scopes, and removes unsupported syntactic constructs.
  const list = new FilterList(compatible);
  const content = `! Title: GapGuard ${name}\n! Version: ${project.version}\n${list.getContent()}\n`;
  const [result] = await new FilterConverter().convert([new Filter(id, content)], {
    withSourceMap: true, resourcesPath: '/web-accessible-resources/redirects',
    maxNumberOfRules: 290000, maxNumberOfRegexpRules: 1000,
  });
  // Known MV3-incompatible modifiers are reported rather than silently called supported.
  if (result.limitations.length) throw new Error(`${name}: rule limit reached: ${result.limitations.map(String).join('; ')}`);
  const compact = await result.ruleset.serializeCompact([], false);
  const deduped = dedupeDnr(JSON.parse(compact));
  const rules = deduped.rules;
  const serialized = JSON.stringify(rules);
  const seen = new Set();
  for (const rule of deduped.networkRules) {
    const key = dnrKey(rule);
    if (seen.has(key)) throw new Error(`${name}: converter emitted a duplicate DNR rule; review before packaging.`);
    seen.add(key);
  }
  const folder = `filters/declarative/ruleset_${id}`;
  await fs.mkdir(path.join(out, folder), { recursive: true });
  await fs.writeFile(path.join(out, folder, `ruleset_${id}.json`), serialized);
  meta.setChecksum(`ruleset_${id}`, sha(serialized));
  resources.push({ id: `ruleset_${id}`, enabled: id === 1002, path: `${folder}/ruleset_${id}.json` });
  report.profiles[name.toLowerCase()] = {
    id, uniqueSourceRules: merged.unique, networkRules: deduped.networkRules.length,
    metadataRules: deduped.metadataRulesCount,
    regexRules: deduped.networkRules.filter(rule => rule.condition.regexFilter).length,
    sourceLists: merged.rows, conversionErrors: result.errors.length, unsupportedRedirects, unsupportedCompatibility,
    duplicateNetworkRulesRemoved: deduped.removed,
  };
  await fs.writeFile(path.join(root, `reports/${name.toLowerCase()}-conversion-errors.json`), JSON.stringify(result.errors.map(error => ({ name: error.name, message: error.message })), null, 2));
  console.log(`${name}: ${merged.unique} unique source rules, ${deduped.networkRules.length} DNR rules, ${deduped.metadataRulesCount} metadata chunks, ${result.errors.length} conversion notes.`);
}

await fs.mkdir(path.join(out, 'filters/declarative/ruleset_0'), { recursive: true });
await fs.writeFile(path.join(out, 'filters/declarative/ruleset_0/ruleset_0.json'), meta.serialize(false));
await fs.copyFile(path.join(packaged, 'local_script_rules.js'), path.join(cache, 'local-script-rules.js'));
await fs.cp('node_modules/@adguard/scriptlets/dist/redirect-files', path.join(out, 'web-accessible-resources/redirects'), { recursive: true });
await fs.cp('ui', out, { recursive: true });
await fs.cp('assets/icons', path.join(out, 'icons'), { recursive: true });
const manifest = JSON.parse(await fs.readFile('src/manifest.json', 'utf8'));
manifest.version = project.version;
manifest.declarative_net_request = { rule_resources: resources };
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
await build({ entryPoints: {
  background: 'src/background.js', 'content-script': 'src/content-script.js',
  'adguard-assistant': 'src/assistant.js', 'youtube-recovery': 'src/youtube-recovery.js',
  popup: 'src/popup.js', options: 'src/options.js',
}, outdir: out, bundle: true, format: 'iife', platform: 'browser', target: 'chrome121', minify: true,
  legalComments: 'eof', sourcemap: false,
});
await fs.copyFile('node_modules/@adguard/tswebextension/LICENSE', path.join(out, 'LICENSE.txt'));
await fs.copyFile('node_modules/@adguard/tswebextension/LICENSE', 'LICENSE');
await fs.copyFile('THIRD_PARTY_NOTICES.md', path.join(out, 'THIRD_PARTY_NOTICES.md'));
await fs.mkdir(path.join(out, 'licenses'), { recursive: true });
for (const name of ['tswebextension', 'tsurlfilter', 'dnr-converter', 'scriptlets', 'assistant', 'extended-css', 'agtree', 'css-tokenizer', 'logger', 'text-encoding', 're2-wasm']) {
  for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md']) {
    try { await fs.copyFile(`node_modules/@adguard/${name}/${filename}`, path.join(out, `licenses/adguard-${name}-${filename}`)); } catch(error) { if (error.code !== 'ENOENT') throw error; }
  }
}
for (const filename of ['LICENSE', 'LICENSE.txt']) {
  try { await fs.copyFile(`node_modules/webextension-polyfill/${filename}`, path.join(out, `licenses/webextension-polyfill-${filename}`)); } catch(error) { if (error.code !== 'ENOENT') throw error; }
}
await fs.writeFile('reports/build-report.json', JSON.stringify(report, null, 2));
await fs.writeFile(path.join(out, 'build-report.json'), JSON.stringify(report, null, 2));
console.log('Built extension/. Load that folder as an unpacked Edge extension.');
