// Original, optional fallback: click YouTube's own visible skip button only.
// It neither changes playback speed nor seeks/mutes the user's video.
let active = false;
let timer;
async function refresh() {
  try {
    const result = await chrome.runtime.sendMessage({ channel: 'gapguard', type: 'recovery-status' });
    active = result.enabled;
  } catch { active = false; clearInterval(timer); }
}
function skip() {
  if (!active || document.hidden) return;
  const player = document.querySelector('#movie_player.ad-showing, .html5-video-player.ad-showing');
  if (!player) return;
  for (const button of player.querySelectorAll('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern')) {
    if (!button.disabled && button.getClientRects().length) { button.click(); break; }
  }
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.gapguardSettings) refresh(); });
document.addEventListener('yt-navigate-finish', refresh);
refresh();
timer = setInterval(skip, 1000);
