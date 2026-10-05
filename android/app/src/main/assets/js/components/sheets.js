function openSheet(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeSheet(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('show');
  }
  if (id === 'sheetItem') {
    const confirmEl = document.getElementById('sheetConfirmDialog');
    if (confirmEl) confirmEl.classList.remove('show');
  }
  // Only restore scroll if no other sheets are open
  if (!document.querySelector('.sheet-backdrop.show')) {
    document.body.style.overflow = '';
  }
}

function initSheetBackdrops() {
  document.querySelectorAll('.sheet-backdrop').forEach(sheet => {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        if (sheet.id === 'sheetScanner') {
          window.closeBarcodeScanner ? window.closeBarcodeScanner() : closeSheet(sheet.id);
        } else {
          closeSheet(sheet.id);
        }
      }
    });
  });
}

function showConfirmModal({ title = 'Konfirmasi', message, confirmText = 'Ya, Hapus', onConfirm }) {
  const titleEl = document.getElementById('confirmDialogTitle');
  const msgEl = document.getElementById('confirmDialogMessage');
  const btnAction = document.getElementById('btnConfirmDialogAction');

  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = message;
  if (btnAction) {
    btnAction.innerText = confirmText;
    btnAction.onclick = () => {
      closeSheet('sheetConfirmDialog');
      if (typeof onConfirm === 'function') onConfirm();
    };
  }

  openSheet('sheetConfirmDialog');
}

if (typeof window !== 'undefined') {
  window.openSheet = openSheet;
  window.closeSheet = closeSheet;
  window.initSheetBackdrops = initSheetBackdrops;
  window.showConfirmModal = showConfirmModal;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { openSheet, closeSheet, initSheetBackdrops };
}
