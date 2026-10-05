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
    // Only restore scroll if no other sheets are open
    if (!document.querySelector('.sheet-backdrop.show')) {
      document.body.style.overflow = '';
    }
  }
}

function initSheetBackdrops() {
  document.querySelectorAll('.sheet-backdrop').forEach(sheet => {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        closeSheet(sheet.id);
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.openSheet = openSheet;
  window.closeSheet = closeSheet;
  window.initSheetBackdrops = initSheetBackdrops;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { openSheet, closeSheet, initSheetBackdrops };
}
