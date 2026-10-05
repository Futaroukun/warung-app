async function checkSystemHealth() {
  try {
    const res = await window.api.get('/system/health');
    if (res.success) {
      const data = res.data;
      const memEl = document.getElementById('sysMemoryInfo');
      const uptimeEl = document.getElementById('sysUptimeInfo');
      const dbEl = document.getElementById('sysDbInfo');

      if (memEl) memEl.innerText = `RAM: ${data.memory_usage_mb.rss} MB (Heap: ${data.memory_usage_mb.heapUsed} MB)`;
      if (uptimeEl) {
        const mins = Math.floor(data.uptime_seconds / 60);
        const secs = data.uptime_seconds % 60;
        uptimeEl.innerText = `Uptime: ${mins}m ${secs}s`;
      }
      if (dbEl) dbEl.innerText = `Database: ${data.database}`;
    }
  } catch (err) {
    console.error('Failed to get system health:', err);
  }
}

function downloadDatabaseBackup() {
  window.showToast('Memulai unduh backup warung.db...', 'success');
  window.location.href = '/api/system/backup';
}

if (typeof window !== 'undefined') {
  window.checkSystemHealth = checkSystemHealth;
  window.downloadDatabaseBackup = downloadDatabaseBackup;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkSystemHealth, downloadDatabaseBackup };
}
