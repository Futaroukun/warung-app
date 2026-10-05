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
  } catch (err) {
    console.error('Failed to load dashboard summary:', err);
  }
}

function initDashboard() {
  // Bind any dashboard specific action buttons
  const btnRefresh = document.getElementById('btnRefreshDash');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadDashboard);
  }
}

if (typeof window !== 'undefined') {
  window.loadDashboard = loadDashboard;
  window.initDashboard = initDashboard;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadDashboard, initDashboard };
}
