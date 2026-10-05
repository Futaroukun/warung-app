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

function exportSalesCsv() {
  window.showToast('Mengunduh Laporan Penjualan (CSV)...', 'success');
  window.location.href = '/api/reports/export/sales';
}

function exportItemsCsv() {
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
