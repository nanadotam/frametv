// Shows a banner while offline and disables anything marked data-needs-net.
(() => {
  const el = document.createElement('div');
  el.className = 'net-banner';
  el.setAttribute('role', 'status');
  el.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5.5 12a10 10 0 0 1 13 0"/><path d="M9 15.5a5 5 0 0 1 6 0"/><path d="M3 3l18 18"/></svg>' +
    '<span><b>No internet connection.</b> Connect to Wi-Fi to continue. Mantel will pick up where you left off.</span>';
  const apply = () => {
    const offline = !navigator.onLine;
    el.classList.toggle('show', offline);
    document.querySelectorAll('[data-needs-net]').forEach((b) => {
      b.disabled = offline;
      b.title = offline ? 'Needs an internet connection' : '';
    });
  };
  window.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(el);
    apply();
  });
  window.addEventListener('online', apply);
  window.addEventListener('offline', apply);
})();
