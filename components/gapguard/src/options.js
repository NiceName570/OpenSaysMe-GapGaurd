import { $, send, message, showStatus, download } from './ui.js';
import { cleanSettings } from './settings.js';
let snapshot;
let buildInfo;
function fillToggles(settings) {
  for (const key of ['enabled', 'supplemental', 'youtubeRecovery']) $(key).checked = settings[key];
}
function fill(settings) {
  fillToggles(settings);
  $('allowlist').value = settings.allowlist.join('\n');
  $('rules').value = settings.rules.join('\n');
}
function form() {
  return cleanSettings({ enabled: $('enabled').checked, supplemental: $('supplemental').checked,
    youtubeRecovery: $('youtubeRecovery').checked,
    allowlist: $('allowlist').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean),
    rules: $('rules').value.split(/\r?\n/),
  });
}
function log() {
  $('log').textContent = snapshot.recent.map(row => `${row.time}\n${row.ruleset} / ${row.ruleId}\n${row.url}`).join('\n\n') || 'No rule matches in this worker session.';
}
async function action(task) {
  const controls = [...document.querySelectorAll('button,input,textarea')];
  controls.forEach(control => control.disabled = true);
  try { await task(); } catch (error) { message(error.message, true); }
  finally { controls.forEach(control => control.disabled = false); }
}
for (const key of ['enabled', 'supplemental', 'youtubeRecovery']) {
  $(key).disabled = true;
  $(key).addEventListener('change', () => action(async () => {
    try {
      Object.assign(snapshot, await send('set-toggle', { key, value: $(key).checked }));
      showStatus(snapshot.status);
      message('Saved automatically. Reload open webpages to apply cleanly.');
    } finally {
      fillToggles(snapshot.settings);
    }
  }));
}
$('save').addEventListener('click', () => action(async () => {
  await send('save', { settings: form() });
  snapshot = await send('state'); fill(snapshot.settings); showStatus(snapshot.status);
  message('Saved. Reload open webpages to apply cleanly.');
}));
$('export').addEventListener('click', () => { try { download('gapguard-settings.json', { version: 1, settings: form() }); } catch(error) { message(error.message, true); } });
$('import').addEventListener('change', () => action(async () => {
  const file = $('import').files[0]; if (!file) return;
  if (file.size > 600000) throw new Error('Settings file is too large.');
  const data = JSON.parse(await file.text());
  if (data.version !== 1 || !data.settings) throw new Error('Unsupported settings file.');
  fill(cleanSettings(data.settings)); message('Imported into the form. Review, then click Save settings.');
  $('import').value = '';
}));
$('refresh-log').addEventListener('click', () => action(async () => { snapshot = await send('state'); showStatus(snapshot.status); log(); }));
$('clear-log').addEventListener('click', () => action(async () => { await send('clear-log'); snapshot = await send('state'); log(); }));
$('export-diagnostic').addEventListener('click', () => action(async () => {
  snapshot = await send('state');
  download('gapguard-diagnostic.json', { version: chrome.runtime.getManifest().version, status: snapshot.status,
    profile: snapshot.settings.supplemental ? 'combined' : 'core', enabled: snapshot.settings.enabled,
    youtubeRecovery: snapshot.settings.youtubeRecovery, customRuleCount: snapshot.settings.rules.length,
    siteExceptionCount: snapshot.settings.allowlist.length, build: buildInfo,
    browser: navigator.userAgent, capturedAt: new Date().toISOString(),
  });
}));
(async () => {
  $('version').textContent = chrome.runtime.getManifest().version;
  snapshot = await send('state'); fill(snapshot.settings); showStatus(snapshot.status); log();
  for (const key of ['enabled', 'supplemental', 'youtubeRecovery']) $(key).disabled = false;
  buildInfo = await (await fetch('build-report.json')).json();
  const lines = [`Built: ${buildInfo.builtAt}`, ...Object.entries(buildInfo.profiles).map(([key, profile]) =>
    `${key}: ${profile.uniqueSourceRules.toLocaleString()} unique source rules; ${profile.networkRules.toLocaleString()} network rules; ${profile.conversionErrors} conversion notes.`)];
  $('build').textContent = lines.join(' • ');
})().catch(error => message(error.message, true));
