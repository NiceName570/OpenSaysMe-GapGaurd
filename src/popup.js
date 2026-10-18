const frame = document.getElementById('tools');
const tools = {
  protection: { url: 'protection-popup.html', title: 'Ad and tracker protection', hint: 'Ad and tracker protection. Switches save automatically.' },
  news: { url: 'options/popup.html', title: 'Publisher access tools', hint: 'Publisher tools and cookie cleanup. News exclusions affect News only.' },
  research: { url: 'html/popup.html', title: 'Open-access research', hint: 'Find open-access papers and configured library access.' },
};
function select(name) {
  if (!tools[name]) name = 'protection';
  frame.src = tools[name].url;
  frame.title = tools[name].title;
  document.getElementById('module-hint').textContent = tools[name].hint;
  for (const key of Object.keys(tools)) document.getElementById(key).setAttribute('aria-pressed', String(key === name));
  chrome.storage.local.set({ 'combined:popupTab': name }).catch(showError);
}
function showError(error) { const row = document.getElementById('shell-error'); row.hidden = false; row.textContent = error.message; }
for (const name of Object.keys(tools)) document.getElementById(name).addEventListener('click', () => select(name));
let observer;
frame.addEventListener('load', () => {
  observer?.disconnect();
  const body = frame.contentDocument?.body;
  if (!body) return;
  const close = body.querySelector('#button-close');
  if (close) close.hidden = true;
  body.style.width = 'auto'; body.style.minWidth = '0';
  const resize = () => {
    const surrounding = [...document.body.children].filter(row => row !== frame && row.tagName !== 'SCRIPT')
      .reduce((height, row) => height + row.getBoundingClientRect().height, 0);
    frame.style.height = Math.min(Math.max(200, 580 - surrounding), Math.max(230, body.scrollHeight + 4)) + 'px';
  };
  observer = new ResizeObserver(resize); observer.observe(body); resize();
});
chrome.storage.local.get('combined:popupTab').then(data => { if (data['combined:popupTab'] && data['combined:popupTab'] !== 'protection') select(data['combined:popupTab']); }).catch(showError);
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (/^https?:/.test(tab?.url ?? '')) document.getElementById('current-site').textContent = new URL(tab.url).hostname;
}).catch(showError);
