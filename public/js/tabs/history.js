async function loadHistory() {
  try {
    const res = await window.api.get('/sales?limit=100');
    if (res.success) {
      window.appStore.setState({ sales: res.data });
      renderHistoryUI();
    }
  } catch (err) {
    console.error('Failed to load sales history:', err);
  }
}

function renderSaleCardHtml(sale) {
  const invoice = sale.invoice_no || `INV-${sale.id}`;
  const dateStr = window.formatTanggal(sale.created_at);
  const items = sale.items || [];
  const itemCount = items.reduce((s, it) => s + (it.qty || 1), 0);
  const isDebt = sale.payment_type === 'debt';

  let itemsSummary = items.slice(0, 3).map(it => `${it.qty}x ${it.item_name || it.name}`).join(', ');
  if (items.length > 3) itemsSummary += `, +${items.length - 3} lainnya`;

  return `
    <div class="history-card" id="card-sale-${sale.id}">
      <div class="history-card-top">
        <div>
          <div class="history-invoice">${invoice}</div>
          <div class="history-date">${dateStr}</div>
        </div>
        <div style="text-align: right;">
          <div class="history-amount">${window.formatRp(sale.total_amount)}</div>
          <span class="badge-payment ${isDebt ? 'debt' : 'cash'}">${isDebt ? 'Kasbon' : 'Tunai'}</span>
        </div>
      </div>

      <div class="history-card-mid">
        <div class="history-items-summary">${itemsSummary || 'Belanjaan'}</div>
        ${sale.customer_name ? `<div class="history-customer-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${sale.customer_name}</div>` : ''}
      </div>

      <div class="history-card-bottom">
        <button class="btn-receipt-action print" onclick='printHistoryReceipt(${JSON.stringify(sale).replace(/'/g, "&apos;")})'>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
          <span>Cetak Struk</span>
        </button>
        <button class="btn-receipt-action wa" onclick='shareHistoryWhatsApp(${JSON.stringify(sale).replace(/'/g, "&apos;")})'>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>Kirim WA</span>
        </button>
      </div>
    </div>
  `;
}

function renderHistoryUI() {
  const container = document.getElementById('historyListContainer');
  const searchInput = document.getElementById('historySearchField');
  const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const state = window.appStore.getState();
  const sales = state.sales || [];
  const period = state.historyPeriod || 'today';

  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = sales.filter(s => {
    const saleDate = (s.created_at || '').slice(0, 10);
    if (period === 'today' && saleDate !== todayStr) return false;

    if (search) {
      const matchInv = (s.invoice_no || '').toLowerCase().includes(search);
      const matchCust = (s.customer_name || '').toLowerCase().includes(search);
      const matchItems = (s.items || []).some(it => (it.item_name || '').toLowerCase().includes(search));
      if (!matchInv && !matchCust && !matchItems) return false;
    }

    return true;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + s.total_amount, 0);
  const totalTrx = filtered.length;

  const revEl = document.getElementById('historyPeriodTotal');
  if (revEl) revEl.innerText = window.formatRp(totalRevenue);
  const trxEl = document.getElementById('historyPeriodCount');
  if (trxEl) trxEl.innerText = `${totalTrx} Transaksi`;

  if (container) {
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-box" style="text-align: center; padding: 40px 20px; color: var(--text-sub);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; opacity: 0.5;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size: 13px; font-weight: 600;">Belum ada riwayat transaksi pada periode ini</div>
        </div>
      `;
    } else {
      container.innerHTML = filtered.map(s => renderSaleCardHtml(s)).join('');
    }
  }
}

function printHistoryReceipt(sale) {
  window.printReceipt(sale);
}

function shareHistoryWhatsApp(sale) {
  window.shareReceiptWhatsApp(sale);
}

if (typeof window !== 'undefined') {
  window.loadHistory = loadHistory;
  window.renderHistoryUI = renderHistoryUI;
  window.printHistoryReceipt = printHistoryReceipt;
  window.shareHistoryWhatsApp = shareHistoryWhatsApp;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadHistory, renderHistoryUI, printHistoryReceipt, shareHistoryWhatsApp };
}
