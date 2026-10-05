async function loadDashboard() {
  try {
    const res = await window.api.get('/summary');
    if (!res.success) return;
    const data = res.data;

    // Save to store
    window.appStore.setState({ summary: data });

    // Update DOM elements if present
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setTxt('dashTodayTotal', window.formatRp(data.today_sales));
    setTxt('dashTodayProfit', window.formatRp(data.today_profit));
    setTxt('dashTodayCount', `${data.today_transactions || 0} Trx`);

    setTxt('dashMonthTotal', window.formatRp(data.month_sales));
    setTxt('dashMonthProfit', window.formatRp(data.month_profit));
    setTxt('dashMonthCount', `${data.month_transactions || 0} Trx`);

    setTxt('dashTotalDebt', window.formatRp(data.total_debt));
    setTxt('dashDebtCount', `${data.debt_count || 0} Orang`);

    setTxt('dashTotalItems', `${data.total_items || 0} Produk`);
    setTxt('dashLowStock', `${data.low_stock_count || 0} Menipis`);
    setTxt('dashAssetValue', window.formatRp(data.inventory_asset_value));

    // Also load Profit Loss statement
    loadProfitLoss();
  } catch (err) {
    console.error('Failed to load dashboard summary:', err);
  }
}

async function loadProfitLoss() {
  try {
    const res = await window.api.get('/reports/profit-loss');
    if (!res.success) return;
    const pl = res.data;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setTxt('plGrossRevenue', window.formatRp(pl.gross_revenue));
    setTxt('plCogsTotal', window.formatRp(pl.cogs_total));
    setTxt('plNetProfit', window.formatRp(pl.net_profit));
    setTxt('plMarginPercent', `${pl.profit_margin_percent}%`);
    setTxt('plCashCollected', window.formatRp(pl.cash_collected));
  } catch (err) {
    console.error('Failed to load profit loss report:', err);
  }
}

async function exportSalesCsv() {
  if (window.api && window.api.shouldUseLocalDb() && window.localDb) {
    try {
      window.showToast?.('Menyiapkan Laporan Penjualan (CSV)...', 'info');
      const sales = await window.localDb.getSales({ limit: 10000 });
      let csv = '"No Invoice","Tanggal","Pelanggan","Metode Pembayaran","Total Belanja (Rp)","Modal HPP (Rp)","Laba Bersih (Rp)","Rincian Produk"\n';
      for (const s of sales) {
        const items = s.items || [];
        const itemsStr = items.map(it => `${it.item_name} (${it.qty}x)`).join('; ');
        const profit = (s.total_amount || 0) - (s.total_cost || 0);
        const row = [
          `"${s.invoice_no || ''}"`,
          `"${s.created_at}"`,
          `"${(s.customer_name || 'Umum').replace(/"/g, '""')}"`,
          `"${s.payment_type === 'cash' ? 'Tunai' : (s.payment_type === 'debt' ? 'Kasbon' : s.payment_type)}"`,
          s.total_amount || 0,
          s.total_cost || 0,
          profit,
          `"${itemsStr.replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-penjualan-${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.('Laporan Penjualan berhasil diunduh!', 'success');
      return;
    } catch (err) {
      window.showToast?.('Gagal ekspor penjualan: ' + err.message, 'error');
      return;
    }
  }
  window.showToast('Mengunduh Laporan Penjualan (CSV)...', 'success');
  window.location.href = '/api/reports/export/sales';
}

async function exportItemsCsv() {
  if (window.api && window.api.shouldUseLocalDb() && window.localDb) {
    try {
      window.showToast?.('Menyiapkan Data Inventaris (CSV)...', 'info');
      const items = await window.localDb.getItems();
      let csv = '"Barcode","Nama Produk","Kategori","Harga Modal (Rp)","Harga Jual (Rp)","Margin Laba (Rp)","Stok","Satuan","Nilai Aset Modal (Rp)","Status Stok"\n';
      for (const it of items) {
        const margin = (it.sell_price || 0) - (it.buy_price || 0);
        let status = 'Aman';
        if (it.stock === 0) status = 'Habis';
        else if (it.stock <= it.min_stock) status = 'Kritis';
        const assetVal = (it.stock || 0) * (it.buy_price || 0);
        const row = [
          `"${it.barcode || ''}"`,
          `"${(it.name || '').replace(/"/g, '""')}"`,
          `"${(it.category || 'Umum').replace(/"/g, '""')}"`,
          it.buy_price || 0,
          it.sell_price || 0,
          margin,
          it.stock || 0,
          `"${it.unit || 'pcs'}"`,
          assetVal,
          `"${status}"`
        ];
        csv += row.join(',') + '\n';
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stok-barang-${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.('Data Stok berhasil diunduh!', 'success');
      return;
    } catch (err) {
      window.showToast?.('Gagal ekspor inventaris: ' + err.message, 'error');
      return;
    }
  }
  window.showToast('Mengunduh Data Inventaris Stok (CSV)...', 'success');
  window.location.href = '/api/reports/export/items';
}

function initDashboard() {
  const btnRefresh = document.getElementById('btnRefreshDash');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadDashboard);
  }
}

if (typeof window !== 'undefined') {
  window.loadDashboard = loadDashboard;
  window.loadProfitLoss = loadProfitLoss;
  window.exportSalesCsv = exportSalesCsv;
  window.exportItemsCsv = exportItemsCsv;
  window.initDashboard = initDashboard;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadDashboard, loadProfitLoss, exportSalesCsv, exportItemsCsv, initDashboard };
}
