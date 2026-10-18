import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build, transform } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const osm = path.join(root, 'components/opensaysme');
const gap = path.join(root, 'components/gapguard');
const output = path.join(root, 'extension');
const project = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
await fs.mkdir(output, { recursive: true });
await fs.mkdir(path.join(root, 'reports'), { recursive: true });
// The upstream build uses a project-local node_modules path for internal readers.
try { await fs.access(path.join(gap, 'node_modules')); }
catch { await fs.symlink(path.join(root, 'node_modules'), path.join(gap, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir'); }
let hasProtection = true;
try { await fs.access(path.join(gap, 'extension/manifest.json')); } catch { hasProtection = false; }
if (!hasProtection || process.argv.includes('--rebuild-protection')) {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: gap, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Protection build failed.');
}
async function walk(directory) {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(file));
    else if (item.isFile()) result.push(file);
  }
  return result;
}
const sourceFiles = [];
for (const file of await walk(osm)) {
  const relative = path.relative(osm, file);
  const target = path.join(output, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(file, target);
  sourceFiles.push({ component: 'opensaysme', path: relative.replaceAll('\\', '/'), sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') });
}
await fs.mkdir(path.join(output, 'licenses'), { recursive: true });
await fs.copyFile(path.join(osm, 'LICENSE'), path.join(output, 'licenses/opensaysme-LICENSE'));
const rename = {
  'background.js': 'protection-background.js', 'popup.html': 'protection-popup.html',
  'options.html': 'protection-options.html', 'popup.js': 'protection-popup.js',
  'options.js': 'protection-options.js', 'style.css': 'protection-style.css',
  'THIRD_PARTY_NOTICES.md': 'licenses/gapguard-THIRD_PARTY_NOTICES.md',
};
for (const file of await walk(path.join(gap, 'extension'))) {
  const relative = path.relative(path.join(gap, 'extension'), file).replaceAll('\\', '/');
  if (relative === 'manifest.json') continue;
  const target = path.join(output, rename[relative] ?? relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (relative === 'popup.html' || relative === 'options.html') {
    let html = await fs.readFile(file, 'utf8');
    html = html.replace('href="style.css"', 'href="protection-style.css"')
      .replace('src="popup.js"', 'src="protection-popup.js"').replace('src="options.js"', 'src="protection-options.js"');
    if (relative === 'popup.html') html = html.replace('<span>Protection</span>', '<span>Ad &amp; tracker protection</span>');
    await fs.writeFile(target, html);
  } else await fs.copyFile(file, target);
}
await fs.copyFile(path.join(gap, 'LICENSE'), path.join(root, 'LICENSE'));
await fs.copyFile(path.join(gap, 'LICENSE'), path.join(output, 'LICENSE'));

await build({ entryPoints: [path.join(root, 'src/coordinator-entry.js')], outfile: path.join(output, 'rule-coordinator.js'), bundle: true,
  format: 'iife', platform: 'browser', target: 'chrome121', minify: false });
let protectionSource = await fs.readFile(path.join(gap, 'src/background.js'), 'utf8');
protectionSource = protectionSource.replaceAll('\r\n', '\n');
protectionSource = 'let __applyingMasterPower=false;\n' + protectionSource
  .replace('    settings = cleanSettings((await browser.storage.local.get(\'gapguardSettings\')).gapguardSettings ?? DEFAULTS);',
    '    await globalThis.CombinedMaster.ready;\n    settings = cleanSettings({...((await browser.storage.local.get("gapguardSettings")).gapguardSettings ?? DEFAULTS),enabled:globalThis.CombinedMaster.isEnabled()});')
  .replace('async function apply(next) {', 'async function apply(next) {\n  if(!__applyingMasterPower) next=cleanSettings({...next,enabled:globalThis.CombinedMaster.isEnabled()});');
protectionSource += '\nglobalThis.CombinedMaster.register("protection",async enabled=>{await ready;await serialize(async()=>{__applyingMasterPower=true;try{await apply(cleanSettings({...settings,enabled}));}finally{__applyingMasterPower=false;}});});\n';
await build({ stdin: { contents: protectionSource, resolveDir: path.join(gap, 'src'), sourcefile: 'combined-protection-background.js' }, outfile: path.join(output, 'protection-background.js'), bundle: true,
  format: 'iife', platform: 'browser', target: 'chrome121', minify: true, legalComments: 'eof',
  define: { chrome: '__combinedChrome', 'globalThis.chrome': '__combinedChrome', 'globalThis.browser': 'undefined' },
  banner: { js: '(()=>{const __combinedChrome=globalThis.CombinedRuntime.chromeFor("protection");' }, footer: { js: '})();' } });

const order = ['shared/storage.js', 'shared/mv3-compat.js', 'shared/bpc-mv3.js', 'sites.js', 'background.js', 'js/background.js'];
const newsParts = [];
for (const relative of order) newsParts.push(`\n// Upstream file: ${relative}\n` + await fs.readFile(path.join(osm, relative), 'utf8'));
// The originals share worker globals. Keep those globals together inside one scoped module.
await fs.writeFile(path.join(output, 'news-research-background.js'),
  '(()=>{const chrome=globalThis.CombinedNewsChrome;const browser=undefined;const fetch=(...args)=>globalThis.CombinedMaster.fetch(...args);\n' + newsParts.join('\n;\n') + '\n})();\n');
await fs.writeFile(path.join(output, 'service-worker.js'),
  'importScripts("rule-coordinator.js", "news-research-background.js", "protection-background.js");\n');
for (const filename of ['popup.html', 'popup.js', 'settings.html', 'settings.js', 'combined.css', 'content-gate.js', 'master-page.js', 'protection-style.css', 'content-theme.css'])
  await fs.copyFile(path.join(root, 'src', filename), path.join(output, filename));
let popup = await fs.readFile(path.join(output, 'protection-popup.js'), 'utf8');
popup = popup.replace(/chrome\.runtime\.openOptionsPage\(\)/g, 'chrome.tabs.create({url:chrome.runtime.getURL("protection-options.html")})');
popup = popup.replace(/window\.close\(\)/g, 'window.top.close()');
await fs.writeFile(path.join(output, 'protection-popup.js'), popup);
// Old popup entry points use the same single master switch, not module switches.
await fs.copyFile(path.join(root, 'src/popup.html'), path.join(output, 'protection-popup.html'));
await fs.copyFile(path.join(root, 'src/popup.js'), path.join(output, 'protection-popup.js'));

let protectionOptions = await fs.readFile(path.join(output, 'protection-options.html'), 'utf8');
protectionOptions = protectionOptions.replace(/<section><h2>Protection<\/h2>[\s\S]*?<\/section>/,
  '<section><h2>Protection</h2><p>Protection follows the OpenSaysMe toolbar switch. Edit rules and site exceptions below.</p><div hidden><input id="enabled" type="checkbox"><input id="supplemental" type="checkbox"><input id="youtubeRecovery" type="checkbox"></div></section>')
  .replace('Protection switches save automatically. Use Save settings for edited rules, site exceptions, or imported settings.', 'The toolbar switch controls the whole program. Save settings applies your rules, site exceptions, or imported preferences.')
  .replace('GapGuard settings', 'OpenSaysMe protection settings').replace('<h1>GapGuard</h1>', '<h1>OpenSaysMe</h1>')
  .replace('src="icons/icon-48.png"', 'src="images/opensaysme-48.png"').replace('id="state" class="pill"', 'id="state" class="pill" hidden');
await fs.writeFile(path.join(output, 'protection-options.html'), protectionOptions);

// All extension settings pages share the OpenSaysMe appearance and power status.
for (const file of await walk(output)) if (file.endsWith('.html') && !['popup.html', 'protection-popup.html'].includes(path.basename(file))) {
  const relativePrefix = path.relative(path.dirname(file), output).replaceAll('\\', '/');
  const prefix = relativePrefix ? relativePrefix + '/' : '';
  let html = await fs.readFile(file, 'utf8');
  if (file === path.join(output, 'options/popup.html')) html = html.replace('id="site_switch_span"', 'id="site_switch_span" hidden');
  if (!html.includes('shared/theme.css')) html = html.replace('</head>', `<link rel="stylesheet" href="${prefix}shared/theme.css"></head>`);
  html = html.replace('</body>', `<script src="${prefix}master-page.js"></script></body>`);
  await fs.writeFile(file, html);
}

const newsManifest = JSON.parse(await fs.readFile(path.join(osm, 'manifest.json'), 'utf8'));
const protectionManifest = JSON.parse(await fs.readFile(path.join(gap, 'extension/manifest.json'), 'utf8'));
async function gatedSource(source, guardTimers) {
  if (guardTimers) source = (await transform(source, { target: 'chrome121', define: {
    setTimeout: '__osmTimers.setTimeout', 'window.setTimeout': '__osmTimers.setTimeout',
    setInterval: '__osmTimers.setInterval', 'window.setInterval': '__osmTimers.setInterval',
    requestAnimationFrame: '__osmTimers.requestAnimationFrame', 'window.requestAnimationFrame': '__osmTimers.requestAnimationFrame',
    MutationObserver: '__osmTimers.MutationObserver',
  } })).code;
  return '(()=>{const gate=globalThis.__openSaysMePower;gate.ready.then(()=>{if(!gate.enabled)return;const __osmTimers=gate.timers;\n' + source + '\n}).catch(()=>{});})();\n';
}
const contentScripts = [];
for (const [index, group] of [...protectionManifest.content_scripts, ...newsManifest.content_scripts].entries()) {
  const source = (await Promise.all(group.js.map(file => fs.readFile(path.join(output, file), 'utf8')))).join('\n;\n');
  const gatedFile = `gated-content-${index}.js`;
  await fs.writeFile(path.join(output, gatedFile), await gatedSource(source, !group.js.includes('content-script.js')));
  contentScripts.push({ ...group, js: ['content-gate.js', gatedFile], css: [...(group.css ?? []), 'content-theme.css'] });
}
await fs.writeFile(path.join(output, 'contentScript.js'), await gatedSource(await fs.readFile(path.join(osm, 'contentScript.js'), 'utf8'), true));
const manifest = {
  ...newsManifest, name: 'OpenSaysMe + GapGuard', short_name: 'OpenSaysMe+', version: project.version,
  description: 'Ad and tracker protection, publisher access tools, and open-access research discovery in one personal extension.',
  minimum_chrome_version: '121',
  permissions: [...new Set([...newsManifest.permissions, ...protectionManifest.permissions])].filter(value => value !== 'declarativeNetRequestWithHostAccess'),
  host_permissions: [...new Set([...newsManifest.host_permissions, ...protectionManifest.host_permissions])],
  action: { ...newsManifest.action, default_title: 'OpenSaysMe', default_popup: 'popup.html' },
  background: { service_worker: 'service-worker.js' }, options_ui: { page: 'settings.html', open_in_tab: true },
  content_scripts: contentScripts,
  declarative_net_request: protectionManifest.declarative_net_request,
  web_accessible_resources: [...newsManifest.web_accessible_resources, ...protectionManifest.web_accessible_resources],
};
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const notes = await fs.readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
await fs.writeFile(path.join(output, 'THIRD_PARTY_NOTICES.md'), notes);
const report = { builtAt: new Date().toISOString(), version: project.version, protectionVersion: protectionManifest.version,
  newsResearchVersion: newsManifest.version, sources: sourceFiles, notes: [
    'Original projects are preserved in their existing directories.',
    'Each background receives a scoped rule API; IDs and deletion are isolated.',
    'News exceptions become news-only conditions and guarded tabs, not global allow rules.',
    'Publisher network rules occupy a reserved session-rule namespace and rebuild on worker startup.',
    'Publisher redirects and header changes have explicit higher priority on their publisher scopes.',
    'General live-site and streaming efficacy remains manual testing; no universal access guarantee.',
  ] };
await fs.writeFile(path.join(root, 'reports/combined-build.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Built extension/. Load this folder as OpenSaysMe + GapGuard.');
