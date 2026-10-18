const version = chrome.runtime.getManifest().version;
document.getElementById('version').textContent = version;
document.getElementById('footer-version').textContent = version;
function show(data) {
  const error = data['combined:startupError'];
  if (error) { document.getElementById('rule-summary').textContent = 'Coordinator could not start: ' + error; return; }
  const state = data['combined:ruleStatus'];
  if (!state) return;
  document.getElementById('rule-summary').textContent = `${state.newsInstalledRules} publisher network rules; ${state.protectionDynamic} custom protection rules; ${state.protectionSession} protection session rules. IDs, deletion, and preferences are isolated by module.`;
}
function newsStatus(data) {
  const state = data['osm:rules'];
  if (state) document.getElementById('news-status').textContent = state.error ? 'Publisher rules could not load: ' + state.error : `Publisher source: ${state.count} rules, ${state.skipped?.length ?? 0} conversion notes.`;
}
const keys = ['combined:ruleStatus', 'combined:startupError', 'osm:rules'];
function refresh() { return chrome.storage.local.get(keys).then(data => { show(data); newsStatus(data); }).catch(error => { document.getElementById('rule-summary').textContent = error.message; }); }
refresh();
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && keys.some(key => key in changes)) refresh(); });
