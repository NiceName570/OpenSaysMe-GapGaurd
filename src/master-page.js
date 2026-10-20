(() => {
  const banner = document.createElement('p');
  banner.className = 'osm-master-banner';
  banner.setAttribute('role', 'status');
  document.body.prepend(banner);
  function update() {
    chrome.runtime.sendMessage({ channel: 'combined', type: 'state' }).then(state => {
      banner.textContent = state.problem ? 'OpenSaysMe needs attention: ' + state.problem
        : state.enabled ? 'OpenSaysMe is on. Protection, News, and Research follow the toolbar switch.'
        : 'OpenSaysMe is off. Use the toolbar switch to turn all features on.';
      document.documentElement.dataset.osmEnabled = String(state.enabled);
    }).catch(error => { banner.textContent = error.message; });
  }
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes['combined:enabled']) update(); });
  update();
})();
