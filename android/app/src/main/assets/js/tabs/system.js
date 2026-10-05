const DEFAULT_DEBT_REMINDER_TEMPLATE = 
`Halo Kak *{nama}*,
Salam hangat dari {toko} 🙏

Berikut rincian catatan kasbon yang tercatat:
• *Sisa Kasbon* : *{sisa}*
• *Total Kasbon*: {total}
• *Tanggal*     : {tanggal}
• *Keterangan*  : {rincian}

Jika ada waktu luang, mohon dibantu pelunasannya ya Kak. Terima kasih banyak atas kerjasamanya! 😊`;

async function checkSystemHealth() {
  loadDebtTemplateSetting();
  try {
    const res = await window.api.get('/system/health');
    if (res.success) {
      const data = res.data;
      const memEl = document.getElementById('sysMemoryInfo');
      const uptimeEl = document.getElementById('sysUptimeInfo');
      const dbEl = document.getElementById('sysDbInfo');

      if (memEl) memEl.innerText = `${data.memory_usage_mb.rss} MB (Heap: ${data.memory_usage_mb.heapUsed} MB)`;
      if (uptimeEl) {
        const hours = Math.floor(data.uptime_seconds / 3600);
        const mins = Math.floor((data.uptime_seconds % 3600) / 60);
        const secs = data.uptime_seconds % 60;
        const timeStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m ${secs}d`;
        uptimeEl.innerText = `Sesi Aktif: ${timeStr}`;
      }
      if (dbEl) dbEl.innerText = data.database || 'SQLite WAL Mode';
    }
  } catch (err) {
    console.error('Failed to get system health:', err);
  }
}

function loadDebtTemplateSetting() {
  const el = document.getElementById('settingDebtTemplateText');
  if (!el) return;
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_debt_reminder_template') : null;
  el.value = (saved && saved.trim()) ? saved : DEFAULT_DEBT_REMINDER_TEMPLATE;
}

function saveDebtTemplateSetting() {
  const el = document.getElementById('settingDebtTemplateText');
  if (!el) return;
  const val = el.value.trim();
  if (!val) {
    window.showToast?.('Template tagihan tidak boleh kosong', 'warning');
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('custom_debt_reminder_template', val);
  }
  window.showToast?.('Template tagihan WhatsApp berhasil disimpan!', 'success');
}

function resetDebtTemplateToDefault() {
  const el = document.getElementById('settingDebtTemplateText');
  if (el) el.value = DEFAULT_DEBT_REMINDER_TEMPLATE;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('custom_debt_reminder_template');
  }
  window.showToast?.('Template tagihan dikembalikan ke default', 'info');
}

function insertReminderTag(tag) {
  const el = document.getElementById('settingDebtTemplateText');
  if (!el) return;
  const start = el.selectionStart || el.value.length;
  const end = el.selectionEnd || el.value.length;
  const text = el.value;
  el.value = text.substring(0, start) + tag + text.substring(end);
  el.focus();
  el.setSelectionRange(start + tag.length, start + tag.length);
}

function downloadDatabaseBackup() {
  window.showToast('Memulai unduh backup warung.db...', 'success');
  window.location.href = '/api/system/backup';
}

if (typeof window !== 'undefined') {
  window.DEFAULT_DEBT_REMINDER_TEMPLATE = DEFAULT_DEBT_REMINDER_TEMPLATE;
  window.checkSystemHealth = checkSystemHealth;
  window.loadDebtTemplateSetting = loadDebtTemplateSetting;
  window.saveDebtTemplateSetting = saveDebtTemplateSetting;
  window.resetDebtTemplateToDefault = resetDebtTemplateToDefault;
  window.insertReminderTag = insertReminderTag;
  window.downloadDatabaseBackup = downloadDatabaseBackup;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_DEBT_REMINDER_TEMPLATE,
    checkSystemHealth,
    loadDebtTemplateSetting,
    saveDebtTemplateSetting,
    resetDebtTemplateToDefault,
    insertReminderTag,
    downloadDatabaseBackup
  };
}
