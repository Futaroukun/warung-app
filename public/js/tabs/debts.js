async function loadDebts() {
  try {
    const res = await window.api.get('/debts');
    if (res.success) {
      window.appStore.setState({ debts: res.data });
      renderDebtsUI();
    }
  } catch (err) {
    console.error('Failed to load debts:', err);
  }
}

function renderDebtCardHtml(debt) {
  const isLunas = debt.status === 'lunas';
  const remaining = Math.max(0, debt.amount - debt.paid_amount);
  const percent = debt.amount > 0 ? Math.min(100, Math.round((debt.paid_amount / debt.amount) * 100)) : 100;
  const initialChar = (debt.customer_name || 'U').trim().charAt(0).toUpperCase();

  return `
    <div class="debt-card ${isLunas ? 'status-lunas' : 'status-unpaid'}" id="card-debt-${debt.id}">
      <div class="debt-card-top">
        <div class="debt-avatar">
          <span>${initialChar}</span>
        </div>
        <div class="debt-meta">
          <div class="debt-title-row">
            <span class="debt-customer-name">${debt.customer_name}</span>
            <span class="badge-debt ${isLunas ? 'lunas' : 'unpaid'}">${isLunas ? 'Lunas' : 'Belum Lunas'}</span>
          </div>
          <div class="debt-sub-row">
            ${debt.phone ? `<span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${debt.phone}</span>` : ''}
            <span>${debt.notes || 'Kasbon'}</span>
          </div>
        </div>
      </div>

      <div class="debt-card-mid">
        <div class="debt-progress-wrap">
          <div class="debt-progress-bar" style="width: ${percent}%;"></div>
        </div>
        <div class="debt-amount-row">
          <div>
            <div class="price-label">Sisa Kasbon</div>
            <div class="debt-remaining-val">${window.formatRp(remaining)}</div>
          </div>
          <div style="text-align: right;">
            <div class="price-label">Total Hutang</div>
            <div class="price-modal">${window.formatRp(debt.amount)}</div>
          </div>
        </div>
        ${debt.items && debt.items.length > 0 ? `
          <div class="debt-items-list" style="background: #090e18; border-radius: 8px; padding: 8px 10px; margin-top: 4px;">
            <div style="font-size: 10px; font-weight: 700; color: var(--text-sub); text-transform: uppercase; margin-bottom: 4px; display: flex; justify-content: space-between;">
              <span>Rincian Barang Kasbon:</span>
              <span>${debt.items.length} Item</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto;">
              ${debt.items.map(it => `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                  <span style="color: var(--text);">${it.qty}x ${it.item_name} <span style="color: var(--text-sub); font-size: 10px;">(@${window.formatRp(it.sell_price)})</span></span>
                  <span style="font-weight: 700; color: #fff;">${window.formatRp(it.subtotal)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="debt-card-bottom" style="display: flex; gap: 6px; align-items: center;">
        ${!isLunas ? `
          <button class="btn-debt-action pay" onclick="openPaySheet(${debt.id})" style="flex: 1;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Bayar</span>
          </button>
          <button class="btn-debt-action wa" onclick="sendDebtReminderWhatsApp(${debt.id})" title="Kirim Pengingat Kasbon via WhatsApp" style="background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.3); padding: 8px 10px; border-radius: 10px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Tagih WA</span>
          </button>
        ` : `
          <div class="debt-lunas-text">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00f59b" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Sudah Lunas</span>
          </div>
        `}
        <button class="btn-icon-subtle" onclick="deleteDebt(${debt.id})" title="Hapus catatan">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderDebtsUI() {
  const container = document.getElementById('debtsListContainer');
  const searchInput = document.getElementById('debtSearchField');
  const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const state = window.appStore.getState();
  const debts = state.debts || [];
  const filter = state.debtFilter || 'belum_lunas';

  const totalUnpaid = debts.filter(d => d.status === 'belum_lunas').reduce((sum, d) => sum + (d.amount - d.paid_amount), 0);
  const unpaidCount = debts.filter(d => d.status === 'belum_lunas').length;

  const totalUnpaidEl = document.getElementById('debtSummaryTotal');
  if (totalUnpaidEl) totalUnpaidEl.innerText = window.formatRp(totalUnpaid);
  const countEl = document.getElementById('debtSummaryCount');
  if (countEl) countEl.innerText = `${unpaidCount} Orang Belum Lunas`;

  // Update active state of filter chips
  const btnUnpaid = document.getElementById('chipDebt_unpaid');
  const btnPaid = document.getElementById('chipDebt_paid');
  const btnAll = document.getElementById('chipDebt_all');
  if (btnUnpaid && btnPaid && btnAll) {
    btnUnpaid.classList.remove('active');
    btnPaid.classList.remove('active');
    btnAll.classList.remove('active');
    if (filter === 'belum_lunas') btnUnpaid.classList.add('active');
    else if (filter === 'lunas') btnPaid.classList.add('active');
    else btnAll.classList.add('active');
  }

  const filtered = debts.filter(d => {
    const matchSearch = !search ||
      d.customer_name.toLowerCase().includes(search) ||
      (d.phone && d.phone.includes(search));
    if (!matchSearch) return false;

    if (filter === 'belum_lunas') return d.status === 'belum_lunas';
    if (filter === 'lunas') return d.status === 'lunas';
    return true;
  });

  if (container) {
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-box" style="text-align: center; padding: 40px 20px; color: var(--text-sub);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; opacity: 0.5;"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          <div style="font-size: 13px; font-weight: 600;">Tidak ada catatan kasbon</div>
        </div>
      `;
    } else {
      container.innerHTML = filtered.map(d => renderDebtCardHtml(d)).join('');
    }
  }
}

async function deleteDebt(id) {
  const executeDelete = async () => {
    try {
      const res = await window.api.delete(`/debts/${id}`);
      if (res.success) {
        window.appStore.setState({
          debts: window.appStore.getState().debts.filter(d => d.id !== id)
        });
        renderDebtsUI();
        window.showToast('Catatan kasbon dihapus', 'success');
        window.triggerRealtimeSync?.('debt_deleted');
      }
    } catch (err) {
      window.showToast(err.message || 'Gagal menghapus kasbon', 'error');
    }
  };

  if (window.showConfirmModal) {
    window.showConfirmModal({
      title: 'Hapus Kasbon',
      message: 'Apakah Anda yakin ingin menghapus catatan kasbon ini?',
      confirmText: 'Ya, Hapus Kasbon',
      onConfirm: executeDelete
    });
  } else {
    if (confirm('Hapus catatan kasbon ini?')) {
      executeDelete();
    }
  }
}

function generateDebtReminderMessage(debt) {
  const remaining = Math.max(0, debt.amount - debt.paid_amount);
  const dateStr = (typeof window !== 'undefined' && window.formatTanggal) ? window.formatTanggal(debt.created_at) : (debt.created_at || '-');
  const storeName = (typeof window !== 'undefined' && window.appStore?.getState()?.storeInfo?.name) || 'Warung Kami';

  const defaultTemplate = 
`Halo Kak *{nama}*,
Salam hangat dari {toko} 🙏

Berikut rincian catatan kasbon yang tercatat:
• *Sisa Kasbon* : *{sisa}*
• *Total Kasbon*: {total}
• *Tanggal*     : {tanggal}
• *Keterangan*  : {rincian}

Jika ada waktu luang, mohon dibantu pelunasannya ya Kak. Terima kasih banyak atas kerjasamanya! 😊`;

  let tmpl = defaultTemplate;
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('custom_debt_reminder_template');
    if (saved && saved.trim()) tmpl = saved.trim();
  }

  const sisaStr = `Rp ${Number(remaining).toLocaleString('id-ID')}`;
  const totalStr = `Rp ${Number(debt.amount).toLocaleString('id-ID')}`;
  const rincianStr = debt.notes ? debt.notes : '-';

  return tmpl
    .replace(/{nama}/g, debt.customer_name || 'Pelanggan')
    .replace(/{sisa}/g, sisaStr)
    .replace(/{total}/g, totalStr)
    .replace(/{tanggal}/g, dateStr)
    .replace(/{rincian}/g, rincianStr)
    .replace(/{toko}/g, storeName);
}

function sendDebtReminderWhatsApp(debtId) {
  const debt = window.appStore.getState().debts.find(d => d.id === debtId);
  if (!debt) return;

  const text = generateDebtReminderMessage(debt);
  let cleanPhone = debt.phone ? debt.phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

  if (cleanPhone) {
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  } else {
    // Open Custom WhatsApp Reminder Modal Sheet
    const remaining = Math.max(0, debt.amount - debt.paid_amount);
    const idEl = document.getElementById('waPromptDebtId');
    const nameEl = document.getElementById('waPromptCustomerName');
    const remainEl = document.getElementById('waPromptRemainingDebt');
    const inputEl = document.getElementById('waPromptPhoneInput');

    if (idEl) idEl.value = debt.id;
    if (nameEl) nameEl.innerText = debt.customer_name;
    if (remainEl) remainEl.innerText = window.formatRp ? window.formatRp(remaining) : `Rp ${remaining.toLocaleString('id-ID')}`;
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 200);
    }

    if (window.openSheet) {
      window.openSheet('sheetCustomWaPrompt');
    }
  }
}

async function submitCustomWaPrompt() {
  const idEl = document.getElementById('waPromptDebtId');
  const inputEl = document.getElementById('waPromptPhoneInput');
  const saveCheckEl = document.getElementById('waPromptSavePhoneCheck');

  const debtId = Number(idEl?.value);
  const rawPhone = (inputEl?.value || '').trim();
  const shouldSave = saveCheckEl ? saveCheckEl.checked : true;

  if (!rawPhone) {
    window.showToast?.('Ketik nomor WhatsApp tujuan', 'warning');
    inputEl?.focus();
    return;
  }

  let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  if (!cleanPhone) {
    window.showToast?.('Nomor WhatsApp tidak valid', 'warning');
    return;
  }
  if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

  const debt = window.appStore?.getState()?.debts?.find(d => d.id === debtId);
  if (!debt) {
    window.closeSheet?.('sheetCustomWaPrompt');
    return;
  }

  // Persist phone number into database
  if (shouldSave && debtId) {
    try {
      await window.api?.put(`/debts/${debtId}`, { phone: rawPhone });
      debt.phone = rawPhone;
      renderDebtsUI?.();
    } catch (err) {
      console.warn('Gagal menyimpan nomor HP ke database:', err);
    }
  }

  const text = generateDebtReminderMessage(debt);
  window.closeSheet?.('sheetCustomWaPrompt');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function toggleDirectDebtDropdown(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const menu = document.getElementById('directDebtDropdownMenu');
  const trigger = document.getElementById('directDebtSelectTrigger');
  if (!menu) return;
  const isHidden = menu.style.display === 'none' || menu.style.display === '';
  menu.style.display = isHidden ? 'block' : 'none';
  if (trigger) {
    if (isHidden) trigger.classList.add('open');
    else trigger.classList.remove('open');
  }
}

function onSelectDirectDebtItem(id) {
  const debts = (window.appStore?.getState()?.debts || []).filter(d => d.status === 'belum_lunas');
  const debt = debts.find(d => Number(d.id) === Number(id));
  if (!debt) return;
  const remaining = Math.max(0, debt.amount - debt.paid_amount);
  selectDirectDebtCustomer(debt.customer_name, debt.phone || '', remaining, debt.id);
}

function renderDirectDebtCustomers() {
  const menuItems = document.getElementById('directDebtDropdownItems');
  const countBadge = document.getElementById('directDebtActiveCount');
  const debts = (window.appStore?.getState()?.debts || []).filter(d => d.status === 'belum_lunas');
  
  if (countBadge) {
    countBadge.innerText = `${debts.length} Kasbon Aktif`;
  }
  if (!menuItems) return;

  if (debts.length === 0) {
    menuItems.innerHTML = '<div style="padding: 10px 14px; font-size: 11px; color: var(--text-sub);">Tidak ada kasbon aktif</div>';
    onPickDirectNewCust();
    return;
  }

  let html = '';
  debts.forEach(d => {
    const remaining = Math.max(0, d.amount - d.paid_amount);
    html += `
      <div class="dropdown-item" id="directDebtItem_${d.id}" onclick="onSelectDirectDebtItem(${d.id})">
        <div>
          <div class="cust-name">${d.customer_name}</div>
          <div style="font-size: 10px; color: var(--text-sub);">${d.phone || 'Tanpa no. HP'}</div>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: var(--rose);">${window.formatRp(remaining)}</div>
      </div>
    `;
  });
  menuItems.innerHTML = html;

  const currentSelected = document.getElementById('directDebtName')?.value;
  const found = debts.find(d => d.customer_name === currentSelected);
  if (found) {
    const rem = Math.max(0, found.amount - found.paid_amount);
    selectDirectDebtCustomer(found.customer_name, found.phone || '', rem, found.id);
  } else {
    const first = debts[0];
    const rem = Math.max(0, first.amount - first.paid_amount);
    selectDirectDebtCustomer(first.customer_name, first.phone || '', rem, first.id);
  }
}

function updateDirectDebtPayerSummary() {
  const nameEl = document.getElementById('directDebtSelectedPayerName');
  const btnEl = document.getElementById('btnSubmitDirectDebt');
  if (!nameEl) return;

  const isNew = document.getElementById('directDebtNewCustomerBox')?.style.display !== 'none';
  let name = '';
  if (isNew) {
    name = (document.getElementById('directDebtNewCustNameInput')?.value || '').trim() || 'Nama Pelanggan Baru';
  } else {
    name = (document.getElementById('directDebtName')?.value || '').trim() || 'Pilih Pelanggan...';
  }
  nameEl.innerText = name;
  if (btnEl) btnEl.innerText = `Simpan Data Kasbon (${name})`;
}

function selectDirectDebtCustomer(name, phone, remaining, id) {
  const textEl = document.getElementById('directDebtSelectedText');
  if (textEl) {
    textEl.innerHTML = `<span style="font-weight: 800; color: var(--emerald);">${name}</span> <span style="font-size: 11px; color: var(--rose); margin-left: 4px;">(${window.formatRp(remaining)})</span>`;
  }

  const menu = document.getElementById('directDebtDropdownMenu');
  const trigger = document.getElementById('directDebtSelectTrigger');
  if (menu) menu.style.display = 'none';
  if (trigger) trigger.classList.remove('open');

  document.querySelectorAll('#directDebtDropdownItems .dropdown-item').forEach(it => it.classList.remove('selected'));
  const itemEl = document.getElementById(`directDebtItem_${id}`);
  if (itemEl) itemEl.classList.add('selected');

  const nameInput = document.getElementById('directDebtName');
  const phoneInput = document.getElementById('directDebtPhone');
  if (nameInput) nameInput.value = name;
  if (phoneInput) phoneInput.value = phone || '';

  const newBox = document.getElementById('directDebtNewCustomerBox');
  if (newBox) newBox.style.display = 'none';

  updateDirectDebtNotice(remaining, name);
  updateDirectDebtPayerSummary();
}

function onPickDirectNewCust() {
  const textEl = document.getElementById('directDebtSelectedText');
  if (textEl) {
    textEl.innerHTML = `<span style="font-weight: 800; color: var(--emerald);">+ Nama Pelanggan Baru</span>`;
  }

  const menu = document.getElementById('directDebtDropdownMenu');
  const trigger = document.getElementById('directDebtSelectTrigger');
  if (menu) menu.style.display = 'none';
  if (trigger) trigger.classList.remove('open');

  document.querySelectorAll('#directDebtDropdownItems .dropdown-item').forEach(it => it.classList.remove('selected'));

  const newName = document.getElementById('directDebtNewCustNameInput');
  const newPhone = document.getElementById('directDebtNewCustPhoneInput');
  const nameInput = document.getElementById('directDebtName');
  const phoneInput = document.getElementById('directDebtPhone');

  if (nameInput) nameInput.value = newName?.value.trim() || '';
  if (phoneInput) phoneInput.value = newPhone?.value.trim() || '';

  const newBox = document.getElementById('directDebtNewCustomerBox');
  if (newBox) newBox.style.display = 'block';

  const notice = document.getElementById('directDebtMergeNotice');
  if (notice) notice.style.display = 'none';

  if (newName) newName.focus();
  updateDirectDebtPayerSummary();
}

const selectDirectDebtNewCustomer = onPickDirectNewCust;

function onDirectDebtNewNameChange(val) {
  const nameInput = document.getElementById('directDebtName');
  if (nameInput) nameInput.value = val.trim();
  updateDirectDebtPayerSummary();
}

function onDirectDebtNewPhoneChange(val) {
  const phoneInput = document.getElementById('directDebtPhone');
  if (phoneInput) phoneInput.value = val.trim();
}

function updateDirectDebtNotice(existingRemaining, custName) {
  const notice = document.getElementById('directDebtMergeNotice');
  if (!notice) return;

  const name = custName || document.getElementById('directDebtName')?.value.trim();
  const debts = window.appStore.getState().debts || [];
  const found = debts.find(d => d.customer_name === name && d.status === 'belum_lunas');

  if (!found) {
    notice.style.display = 'none';
    return;
  }

  const remaining = existingRemaining !== undefined ? existingRemaining : Math.max(0, found.amount - found.paid_amount);
  const amount = Number(document.getElementById('directDebtAmount')?.value) || 0;

  notice.style.display = 'block';
  notice.innerHTML = `💡 Kasbon tambahan sebesar <b>${window.formatRp(amount)}</b> akan otomatis ditambahkan ke kasbon aktif <b>${name}</b>.<br>Total kasbon berjalan menjadi: <b style="color: #fff;">${window.formatRp(remaining + amount)}</b>.`;
}

function openDirectDebtSheet() {
  const amountEl = document.getElementById('directDebtAmount');
  const notesEl = document.getElementById('directDebtNotes');
  const newNameEl = document.getElementById('directDebtNewCustNameInput');
  const newPhoneEl = document.getElementById('directDebtNewCustPhoneInput');

  if (amountEl) amountEl.value = '';
  if (notesEl) notesEl.value = '';
  if (newNameEl) newNameEl.value = '';
  if (newPhoneEl) newPhoneEl.value = '';

  renderDirectDebtCustomers();
  updateDirectDebtPayerSummary();
  window.openSheet('sheetDirectDebt');
}

async function submitDirectDebt() {
  let name = (document.getElementById('directDebtName')?.value || '').trim();
  if (!name) {
    name = (document.getElementById('directDebtNewCustNameInput')?.value || '').trim();
  }
  const phone = (document.getElementById('directDebtPhone')?.value || document.getElementById('directDebtNewCustPhoneInput')?.value || '').trim();
  const amount = Number(document.getElementById('directDebtAmount')?.value);
  const notes = (document.getElementById('directDebtNotes')?.value || '').trim();

  if (!name) {
    window.showToast('Silakan pilih pelanggan atau isi nama pelanggan baru!', 'warning');
    document.getElementById('directDebtNewCustNameInput')?.focus();
    return;
  }
  if (!amount || amount <= 0) {
    window.showToast('Nominal kasbon harus lebih dari 0', 'warning');
    document.getElementById('directDebtAmount')?.focus();
    return;
  }

  try {
    const res = await window.api.post('/debts', {
      customer_name: name,
      phone,
      amount,
      notes
    });

    if (res.success) {
      window.closeSheet('sheetDirectDebt');
      loadDebts();
      if (window.loadDashboard) window.loadDashboard();
      window.triggerRealtimeSync?.('direct_debt_created');
      window.openSuccessModal?.(res.data, 'debt_payment');
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal menyimpan kasbon', 'error');
  }
}

function setDebtFilter(filter) {
  window.appStore.setState({ debtFilter: filter });
  renderDebtsUI();
}

if (typeof window !== 'undefined') {
  window.loadDebts = loadDebts;
  window.renderDebtsUI = renderDebtsUI;
  window.setDebtFilter = setDebtFilter;
  window.deleteDebt = deleteDebt;
  window.toggleDirectDebtDropdown = toggleDirectDebtDropdown;
  window.onSelectDirectDebtItem = onSelectDirectDebtItem;
  window.onPickDirectNewCust = onPickDirectNewCust;
  window.renderDirectDebtCustomers = renderDirectDebtCustomers;
  window.selectDirectDebtCustomer = selectDirectDebtCustomer;
  window.selectDirectDebtNewCustomer = selectDirectDebtNewCustomer;
  window.onDirectDebtNewNameChange = onDirectDebtNewNameChange;
  window.onDirectDebtNewPhoneChange = onDirectDebtNewPhoneChange;
  window.updateDirectDebtNotice = updateDirectDebtNotice;
  window.updateDirectDebtPayerSummary = updateDirectDebtPayerSummary;
  window.openDirectDebtSheet = openDirectDebtSheet;
  window.submitDirectDebt = submitDirectDebt;
  window.generateDebtReminderMessage = generateDebtReminderMessage;
  window.sendDebtReminderWhatsApp = sendDebtReminderWhatsApp;
  window.submitCustomWaPrompt = submitCustomWaPrompt;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadDebts,
    renderDebtsUI,
    setDebtFilter,
    deleteDebt,
    toggleDirectDebtDropdown,
    onSelectDirectDebtItem,
    onPickDirectNewCust,
    renderDirectDebtCustomers,
    selectDirectDebtCustomer,
    selectDirectDebtNewCustomer,
    onDirectDebtNewNameChange,
    onDirectDebtNewPhoneChange,
    updateDirectDebtNotice,
    updateDirectDebtPayerSummary,
    openDirectDebtSheet,
    submitDirectDebt,
    generateDebtReminderMessage,
    sendDebtReminderWhatsApp,
    submitCustomWaPrompt
  };
}
