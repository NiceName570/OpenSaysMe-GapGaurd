const control = document.getElementById('power-toggle');
const feedback = document.getElementById('power-message');
let busy = true;
let currentState;
async function request(type, body = {}) {
  const state = await chrome.runtime.sendMessage({ channel: 'combined', type, ...body });
  if (state.error) throw new Error(state.error);
  return state;
}
function render(state) {
  currentState = state;
  control.checked = state.enabled;
  control.disabled = busy;
  document.getElementById('power-label').textContent = state.enabled ? 'OpenSaysMe is on' : 'OpenSaysMe is off';
  document.getElementById('power-summary').textContent = state.problem || (state.enabled
    ? 'Ad blocking, publisher tools, and research discovery are enabled.'
    : 'Ad blocking, publisher tools, and research lookups are paused.');
  document.getElementById('picker').disabled = busy || !state.enabled;
  document.getElementById('extra-tools').hidden = !state.enabled;
}
control.addEventListener('change', async () => {
  busy = true; control.disabled = true; feedback.textContent = 'Applying…';
  try { render(await request('set-enabled', { enabled: control.checked })); feedback.textContent = 'Saved automatically.'; }
  catch (error) { try { render(await request('state')); } catch {} feedback.textContent = error.message; }
  finally { busy = false; if (currentState) render(currentState); }
});
request('state').then(state => { busy = false; render(state); }).catch(error => { feedback.textContent = error.message; });
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes['combined:enabled'] && !busy) request('state').then(render).catch(error => { feedback.textContent = error.message; }); });
document.getElementById('picker').addEventListener('click', async () => {
  try {
    const state = await chrome.runtime.sendMessage({ channel: 'gapguard', type: 'state' });
    if (!state.host) throw new Error('Open a regular website first.');
    await chrome.runtime.sendMessage({ channel: 'gapguard', type: 'picker', tabId: state.tabId });
    window.close();
  } catch (error) { feedback.textContent = error.message; }
});
const frame = document.getElementById('tools');
const pages = { news: 'options/popup.html', research: 'html/popup.html' };
function select(name) {
  frame.src = pages[name]; frame.hidden = false;
  for (const key of Object.keys(pages)) document.getElementById(key).setAttribute('aria-pressed', String(key === name));
}
for (const name of Object.keys(pages)) document.getElementById(name).addEventListener('click', () => select(name));
document.getElementById('extra-tools').addEventListener('toggle', event => { if (event.target.open && !frame.getAttribute('src')) select('news'); });
frame.addEventListener('load', () => {
  const body = frame.contentDocument?.body;
  if (!body) return;
  body.style.width = 'auto'; body.style.minWidth = '0';
  const close = body.querySelector('#button-close'); if (close) close.hidden = true;
  frame.style.height = Math.min(250, Math.max(180, body.scrollHeight + 4)) + 'px';
});
