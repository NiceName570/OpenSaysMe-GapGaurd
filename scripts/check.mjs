import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const publisherCheck = spawnSync(process.execPath, ['scripts/check-publishers.mjs'], { cwd: root, stdio: 'inherit' });
assert.equal(publisherCheck.status, 0, 'Publisher generator checks failed.');
const output = path.join(root, 'extension');
const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'OpenSaysMe + GapGuard');
assert.ok(!manifest.permissions.includes('webRequestBlocking'));
assert.equal(manifest.declarative_net_request.rule_resources.filter(rule => rule.enabled).length, 1);
const files = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap(row => [...(row.js ?? []), ...(row.css ?? [])]),
  ...manifest.declarative_net_request.rule_resources.map(row => row.path)];
for (const file of files) await fs.access(path.join(output, file));
async function walk(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
let htmlCount = 0;
for (const file of await walk(output)) {
  if (file.endsWith('.html')) {
    htmlCount++;
    const html = await fs.readFile(file, 'utf8');
    for (const [, source] of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)) {
      if (/^(?:https?:|data:|#)/.test(source)) continue;
      await fs.access(path.resolve(path.dirname(file), source));
    }
  }
}
for (const file of ['service-worker.js', 'rule-coordinator.js', 'news-research-background.js', 'protection-background.js', 'popup.js', 'settings.js', 'content-gate.js', 'master-page.js', 'contentScript.js', ...manifest.content_scripts.flatMap(group => group.js)]) {
  const checked = spawnSync(process.execPath, ['--check', path.join(output, file)], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `${file}: ${checked.stderr}`);
}
const protectedBackground = await fs.readFile(path.join(output, 'protection-background.js'), 'utf8');
assert.ok(protectedBackground.includes('chromeFor("protection")'));
assert.ok(protectedBackground.includes('CombinedMaster.register("protection"'));
const newsBackground = await fs.readFile(path.join(output, 'news-research-background.js'), 'utf8');
assert.ok(newsBackground.includes('CombinedNewsChrome'));
assert.ok(newsBackground.includes('CombinedMaster.fetch'));
const popupHtml = await fs.readFile(path.join(output, 'popup.html'), 'utf8');
assert.equal([...popupHtml.matchAll(/type="checkbox"/g)].length, 1, 'Popup must have one master switch.');
assert.ok(manifest.content_scripts.every(group => group.js[0] === 'content-gate.js'), 'Every declarative script must follow global power.');
const protectionCss = await fs.readFile(path.join(output, 'protection-style.css'), 'utf8');
assert.ok(protectionCss.includes('shared/theme.css'));
assert.ok(!protectionCss.includes('#0c151e'));
const protectionCheck = spawnSync(process.execPath, ['scripts/check.mjs'], { cwd: path.join(root, 'components/gapguard'), stdio: 'inherit' });
assert.equal(protectionCheck.status, 0, 'Upstream protection reader/rule checks failed.');
const sourceManifest = JSON.parse(await fs.readFile(path.join(root, 'components/gapguard/extension/manifest.json'), 'utf8'));
for (const row of sourceManifest.declarative_net_request.rule_resources) {
  assert.ok((await fs.readFile(path.join(output, row.path))).equals(await fs.readFile(path.join(root, 'components/gapguard/extension', row.path))), 'Combined build changed static metadata or checksums.');
}
console.log(`PASS: combined manifest, ${htmlCount} HTML pages, worker syntax, module API scoping, and unchanged protection rules.`);
console.log('No browser was opened and no live website tests were run.');
