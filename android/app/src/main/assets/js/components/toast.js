let toastTimer = null;

function showToast(msg, type = 'success') {
  let toast = document.getElementById('toastMessage');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMessage';
    toast.className = 'toast';
    toast.innerHTML = '<svg id="toastIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2.5"></svg><span id="toastText"></span>';
    document.body.appendChild(toast);
  }

  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastText');

  clearTimeout(toastTimer);
  toast.classList.remove('show', 'toast-error', 'toast-warning', 'toast-success');

  if (type === 'error') {
    toast.classList.add('toast-error');
    if (icon) {
      icon.setAttribute('stroke', '#f43f5e');
      icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
    }
  } else if (type === 'warning') {
    toast.classList.add('toast-warning');
    if (icon) {
      icon.setAttribute('stroke', '#f59e0b');
      icon.innerHTML = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>';
    }
  } else {
    toast.classList.add('toast-success');
    if (icon) {
      icon.setAttribute('stroke', '#10b981');
      icon.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
    }
  }

  if (text) text.innerText = msg;
  void toast.offsetWidth; // Trigger reflow for CSS animation
  toast.classList.add('show');

  try {
    if (type === 'error' || type === 'warning') {
      navigator.vibrate?.([30, 40, 30]);
    }
  } catch (e) {}

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// Global hook
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showToast };
}
