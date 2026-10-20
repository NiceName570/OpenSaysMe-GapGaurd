export const $ = id => document.getElementById(id);
export async function send(type, body = {}) {
  return chrome.runtime.sendMessage({ channel: 'gapguard', type, ...body });
}
export function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}
export function showStatus(status) {
  $('state').textContent = status.state === 'ready' ? 'Ready' : status.state === 'error' ? 'Needs attention' : 'Starting';
  $('state').classList.toggle('error', status.state === 'error');
  if (status.error) message(status.error, true);
}
export function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
