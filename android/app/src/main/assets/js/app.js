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

  if (cart.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">Keranjang belanja kosong</div>';
    const totalEl = document.getElementById('checkoutGrandTotal');
    if (totalEl) totalEl.innerText = window.formatRp(0);
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="checkout-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
      <div style="flex: 1; min-width: 0; padding-right: 8px;">
        <div style="font-weight: 700; font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
        <div style="font-size: 11px; color: var(--text-sub);">@${window.formatRp(item.sell_price)}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="checkout-item-stepper" style="display: flex; align-items: center; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
          <button type="button" onclick="changeCartQtyInCheckout(${item.id}, -1)" style="background: none; border: none; color: var(--text); padding: 5px 9px; cursor: pointer; font-weight: 900; font-size: 13px;" title="Kurangi">-</button>
          <span style="font-size: 12px; font-weight: 800; color: #fff; min-width: 20px; text-align: center;">${item.qty}</span>
          <button type="button" onclick="changeCartQtyInCheckout(${item.id}, 1)" style="background: none; border: none; color: var(--text); padding: 5px 9px; cursor: pointer; font-weight: 900; font-size: 13px;" title="Tambah">+</button>
        </div>
        <div style="font-weight: 800; font-size: 13px; color: var(--emerald); min-width: 65px; text-align: right;">
          ${window.formatRp(item.qty * item.sell_price)}
        </div>
        <button type="button" onclick="removeCartItemInCheckout(${item.id})" title="Hapus dari keranjang" style="background: none; border: none; color: var(--rose); padding: 5px; cursor: pointer; display: flex; align-items: center;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  const totalEl = document.getElementById('checkoutGrandTotal');
  if (totalEl) totalEl.innerText = window.formatRp(total);
}

function changeCartQtyInCheckout(id, delta) {
  try {
    window.appStore.updateCartQty(id, delta);
  } catch (err) {
    window.showToast(err.message, 'warning');
    return;
  }

  const cart = window.appStore.getState().cart;
  if (cart.length === 0) {
    window.closeSheet('sheetCheckout');
    window.showToast('Keranjang belanja kosong', 'info');
    return;
  }
  renderCheckoutSheetItems();
  calculateCheckoutChange();
  if (checkoutPaymentType === 'debt') {
    renderCheckoutDebtCustomers();
  }
}

function removeCartItemInCheckout(id) {
  window.appStore.removeFromCart(id);
  const cart = window.appStore.getState().cart;
  if (cart.length === 0) {
    window.closeSheet('sheetCheckout');
    window.showToast('Keranjang belanja kosong', 'info');
    return;
  }
  renderCheckoutSheetItems();
  calculateCheckoutChange();
  if (checkoutPaymentType === 'debt') {
    renderCheckoutDebtCustomers();
  }
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
    renderCheckoutDebtCustomers();
  }
}

function renderCheckoutDebtCustomers() {
  const container = document.getElementById('checkoutCustomerSelectList');
  if (!container) return;

  const countBadge = document.getElementById('checkoutActiveDebtCount');
  const debts = (window.appStore.getState().debts || []).filter(d => d.status === 'belum_lunas');
  
  if (countBadge) {
    countBadge.innerText = `${debts.length} Kasbon Aktif`;
  }

  let html = '';
  debts.forEach(d => {
    const remaining = Math.max(0, d.amount - d.paid_amount);
    const initial = (d.customer_name || 'U').trim().charAt(0).toUpperCase();
    html += `
      <div class="customer-debt-tile" id="debtTile_${d.id}" onclick="selectCheckoutDebtCustomer(${JSON.stringify(d.customer_name)}, ${JSON.stringify(d.phone || '')}, ${remaining}, ${d.id})">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="tile-avatar">${initial}</div>
          <div>
            <div style="font-weight: 800; font-size: 13px; color: #fff;">${d.customer_name}</div>
            <div style="font-size: 10px; color: var(--rose);">Sisa Kasbon: ${window.formatRp(remaining)}</div>
          </div>
        </div>
        <div class="tile-radio-circle"></div>
      </div>
    `;
  });

  html += `
    <div class="customer-debt-tile" id="debtTile_new" onclick="selectCheckoutNewCustomer()">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="tile-avatar new">+</div>
        <div>
          <div style="font-weight: 800; font-size: 13px; color: var(--emerald);">+ Nama Pelanggan Baru</div>
          <div style="font-size: 10px; color: var(--text-sub);">Catat nama pelanggan baru</div>
        </div>
      </div>
      <div class="tile-radio-circle"></div>
    </div>
  `;

  container.innerHTML = html;

  if (debts.length > 0) {
    const first = debts[0];
    const rem = Math.max(0, first.amount - first.paid_amount);
    selectCheckoutDebtCustomer(first.customer_name, first.phone || '', rem, first.id);
  } else {
    selectCheckoutNewCustomer();
  }
}

function selectCheckoutDebtCustomer(name, phone, remaining, id) {
  document.querySelectorAll('.customer-debt-tile').forEach(t => t.classList.remove('active'));
  const tile = document.getElementById(`debtTile_${id}`);
  if (tile) tile.classList.add('active');

  const custInput = document.getElementById('checkoutCustomerName');
  const phoneInput = document.getElementById('checkoutCustomerPhone');
  if (custInput) custInput.value = name;
  if (phoneInput) phoneInput.value = phone || '';

  const newBox = document.getElementById('checkoutNewCustomerBox');
  if (newBox) newBox.style.display = 'none';

  const cartTotal = window.appStore.getCartTotal();
  const notice = document.getElementById('checkoutDebtMergeNotice');
  if (notice) {
    notice.style.display = 'block';
    notice.innerHTML = `💡 Belanjaan baru <b>${window.formatRp(cartTotal)}</b> akan otomatis ditambahkan ke kasbon <b>${name}</b>.<br>Total kasbon berjalan: <b style="color: #fff;">${window.formatRp(remaining + cartTotal)}</b>.`;
  }
}

function selectCheckoutNewCustomer() {
  document.querySelectorAll('.customer-debt-tile').forEach(t => t.classList.remove('active'));
  const tile = document.getElementById('debtTile_new');
  if (tile) tile.classList.add('active');

  const newNameInput = document.getElementById('checkoutNewCustNameInput');
  const newPhoneInput = document.getElementById('checkoutNewCustPhoneInput');
  const custInput = document.getElementById('checkoutCustomerName');
  const phoneInput = document.getElementById('checkoutCustomerPhone');

  if (custInput) custInput.value = newNameInput?.value.trim() || '';
  if (phoneInput) phoneInput.value = newPhoneInput?.value.trim() || '';

  const newBox = document.getElementById('checkoutNewCustomerBox');
  if (newBox) newBox.style.display = 'block';

  const notice = document.getElementById('checkoutDebtMergeNotice');
  if (notice) notice.style.display = 'none';

  if (newNameInput) newNameInput.focus();
}

function onNewCustomerNameChange(val) {
  const custInput = document.getElementById('checkoutCustomerName');
  if (custInput) custInput.value = val.trim();
}

function onNewCustomerPhoneChange(val) {
  const phoneInput = document.getElementById('checkoutCustomerPhone');
  if (phoneInput) phoneInput.value = val.trim();
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
      const newNameInput = document.getElementById('checkoutNewCustNameInput');
      customerName = (newNameInput?.value || '').trim();
    }
    if (!customerName) {
      window.showToast('Silakan pilih pelanggan atau isi nama pelanggan baru!', 'warning');
      document.getElementById('checkoutNewCustNameInput')?.focus();
      return;
    }
  }

  const customerPhone = (document.getElementById('checkoutCustomerPhone')?.value || document.getElementById('checkoutNewCustPhoneInput')?.value || '').trim();

  const payload = {
    items: cart.map(c => ({ id: c.id, qty: c.qty })),
    payment_type: checkoutPaymentType,
    cash_received: cashReceived,
    customer_name: customerName,
    customer_phone: customerPhone
  };

  try {
    const res = await window.api.post('/sales', payload);
    if (res.success) {
      const sale = res.data;
      window.appStore.clearCart();
      window.closeSheet('sheetCheckout');

      // Refresh data
      window.loadItems?.();
      window.loadDashboard?.();
      window.loadDebts?.();

      // Show rich success popup modal
      openSuccessModal(sale, 'sale');
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal memproses transaksi', 'error');
  }
}

let currentSuccessTx = null;
let currentSuccessType = 'sale';

function openSuccessModal(data, type = 'sale') {
  currentSuccessTx = data;
  currentSuccessType = type;

  const titleEl = document.getElementById('successModalTitle');
  const subEl = document.getElementById('successModalSubtitle');
  const refEl = document.getElementById('successModalRef');
  const methodEl = document.getElementById('successModalMethod');
  const amountEl = document.getElementById('successModalAmount');
  const totalLabelEl = document.getElementById('successModalTotalLabel');
  const extraRowEl = document.getElementById('successModalExtraRow');
  const extraLabelEl = document.getElementById('successModalExtraLabel');
  const extraValEl = document.getElementById('successModalExtraVal');
  const btnPrint = document.getElementById('btnSuccessPrint');
  const btnShare = document.getElementById('btnSuccessShareWa');

  if (type === 'sale') {
    if (titleEl) titleEl.innerText = 'Transaksi Berhasil!';
    if (subEl) subEl.innerText = 'Pesanan tercatat & stok otomatis terpotong';
    if (refEl) refEl.innerText = data.invoice_no || `INV-${data.id}`;
    
    const isDebt = data.payment_type === 'debt';
    if (methodEl) {
      methodEl.innerText = isDebt ? 'Kasbon / Hutang' : 'Tunai';
      methodEl.style.color = isDebt ? 'var(--rose)' : 'var(--emerald)';
    }

    if (totalLabelEl) totalLabelEl.innerText = 'Total Belanja:';
    if (amountEl) amountEl.innerText = window.formatRp(data.total_amount);

    if (extraRowEl) {
      if (isDebt) {
        extraRowEl.style.display = 'flex';
        if (extraLabelEl) extraLabelEl.innerText = 'Pelanggan:';
        if (extraValEl) {
          extraValEl.innerText = data.customer_name || 'Pelanggan';
          extraValEl.style.color = '#fff';
        }
      } else {
        extraRowEl.style.display = 'flex';
        if (extraLabelEl) extraLabelEl.innerText = 'Kembalian:';
        if (extraValEl) {
          extraValEl.innerText = window.formatRp(data.cash_change || 0);
          extraValEl.style.color = 'var(--emerald)';
        }
      }
    }

    if (btnPrint) btnPrint.style.display = 'flex';
    if (btnShare) {
      btnShare.style.display = 'flex';
      btnShare.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Kirim WA</span>';
    }
  } else if (type === 'debt_payment') {
    if (titleEl) titleEl.innerText = 'Pembayaran Kasbon Berhasil!';
    if (subEl) subEl.innerText = `Catatan kasbon ${data.customer_name} diperbarui`;
    if (refEl) refEl.innerText = `PAY-DEBT-${data.id}`;
    if (methodEl) {
      methodEl.innerText = data.status === 'lunas' ? 'LUNAS' : 'Cicilan Kasbon';
      methodEl.style.color = 'var(--emerald)';
    }

    if (totalLabelEl) totalLabelEl.innerText = 'Nominal Dibayar:';
    if (amountEl) amountEl.innerText = window.formatRp(data.paidAmount || data.paid_amount);

    const remaining = Math.max(0, data.amount - data.paid_amount);
    if (extraRowEl) {
      extraRowEl.style.display = 'flex';
      if (extraLabelEl) extraLabelEl.innerText = 'Sisa Kasbon:';
      if (extraValEl) {
        extraValEl.innerText = window.formatRp(remaining);
        extraValEl.style.color = remaining === 0 ? 'var(--emerald)' : 'var(--rose)';
      }
    }

    if (btnPrint) btnPrint.style.display = 'none';
    if (btnShare) {
      btnShare.style.display = 'flex';
      btnShare.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Kirim Bukti WA</span>';
    }
  }

  window.openSheet('sheetSuccessModal');
}

function onSuccessModalPrint() {
  if (currentSuccessTx && currentSuccessType === 'sale') {
    window.printReceipt?.(currentSuccessTx);
  }
}

function onSuccessModalShareWa() {
  if (!currentSuccessTx) return;
  if (currentSuccessType === 'sale') {
    window.shareReceiptWhatsApp?.(currentSuccessTx, currentSuccessTx.customer_phone || '');
  } else if (currentSuccessType === 'debt_payment') {
    window.sendDebtReminderWhatsApp?.(currentSuccessTx.id);
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
      window.loadDebts?.();
      window.loadDashboard?.();
      openSuccessModal({ ...res.data, paidAmount: amount }, 'debt_payment');
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
window.renderCheckoutDebtCustomers = renderCheckoutDebtCustomers;
window.selectCheckoutDebtCustomer = selectCheckoutDebtCustomer;
window.selectCheckoutNewCustomer = selectCheckoutNewCustomer;
window.onNewCustomerNameChange = onNewCustomerNameChange;
window.onNewCustomerPhoneChange = onNewCustomerPhoneChange;
window.changeCartQtyInCheckout = changeCartQtyInCheckout;
window.removeCartItemInCheckout = removeCartItemInCheckout;
window.openSuccessModal = openSuccessModal;
window.onSuccessModalPrint = onSuccessModalPrint;
window.onSuccessModalShareWa = onSuccessModalShareWa;
