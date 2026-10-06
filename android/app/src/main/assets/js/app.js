// Global application router and master event wiring

// ================= REAL-TIME ENGINE =================
let realtimeChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    realtimeChannel = new BroadcastChannel('warung_realtime_sync');
    realtimeChannel.onmessage = (event) => {
      if (event?.data?.type === 'SYNC_DATA') {
        syncAllDataRealtime(true);
      }
    };
  }
} catch (err) {
  console.warn('BroadcastChannel not supported:', err);
}

// Cross-tab / storage fallback
window.addEventListener('storage', (e) => {
  if (e.key === 'warung_realtime_sync_event') {
    syncAllDataRealtime(true);
  }
});

function triggerRealtimeSync(actionName = 'data_changed') {
  if (realtimeChannel) {
    try {
      realtimeChannel.postMessage({ type: 'SYNC_DATA', action: actionName, timestamp: Date.now() });
    } catch (e) {}
  }
  try {
    localStorage.setItem('warung_realtime_sync_event', `${actionName}_${Date.now()}`);
  } catch (e) {}
  syncAllDataRealtime(true);
}

let isSyncingRealtime = false;
async function syncAllDataRealtime(force = false) {
  if (isSyncingRealtime && !force) return;
  isSyncingRealtime = true;

  try {
    const currentTab = window.appStore?.getState()?.activeTab || 'pos';

    if (currentTab === 'pos') {
      await window.loadItems?.();
    } else if (currentTab === 'barcode') {
      await window.loadMasterBarcodes?.();
    } else if (currentTab === 'debts') {
      await window.loadDebts?.();
    } else if (currentTab === 'history') {
      await window.loadHistory?.();
    } else if (currentTab === 'dashboard') {
      await window.loadDashboard?.();
    } else if (currentTab === 'system') {
      await window.checkSystemHealth?.();
    }

    // Always keep debts synced in background for POS dropdown
    if (currentTab !== 'debts' && window.api) {
      window.api.get('/debts').then(res => {
        if (res?.success) window.appStore?.setState({ debts: res.data });
      }).catch(() => {});
    }
  } catch (err) {
    // silent
  } finally {
    isSyncingRealtime = false;
  }
}

// Background Heartbeat Polling: sync automatically every 3.5s when page is visible
setInterval(() => {
  if (typeof document !== 'undefined' && !document.hidden) {
    syncAllDataRealtime(false);
  }
}, 3500);

// Auto-sync on window focus and visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncAllDataRealtime(true);
});

window.addEventListener('focus', () => {
  syncAllDataRealtime(true);
});

let previousTabBeforeSystem = 'pos';

function toggleSettingsTab() {
  const currentTab = window.appStore?.getState()?.activeTab || 'pos';
  if (currentTab === 'system') {
    switchMainTab(previousTabBeforeSystem || 'pos');
  } else {
    previousTabBeforeSystem = currentTab;
    switchMainTab('system');
  }
}

function switchMainTab(tab) {
  const currentTab = window.appStore?.getState()?.activeTab || 'pos';
  if (currentTab !== 'system' && tab === 'system') {
    previousTabBeforeSystem = currentTab;
  }

  // Update buttons
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btnNav_${tab}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update top header settings button (Toggle between gear icon & back arrow)
  const topSettingsBtn = document.getElementById('btnTopSettings');
  if (topSettingsBtn) {
    if (tab === 'system') {
      topSettingsBtn.title = 'Kembali';
      topSettingsBtn.setAttribute('aria-label', 'Kembali');
      topSettingsBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      `;
    } else {
      topSettingsBtn.title = 'Pengaturan & Backup';
      topSettingsBtn.setAttribute('aria-label', 'Pengaturan & Backup');
      topSettingsBtn.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      `;
    }
  }

  // Update panels
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const activePane = document.getElementById(`tab_${tab}`);
  if (activePane) activePane.classList.add('active');

  window.appStore.setState({ activeTab: tab });

  // Refresh view data
  if (tab === 'dashboard') window.loadDashboard?.();
  if (tab === 'pos') window.renderItemsUI?.();
  if (tab === 'barcode') window.loadMasterBarcodes?.();
  if (tab === 'debts') window.loadDebts?.();
  if (tab === 'history') window.loadHistory?.();
  if (tab === 'system') {
    window.loadDebtTemplateSetting?.();
    window.loadOnlineBarcodeSetting?.();
    window.checkSystemHealth?.();
  }
}

// Checkout Modal Workflow
let checkoutPaymentType = 'cash';
let cashBuyerType = 'umum';

function updateCheckoutPayerSummary() {
  const nameEl = document.getElementById('checkoutSelectedPayerName');
  const badgeEl = document.getElementById('checkoutSelectedPayerBadge');
  const btnEl = document.getElementById('btnSubmitCheckout');
  const bannerEl = document.getElementById('checkoutSelectedPayerBanner');
  if (!nameEl) return;

  if (checkoutPaymentType === 'cash') {
    if (badgeEl) {
      badgeEl.innerText = 'TUNAI';
      badgeEl.style.color = 'var(--emerald)';
      badgeEl.style.background = 'rgba(0, 245, 155, 0.2)';
    }
    if (bannerEl) {
      bannerEl.style.borderColor = 'var(--emerald)';
      bannerEl.style.background = 'rgba(16, 185, 129, 0.12)';
    }

    let displayName = 'Pembeli Umum';
    if (cashBuyerType === 'pegawai') {
      displayName = 'Pegawai';
    } else if (cashBuyerType === 'custom') {
      const customName = (document.getElementById('checkoutCashBuyerName')?.value || '').trim();
      displayName = customName || 'Nama Belum Diisi';
    }
    nameEl.innerText = displayName;
    nameEl.style.color = '#ffffff';

    if (btnEl) btnEl.innerText = `Selesaikan Transaksi Tunai (${displayName})`;
  } else {
    if (badgeEl) {
      badgeEl.innerText = 'KASBON';
      badgeEl.style.color = 'var(--rose)';
      badgeEl.style.background = 'rgba(255, 59, 92, 0.2)';
    }
    if (bannerEl) {
      bannerEl.style.borderColor = 'var(--rose)';
      bannerEl.style.background = 'rgba(255, 59, 92, 0.12)';
    }

    const isNew = document.getElementById('checkoutNewCustomerBox')?.style.display !== 'none';
    let debtName = '';
    if (isNew) {
      debtName = (document.getElementById('checkoutNewCustNameInput')?.value || '').trim() || 'Nama Pelanggan Baru';
    } else {
      debtName = (document.getElementById('checkoutCustomerName')?.value || '').trim() || 'Pilih Pelanggan...';
    }
    nameEl.innerText = debtName;
    nameEl.style.color = 'var(--rose)';

    if (btnEl) btnEl.innerText = `Simpan Transaksi Kasbon (${debtName})`;
  }
}

function setCashBuyerType(type) {
  cashBuyerType = type;
  document.querySelectorAll('#checkoutCashSection .btn-preset-mini').forEach(b => {
    if (b.id && b.id.startsWith('btnBuyerType_')) {
      b.classList.remove('active');
    }
  });
  const activeBtn = document.getElementById(`btnBuyerType_${type}`);
  if (activeBtn) activeBtn.classList.add('active');

  const customWrap = document.getElementById('cashBuyerCustomNameWrap');
  const customInput = document.getElementById('checkoutCashBuyerName');
  if (type === 'custom') {
    if (customWrap) customWrap.style.display = 'block';
    if (customInput) customInput.focus();
  } else {
    if (customWrap) customWrap.style.display = 'none';
  }
  updateCheckoutPayerSummary();
}

function openCheckoutSheet() {
  const cart = window.appStore.getState().cart;
  if (cart.length === 0) {
    window.showToast('Keranjang belanja masih kosong', 'warning');
    return;
  }

  // Preload debts so active customers are instantly available
  window.loadDebts?.();

  renderCheckoutSheetItems();
  setCheckoutPaymentType('cash');
  setCashBuyerType('umum');
  const customBuyerName = document.getElementById('checkoutCashBuyerName');
  if (customBuyerName) customBuyerName.value = '';

  const cashInput = document.getElementById('checkoutCashReceived');
  if (cashInput) {
    cashInput.value = '';
  }
  calculateCheckoutChange();
  updateCheckoutPayerSummary();
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

async function setCheckoutPaymentType(type) {
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
    if (window.loadDebts) {
      await window.loadDebts();
    }
    renderCheckoutDebtCustomers();
  }
  updateCheckoutPayerSummary();
}

function toggleCheckoutDebtDropdown(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const menu = document.getElementById('checkoutDebtDropdownMenu');
  const trigger = document.getElementById('checkoutDebtSelectTrigger');
  if (!menu) return;
  const isHidden = menu.style.display === 'none' || menu.style.display === '';
  menu.style.display = isHidden ? 'block' : 'none';
  if (trigger) {
    if (isHidden) trigger.classList.add('open');
    else trigger.classList.remove('open');
  }
}

function onSelectCheckoutDebtItem(id) {
  const debts = (window.appStore.getState().debts || []).filter(d => d.status === 'belum_lunas');
  const debt = debts.find(d => Number(d.id) === Number(id));
  if (!debt) return;
  const remaining = Math.max(0, debt.amount - debt.paid_amount);
  selectCheckoutDebtCustomer(debt.customer_name, debt.phone || '', remaining, debt.id);
}

function renderCheckoutDebtCustomers() {
  const menuItems = document.getElementById('checkoutDebtDropdownItems');
  const countBadge = document.getElementById('checkoutActiveDebtCount');
  const debts = (window.appStore.getState().debts || []).filter(d => d.status === 'belum_lunas');
  
  if (countBadge) {
    countBadge.innerText = `${debts.length} Kasbon Aktif`;
  }
  if (!menuItems) return;

  if (debts.length === 0) {
    menuItems.innerHTML = '<div style="padding: 10px 14px; font-size: 11px; color: var(--text-sub);">Tidak ada kasbon aktif</div>';
    onPickCheckoutNewCust();
    return;
  }

  let html = '';
  debts.forEach(d => {
    const remaining = Math.max(0, d.amount - d.paid_amount);
    html += `
      <div class="dropdown-item" id="checkoutDebtItem_${d.id}" onclick="onSelectCheckoutDebtItem(${d.id})">
        <div>
          <div class="cust-name">${d.customer_name}</div>
          <div style="font-size: 10px; color: var(--text-sub);">${d.phone || 'Tanpa no. HP'}</div>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: var(--rose);">${window.formatRp(remaining)}</div>
      </div>
    `;
  });
  menuItems.innerHTML = html;

  const currentSelected = document.getElementById('checkoutCustomerName')?.value;
  const found = debts.find(d => d.customer_name === currentSelected);
  if (found) {
    const rem = Math.max(0, found.amount - found.paid_amount);
    selectCheckoutDebtCustomer(found.customer_name, found.phone || '', rem, found.id);
  } else {
    const first = debts[0];
    const rem = Math.max(0, first.amount - first.paid_amount);
    selectCheckoutDebtCustomer(first.customer_name, first.phone || '', rem, first.id);
  }
}

function selectCheckoutDebtCustomer(name, phone, remaining, id) {
  const textEl = document.getElementById('checkoutDebtSelectedText');
  if (textEl) {
    textEl.innerHTML = `<span style="font-weight: 800; color: var(--emerald);">${name}</span> <span style="font-size: 11px; color: var(--rose); margin-left: 4px;">(${window.formatRp(remaining)})</span>`;
  }

  const menu = document.getElementById('checkoutDebtDropdownMenu');
  const trigger = document.getElementById('checkoutDebtSelectTrigger');
  if (menu) menu.style.display = 'none';
  if (trigger) trigger.classList.remove('open');

  document.querySelectorAll('#checkoutDebtDropdownItems .dropdown-item').forEach(it => it.classList.remove('selected'));
  const itemEl = document.getElementById(`checkoutDebtItem_${id}`);
  if (itemEl) itemEl.classList.add('selected');

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
    notice.innerHTML = `💡 Belanjaan baru <b>${window.formatRp(cartTotal)}</b> otomatis ditambahkan ke kasbon <b>${name}</b>.<br>Total kasbon berjalan: <b style="color: #fff;">${window.formatRp(remaining + cartTotal)}</b>.`;
  }

  updateCheckoutPayerSummary();
}

function onPickCheckoutNewCust() {
  const textEl = document.getElementById('checkoutDebtSelectedText');
  if (textEl) {
    textEl.innerHTML = `<span style="font-weight: 800; color: var(--emerald);">Nama Pelanggan Baru</span>`;
  }

  const menu = document.getElementById('checkoutDebtDropdownMenu');
  const trigger = document.getElementById('checkoutDebtSelectTrigger');
  if (menu) menu.style.display = 'none';
  if (trigger) trigger.classList.remove('open');

  document.querySelectorAll('#checkoutDebtDropdownItems .dropdown-item').forEach(it => it.classList.remove('selected'));

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
  updateCheckoutPayerSummary();
}

const selectCheckoutNewCustomer = onPickCheckoutNewCust;

function onNewCustomerNameChange(val) {
  const custInput = document.getElementById('checkoutCustomerName');
  if (custInput) custInput.value = val.trim();
  updateCheckoutPayerSummary();
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

    if (cashBuyerType === 'pegawai') {
      customerName = 'Pegawai';
    } else if (cashBuyerType === 'custom') {
      customerName = (document.getElementById('checkoutCashBuyerName')?.value || '').trim() || 'Umum';
    } else {
      customerName = 'Umum';
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

  const customerPhone = (checkoutPaymentType === 'debt') ? (document.getElementById('checkoutCustomerPhone')?.value || document.getElementById('checkoutNewCustPhoneInput')?.value || '').trim() : '';

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

      // Refresh data and broadcast realtime
      window.loadItems?.();
      window.loadDashboard?.();
      window.loadDebts?.();
      window.loadHistory?.();
      triggerRealtimeSync('sale_created');

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
    const hasPhone = Boolean((data.customer_phone || '').trim());
    if (btnShare) {
      if (isDebt || hasPhone) {
        btnShare.style.display = 'flex';
        btnShare.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Kirim WA</span>';
      } else {
        btnShare.style.display = 'none';
      }
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
function openBarcodeScanner(mode = 'kasir') {
  window.unlockAudio?.();
  const videoEl = document.getElementById('scannerVideo');
  if (!videoEl) return;

  if (window.setScannerMode) {
    window.setScannerMode(mode);
  }

  const isRestock = mode === 'restock';
  const loadingText = document.getElementById('scannerLoadingText');
  if (loadingText) loadingText.style.display = 'flex';
  videoEl.style.opacity = '0';

  window.openSheet('sheetScanner');
  window.startScanner(videoEl, (barcode, meta) => {
    window.handleBarcodeScanned?.(barcode, meta);
  }, { continuous: isRestock }).catch(err => {
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
  const delBtn = document.getElementById('btnDeleteItem');

  if (item && item.id) {
    if (titleEl) titleEl.innerText = 'Edit Produk';
    if (idInput) idInput.value = item.id;
    if (delBtn) delBtn.style.display = 'block';
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
    if (delBtn) delBtn.style.display = 'none';
    if (barcodeInput) barcodeInput.value = (item && item.barcode) ? item.barcode : '';
    if (nameInput) nameInput.value = (item && item.name) ? item.name : '';
    if (catInput) catInput.value = 'Umum';
    if (buyInput) buyInput.value = '';
    if (sellInput) sellInput.value = '';
    if (stockInput) stockInput.value = '';
    if (minStockInput) minStockInput.value = '3';
  }

  const statusEl = document.getElementById('barcodeOnlineStatus');
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
  }

  window.openSheet('sheetItem');

  // If new item has barcode and name is empty, auto-lookup online in background
  const initBarcode = (item && item.barcode) ? String(item.barcode).trim() : '';
  const initName = (item && item.name) ? String(item.name).trim() : '';
  if (initBarcode && !initName) {
    setTimeout(() => {
      fetchAndFillOnlineName(initBarcode, true);
    }, 250);
  }
}

let barcodeInputDebounce = null;
function onBarcodeFieldInput(val) {
  clearTimeout(barcodeInputDebounce);
  const statusEl = document.getElementById('barcodeOnlineStatus');
  if (statusEl) statusEl.style.display = 'none';

  const clean = String(val || '').trim();
  const nameInput = document.getElementById('itemNameField');
  if (clean.length >= 8 && (!nameInput || !nameInput.value.trim())) {
    barcodeInputDebounce = setTimeout(() => {
      fetchAndFillOnlineName(clean, true);
    }, 700);
  }
}

async function fetchAndFillOnlineName(barcode = null, isAuto = false) {
  const barcodeInput = document.getElementById('itemBarcodeField');
  const code = (barcode || barcodeInput?.value || '').trim();
  if (!code) {
    if (!isAuto) window.showToast?.('Ketik atau scan barcode terlebih dahulu', 'warning');
    return;
  }

  // Check setting preference
  if (isAuto && typeof localStorage !== 'undefined' && localStorage.getItem('setting_online_barcode') === 'false') {
    return;
  }

  const nameInput = document.getElementById('itemNameField');
  const catInput = document.getElementById('itemCategoryField');
  const btnFetch = document.getElementById('btnFetchOnlineBarcode');
  const btnText = document.getElementById('btnFetchOnlineText');
  const statusEl = document.getElementById('barcodeOnlineStatus');

  if (isAuto && nameInput && nameInput.value.trim() !== '') {
    return;
  }

  if (btnText) btnText.textContent = 'Mencari...';
  if (btnFetch) btnFetch.disabled = true;
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--text-sub)';
    statusEl.textContent = '🔍 Mencari data produk online...';
  }

  try {
    const data = await (window.fetchOnlineBarcodeProduct ? window.fetchOnlineBarcodeProduct(code) : null);
    if (data && data.name) {
      if (nameInput && (!isAuto || !nameInput.value.trim())) {
        nameInput.value = data.name;
      }
      if (catInput && (!catInput.value || catInput.value === 'Umum') && data.category) {
        catInput.value = data.category;
      }
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--emerald)';
        statusEl.textContent = `✓ Ditemukan: ${data.name}`;
      }
      window.showToast?.(`✓ Ditemukan: ${data.name}`, 'success');
    } else {
      if (statusEl) {
        statusEl.style.color = 'var(--text-muted)';
        statusEl.textContent = 'Produk tidak ditemukan online';
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2500);
      }
      if (!isAuto) {
        window.showToast?.('Data produk tidak ditemukan online. Silakan isi manual.', 'info');
      }
    }
  } catch (err) {
    if (statusEl) statusEl.style.display = 'none';
    if (!isAuto) {
      window.showToast?.('Gagal menghubungi database online: ' + err.message, 'error');
    }
  } finally {
    if (btnText) btnText.textContent = 'Cari Online';
    if (btnFetch) btnFetch.disabled = false;
  }
}

async function deleteCurrentItem() {
  const id = document.getElementById('itemIdField')?.value;
  const name = document.getElementById('itemNameField')?.value || 'produk ini';
  if (!id) return;

  const executeDelete = async () => {
    try {
      const res = await window.api.delete(`/items/${id}?permanent=true`);
      if (res.success) {
        window.closeSheet('sheetConfirmDialog');
        window.closeSheet('sheetItem');
        window.showToast(`Produk "${name}" berhasil dihapus`, 'success');
        window.appStore.removeFromCart(Number(id));
        window.loadItems?.();
        window.loadMasterBarcodes?.();
        window.loadDashboard?.();
        triggerRealtimeSync('item_deleted');
      }
    } catch (err) {
      window.showToast(err.message || 'Gagal menghapus produk', 'error');
    }
  };

  if (window.showConfirmModal) {
    window.showConfirmModal({
      title: 'Hapus Produk',
      message: `Apakah Anda yakin ingin menghapus produk "${name}" dari katalog?`,
      confirmText: 'Ya, Hapus Produk',
      onConfirm: executeDelete
    });
  } else {
    if (confirm(`Hapus produk "${name}" dari katalog?`)) {
      executeDelete();
    }
  }
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
      window.loadMasterBarcodes?.();
      window.loadDashboard?.();
      triggerRealtimeSync('item_saved');
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
      window.loadHistory?.();
      triggerRealtimeSync('debt_paid');
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
  window.loadMasterBarcodes?.();
  window.loadDebts?.();

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
window.toggleSettingsTab = toggleSettingsTab;
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
window.setCashBuyerType = setCashBuyerType;
window.deleteCurrentItem = deleteCurrentItem;
window.onSelectCheckoutDebtItem = onSelectCheckoutDebtItem;
window.toggleCheckoutDebtDropdown = toggleCheckoutDebtDropdown;
window.onPickCheckoutNewCust = onPickCheckoutNewCust;
window.renderCheckoutDebtCustomers = renderCheckoutDebtCustomers;
window.selectCheckoutDebtCustomer = selectCheckoutDebtCustomer;
window.selectCheckoutNewCustomer = selectCheckoutNewCustomer;
window.onNewCustomerNameChange = onNewCustomerNameChange;
window.onNewCustomerPhoneChange = onNewCustomerPhoneChange;
window.changeCartQtyInCheckout = changeCartQtyInCheckout;
window.removeCartItemInCheckout = removeCartItemInCheckout;
window.updateCheckoutPayerSummary = updateCheckoutPayerSummary;
window.openSuccessModal = openSuccessModal;
window.onSuccessModalPrint = onSuccessModalPrint;
window.onSuccessModalShareWa = onSuccessModalShareWa;
window.submitCustomWaPrompt = window.submitCustomWaPrompt || submitCustomWaPrompt;
window.saveDebtTemplateSetting = window.saveDebtTemplateSetting || saveDebtTemplateSetting;
window.resetDebtTemplateToDefault = window.resetDebtTemplateToDefault || resetDebtTemplateToDefault;
window.insertReminderTag = window.insertReminderTag || insertReminderTag;
window.onBarcodeFieldInput = onBarcodeFieldInput;
window.fetchAndFillOnlineName = fetchAndFillOnlineName;
window.triggerRealtimeSync = triggerRealtimeSync;
window.syncAllDataRealtime = syncAllDataRealtime;

// Click outside handler for dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('#checkoutSelectWrap')) {
    const m = document.getElementById('checkoutDebtDropdownMenu');
    const t = document.getElementById('checkoutDebtSelectTrigger');
    if (m) m.style.display = 'none';
    if (t) t.classList.remove('open');
  }
  if (!e.target.closest('#directDebtSelectWrap')) {
    const m = document.getElementById('directDebtDropdownMenu');
    const t = document.getElementById('directDebtSelectTrigger');
    if (m) m.style.display = 'none';
    if (t) t.classList.remove('open');
  }
  if (!e.target.closest('#batchRestockSearchField') && !e.target.closest('#batchRestockDropdown')) {
    const d = document.getElementById('batchRestockDropdown');
    if (d) d.style.display = 'none';
  }
});

// Auto-capitalization handling for text inputs and textareas
document.addEventListener('input', (e) => {
  const target = e.target;
  if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (target.type !== 'text' && target.type !== 'search' && target.tagName !== 'TEXTAREA') return;

  const mode = target.getAttribute('autocapitalize');
  if (!mode || mode === 'none' || mode === 'off') return;

  const originalVal = target.value;
  let formatted = originalVal;

  if (mode === 'words') {
    formatted = window.autoCapitalizeWords ? window.autoCapitalizeWords(originalVal) : originalVal;
  } else if (mode === 'sentences') {
    formatted = window.autoCapitalizeSentences ? window.autoCapitalizeSentences(originalVal) : originalVal;
  } else if (mode === 'characters') {
    formatted = originalVal.toUpperCase();
  }

  if (formatted !== originalVal) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.value = formatted;
    if (typeof start === 'number' && typeof end === 'number') {
      try {
        target.setSelectionRange(start, end);
      } catch (err) {}
    }
  }
}, true);

document.addEventListener('blur', (e) => {
  const target = e.target;
  if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  const mode = target.getAttribute('autocapitalize');
  if (mode === 'words' && target.value) {
    target.value = window.toTitleCase ? window.toTitleCase(target.value) : target.value.trim();
  }
}, true);

// Matikan seleksi teks dan menu context popup kecuali pada input/textarea
document.addEventListener('selectstart', (e) => {
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
    e.preventDefault();
  }
}, false);

document.addEventListener('contextmenu', (e) => {
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
    e.preventDefault();
  }
}, false);

