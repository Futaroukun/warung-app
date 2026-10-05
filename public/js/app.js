// Global application router and master event wiring

function switchMainTab(tab) {
  // Update buttons
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btnNav_${tab}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update panels
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const activePane = document.getElementById(`tab_${tab}`);
  if (activePane) activePane.classList.add('active');

  window.appStore.setState({ activeTab: tab });

  // Refresh view data
  if (tab === 'dashboard') window.loadDashboard?.();
  if (tab === 'pos') window.renderItemsUI?.();
  if (tab === 'debts') window.loadDebts?.();
  if (tab === 'history') window.loadHistory?.();
  if (tab === 'system') window.checkSystemHealth?.();
}

// Checkout Modal Workflow
let checkoutPaymentType = 'cash';

function openCheckoutSheet() {
  const cart = window.appStore.getState().cart;
  if (cart.length === 0) {
    window.showToast('Keranjang belanja masih kosong', 'warning');
    return;
  }

  renderCheckoutSheetItems();
  setCheckoutPaymentType('cash');
  const cashInput = document.getElementById('checkoutCashReceived');
  if (cashInput) {
    cashInput.value = '';
  }
  calculateCheckoutChange();
  window.openSheet('sheetCheckout');
}

function renderCheckoutSheetItems() {
  const container = document.getElementById('checkoutCartItemsList');
  if (!container) return;

  const cart = window.appStore.getState().cart;
  const total = window.appStore.getCartTotal();

  container.innerHTML = cart.map(item => `
    <div class="checkout-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
      <div>
        <div style="font-weight: 700; font-size: 13px;">${item.name}</div>
        <div style="font-size: 11px; color: var(--text-sub);">${item.qty} x ${window.formatRp(item.sell_price)}</div>
      </div>
      <div style="font-weight: 800; font-size: 13px; color: var(--emerald);">
        ${window.formatRp(item.qty * item.sell_price)}
      </div>
    </div>
  `).join('');

  const totalEl = document.getElementById('checkoutGrandTotal');
  if (totalEl) totalEl.innerText = window.formatRp(total);
}

function setCheckoutPaymentType(type) {
  checkoutPaymentType = type;
  document.querySelectorAll('.btn-pay-mode').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`btnPayMode_${type}`);
  if (activeBtn) activeBtn.classList.add('active');

  const cashSec = document.getElementById('checkoutCashSection');
  const debtSec = document.getElementById('checkoutDebtSection');

  if (type === 'cash') {
    if (cashSec) cashSec.style.display = 'block';
    if (debtSec) debtSec.style.display = 'none';
  } else {
    if (cashSec) cashSec.style.display = 'none';
    if (debtSec) debtSec.style.display = 'block';
  }
}

function setQuickCash(val) {
  const cashInput = document.getElementById('checkoutCashReceived');
  if (!cashInput) return;

  const total = window.appStore.getCartTotal();
  if (val === 'exact') {
    cashInput.value = total;
  } else {
    cashInput.value = Number(val);
  }
  calculateCheckoutChange();
}

function calculateCheckoutChange() {
  const cashInput = document.getElementById('checkoutCashReceived');
  const changeEl = document.getElementById('checkoutChangeVal');
  if (!cashInput || !changeEl) return;

  const total = window.appStore.getCartTotal();
  const received = window.cleanNumber(cashInput.value);
  const diff = received - total;

  if (diff >= 0) {
    changeEl.innerText = window.formatRp(diff);
    changeEl.style.color = 'var(--emerald)';
  } else {
    changeEl.innerText = `Kurang ${window.formatRp(Math.abs(diff))}`;
    changeEl.style.color = 'var(--rose)';
  }
}

async function submitCheckout() {
  const cart = window.appStore.getState().cart;
  if (cart.length === 0) return;

  const total = window.appStore.getCartTotal();
  let cashReceived = 0;
  let customerName = '';

  if (checkoutPaymentType === 'cash') {
    const cashInput = document.getElementById('checkoutCashReceived');
    cashReceived = window.cleanNumber(cashInput?.value);
    if (cashReceived < total) {
      window.showToast('Uang tunai kurang dari total belanja!', 'warning');
      return;
    }
  } else if (checkoutPaymentType === 'debt') {
    const custInput = document.getElementById('checkoutCustomerName');
    customerName = (custInput?.value || '').trim();
    if (!customerName) {
      window.showToast('Nama pelanggan wajib diisi untuk kasbon!', 'warning');
      custInput?.focus();
      return;
    }
  }

  const payload = {
    items: cart.map(c => ({ id: c.id, qty: c.qty })),
    payment_type: checkoutPaymentType,
    cash_received: cashReceived,
    customer_name: customerName
  };

  try {
    const res = await window.api.post('/sales', payload);
    if (res.success) {
      const sale = res.data;
      window.appStore.clearCart();
      window.closeSheet('sheetCheckout');
      window.showToast('Transaksi Berhasil!', 'success');

      // Refresh data
      window.loadItems?.();
      window.loadDashboard?.();
      window.loadDebts?.();

      // Show print & share modal or prompt
      promptReceiptAction(sale);
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal memproses transaksi', 'error');
  }
}

function promptReceiptAction(sale) {
  const doPrint = confirm(`Transaksi Sukses!\nNo. Struk: ${sale.invoice_no}\nTotal: ${window.formatRp(sale.total_amount)}\n\nIngin cetak struk belanja sekarang?`);
  if (doPrint) {
    window.printReceipt?.(sale);
  }
}

// Scanner Sheet Control
function openBarcodeScanner() {
  const videoEl = document.getElementById('scannerVideo');
  if (!videoEl) return;

  window.openSheet('sheetScanner');
  window.startScanner(videoEl, (barcode) => {
    window.handleBarcodeScanned?.(barcode);
  }).catch(err => {
    window.showToast(err.message || 'Gagal membuka kamera', 'error');
    window.closeSheet('sheetScanner');
  });
}

function closeBarcodeScanner() {
  window.stopScanner?.();
  window.closeSheet('sheetScanner');
}

// Item Sheet (Add / Edit Product)
function openItemSheet(item = null) {
  const form = document.getElementById('formItem');
  if (!form) return;
  form.reset();

  const idInput = document.getElementById('itemIdField');
  const titleEl = document.getElementById('itemSheetTitle');
  const barcodeInput = document.getElementById('itemBarcodeField');
  const nameInput = document.getElementById('itemNameField');
  const catInput = document.getElementById('itemCategoryField');
  const buyInput = document.getElementById('itemBuyPriceField');
  const sellInput = document.getElementById('itemSellPriceField');
  const stockInput = document.getElementById('itemStockField');
  const minStockInput = document.getElementById('itemMinStockField');

  if (item && item.id) {
    if (titleEl) titleEl.innerText = 'Edit Produk';
    if (idInput) idInput.value = item.id;
    if (barcodeInput) barcodeInput.value = item.barcode || '';
    if (nameInput) nameInput.value = item.name || '';
    if (catInput) catInput.value = item.category || 'Umum';
    if (buyInput) buyInput.value = item.buy_price || 0;
    if (sellInput) sellInput.value = item.sell_price || 0;
    if (stockInput) stockInput.value = item.stock || 0;
    if (minStockInput) minStockInput.value = item.min_stock || 3;
  } else {
    if (titleEl) titleEl.innerText = 'Tambah Produk Baru';
    if (idInput) idInput.value = '';
    if (barcodeInput) barcodeInput.value = (item && item.barcode) ? item.barcode : '';
    if (nameInput) nameInput.value = (item && item.name) ? item.name : '';
    if (catInput) catInput.value = 'Umum';
    if (buyInput) buyInput.value = '';
    if (sellInput) sellInput.value = '';
    if (stockInput) stockInput.value = '';
    if (minStockInput) minStockInput.value = '3';
  }

  window.openSheet('sheetItem');
}

async function submitItemForm(e) {
  e.preventDefault();
  const id = document.getElementById('itemIdField')?.value;
  const barcode = document.getElementById('itemBarcodeField')?.value;
  const name = document.getElementById('itemNameField')?.value;
  const category = document.getElementById('itemCategoryField')?.value;
  const buy_price = window.cleanNumber(document.getElementById('itemBuyPriceField')?.value);
  const sell_price = window.cleanNumber(document.getElementById('itemSellPriceField')?.value);
  const stock = window.cleanNumber(document.getElementById('itemStockField')?.value);
  const min_stock = window.cleanNumber(document.getElementById('itemMinStockField')?.value);

  const payload = { barcode, name, category, buy_price, sell_price, stock, min_stock };

  try {
    let res;
    if (id) {
      res = await window.api.put(`/items/${id}`, payload);
    } else {
      res = await window.api.post('/items', payload);
    }

    if (res.success) {
      window.closeSheet('sheetItem');
      window.showToast(id ? 'Produk berhasil diubah' : 'Produk baru ditambahkan', 'success');
      window.loadItems?.();
      window.loadDashboard?.();
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal menyimpan produk', 'error');
  }
}

// Payment Modal (Kasbon)
let activePayingDebtId = null;

function openPaySheet(debtId) {
  activePayingDebtId = debtId;
  const debt = window.appStore.getState().debts.find(d => d.id === debtId);
  if (!debt) return;

  const remaining = debt.amount - debt.paid_amount;
  const custEl = document.getElementById('payDebtCustomerName');
  const remainEl = document.getElementById('payDebtRemaining');
  const amountInput = document.getElementById('payDebtAmount');

  if (custEl) custEl.innerText = debt.customer_name;
  if (remainEl) remainEl.innerText = window.formatRp(remaining);
  if (amountInput) amountInput.value = remaining;

  window.openSheet('sheetPay');
}

function setPayPreset(val) {
  const debt = window.appStore.getState().debts.find(d => d.id === activePayingDebtId);
  const input = document.getElementById('payDebtAmount');
  if (!debt || !input) return;

  const remaining = debt.amount - debt.paid_amount;
  if (val === 'lunas') {
    input.value = remaining;
  } else {
    input.value = Math.min(remaining, Number(val));
  }
}

async function submitPayDebt() {
  if (!activePayingDebtId) return;
  const input = document.getElementById('payDebtAmount');
  const notesInput = document.getElementById('payDebtNotes');
  const amount = window.cleanNumber(input?.value);
  const notes = notesInput?.value || '';

  if (amount <= 0) {
    window.showToast('Nominal pembayaran harus lebih dari 0', 'warning');
    return;
  }

  try {
    const res = await window.api.post(`/debts/${activePayingDebtId}/pay`, { amount, notes });
    if (res.success) {
      window.closeSheet('sheetPay');
      window.showToast('Pembayaran kasbon berhasil dicatat', 'success');
      window.loadDebts?.();
      window.loadDashboard?.();
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal memproses pembayaran kasbon', 'error');
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.initSheetBackdrops?.();

  // Subscribe cart changes to update floating cart bar
  window.appStore.subscribe(() => {
    window.updateCartBar?.();
    window.renderItemsUI?.();
  });

  // Load initial data
  window.loadDashboard?.();
  window.loadItems?.();

  // Bind forms
  const formItem = document.getElementById('formItem');
  if (formItem) formItem.addEventListener('submit', submitItemForm);

  const cashReceivedInput = document.getElementById('checkoutCashReceived');
  if (cashReceivedInput) {
    cashReceivedInput.addEventListener('input', calculateCheckoutChange);
  }
});

// Global mappings
window.switchMainTab = switchMainTab;
window.openCheckoutSheet = openCheckoutSheet;
window.setCheckoutPaymentType = setCheckoutPaymentType;
window.setQuickCash = setQuickCash;
window.calculateCheckoutChange = calculateCheckoutChange;
window.submitCheckout = submitCheckout;
window.openBarcodeScanner = openBarcodeScanner;
window.closeBarcodeScanner = closeBarcodeScanner;
window.openItemSheet = openItemSheet;
window.submitItemForm = submitItemForm;
window.openPaySheet = openPaySheet;
window.setPayPreset = setPayPreset;
window.submitPayDebt = submitPayDebt;
