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
  if (!confirm('Hapus catatan kasbon ini?')) return;
  try {
    const res = await window.api.delete(`/debts/${id}`);
    if (res.success) {
      window.appStore.setState({
        debts: window.appStore.getState().debts.filter(d => d.id !== id)
      });
      renderDebtsUI();
      window.showToast('Catatan kasbon dihapus', 'success');
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal menghapus kasbon', 'error');
  }
}

function generateDebtReminderMessage(debt) {
  const remaining = Math.max(0, debt.amount - debt.paid_amount);
  const dateStr = (typeof window !== 'undefined' && window.formatTanggal) ? window.formatTanggal(debt.created_at) : (debt.created_at || '-');

  let text = `Halo Kak *${debt.customer_name}*,\nSalam hangat dari Warung Kami 🙏\n\n`;
  text += `Berikut rincian catatan kasbon yang tercatat:\n`;
  text += `• *Sisa Kasbon* : *Rp ${Number(remaining).toLocaleString('id-ID')}*\n`;
  text += `• *Total Hutang*: Rp ${Number(debt.amount).toLocaleString('id-ID')}\n`;
  text += `• *Tanggal*     : ${dateStr}\n`;
  if (debt.notes) text += `• *Keterangan*  : ${debt.notes}\n`;
  text += `\nJika ada waktu luang, mohon dibantu pelunasannya ya Kak. Terima kasih banyak atas kerjasamanya! 😊`;
  return text;
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
    const phoneInput = prompt(`Nomor WhatsApp untuk ${debt.customer_name}:`, '');
    if (phoneInput) {
      let p = phoneInput.replace(/[^0-9]/g, '');
      if (p.startsWith('0')) p = '62' + p.slice(1);
      window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`, '_blank');
    }
  }
}

function openDirectDebtSheet() {
  const nameEl = document.getElementById('directDebtName');
  const phoneEl = document.getElementById('directDebtPhone');
  const amountEl = document.getElementById('directDebtAmount');
  const notesEl = document.getElementById('directDebtNotes');

  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (amountEl) amountEl.value = '';
  if (notesEl) notesEl.value = '';

  window.openSheet('sheetDirectDebt');
}

async function submitDirectDebt() {
  const name = (document.getElementById('directDebtName')?.value || '').trim();
  const phone = (document.getElementById('directDebtPhone')?.value || '').trim();
  const amount = Number(document.getElementById('directDebtAmount')?.value);
  const notes = (document.getElementById('directDebtNotes')?.value || '').trim();

  if (!name) {
    window.showToast('Nama pelanggan wajib diisi', 'warning');
    return;
  }
  if (!amount || amount <= 0) {
    window.showToast('Nominal kasbon harus lebih dari 0', 'warning');
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
      window.showToast(`Kasbon ${res.data.customer_name} berhasil disimpan!`, 'success');
      loadDebts();
      if (window.loadDashboard) window.loadDashboard();
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal menyimpan kasbon', 'error');
  }
}

if (typeof window !== 'undefined') {
  window.loadDebts = loadDebts;
  window.renderDebtsUI = renderDebtsUI;
  window.deleteDebt = deleteDebt;
  window.openDirectDebtSheet = openDirectDebtSheet;
  window.submitDirectDebt = submitDirectDebt;
  window.generateDebtReminderMessage = generateDebtReminderMessage;
  window.sendDebtReminderWhatsApp = sendDebtReminderWhatsApp;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadDebts, renderDebtsUI, deleteDebt, openDirectDebtSheet, submitDirectDebt, generateDebtReminderMessage, sendDebtReminderWhatsApp };
}
