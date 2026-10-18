import { $, send, message, showStatus } from './ui.js';
import { isAllowed } from './settings.js';
let snapshot;
async function render() {
  snapshot = await send('state');
  showStatus(snapshot.status);
  for (const key of ['enabled', 'supplemental', 'youtubeRecovery']) $(key).checked = snapshot.settings[key];
  $('host').textContent = snapshot.host ?? 'Open a regular website';
  const paused = snapshot.host && isAllowed(snapshot.host, snapshot.settings.allowlist);
  $('site').textContent = paused ? 'Resume on this site' : 'Pause on this site';
  $('site').disabled = !snapshot.host;
  $('picker').disabled = !snapshot.host || !snapshot.settings.enabled || paused || snapshot.status.state !== 'ready';
  $('hint').textContent = paused ? 'This site is excepted from protection.' : 'Reload the page after changing protection.';
  $('count').textContent = `${snapshot.count} network rule matches on this page since the last worker start/navigation.`;
}
async function action(task) {
  const controls = [...document.querySelectorAll('button,input')];
  controls.forEach(control => control.disabled = true);
  try { await task(); await render(); }
  catch (error) { try { await render(); } catch {} message(error.message, true); }
  finally { controls.forEach(control => control.disabled = false); if(snapshot) {
    $('site').disabled = !snapshot.host;
    $('picker').disabled = !snapshot.host || !snapshot.settings.enabled || isAllowed(snapshot.host, snapshot.settings.allowlist) || snapshot.status.state !== 'ready';
  } }
}
for (const key of ['enabled', 'supplemental', 'youtubeRecovery']) $(key).addEventListener('change', () => action(async () => {
  await send('set-toggle', { key, value: $(key).checked });
  message('Saved. Reload the webpage to apply cleanly.');
}));
$('site').addEventListener('click', () => action(async () => { await send('toggle-site', { host: snapshot.host }); message('Saved. Reload the webpage.'); }));
$('picker').addEventListener('click', () => action(async () => { await send('picker', { tabId: snapshot.tabId }); window.close(); }));
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
render().catch(error => message(error.message, true));
