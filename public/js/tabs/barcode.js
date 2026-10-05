/**
 * tabs/barcode.js - Master Barcode Catalog & Quick Restock Management
 */

let masterBarcodes = [];
let barcodeFilter = 'all'; // 'all' | 'instock' | 'empty'
let currentRestockItem = null;

async function loadMasterBarcodes() {
  try {
    if (window.api) {
      const res = await window.api.get('/items?include_all=true');
      if (res && res.success && Array.isArray(res.data)) {
        masterBarcodes = res.data;
        renderMasterBarcodesUI();
      }
    }
  } catch (err) {
    console.error('Failed to load master barcodes:', err);
  }
}

function renderMasterBarcodesUI() {
  const container = document.getElementById('masterBarcodeListContainer');
  if (!container) return;

  const searchInput = document.getElementById('barcodeSearchField');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = masterBarcodes.filter(it => {
    // Search filter
    const matchesSearch = !query || 
      (it.name || '').toLowerCase().includes(query) || 
      (it.barcode || '').toLowerCase().includes(query) ||
      (it.category || '').toLowerCase().includes(query);
    if (!matchesSearch) return false;

    // Chip filter
    if (barcodeFilter === 'all') return it.is_active !== 0;
    if (barcodeFilter === 'instock') return it.is_active !== 0 && (it.stock || 0) > 0;
    if (barcodeFilter === 'empty') return (it.is_active !== 0 && (it.stock || 0) <= 0) || it.is_active === 0;
    return true;
  });

  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Update stat counts
  const totalCount = masterBarcodes.filter(it => it.is_active !== 0).length;
  const inStockCount = masterBarcodes.filter(it => it.is_active !== 0 && (it.stock || 0) > 0).length;
  const emptyCount = masterBarcodes.filter(it => it.is_active !== 0 && (it.stock || 0) <= 0).length;

  const countTotalEl = document.getElementById('barcodeCountTotal');
  const countInStockEl = document.getElementById('barcodeCountInStock');
  const countEmptyEl = document.getElementById('barcodeCountEmpty');
  if (countTotalEl) countTotalEl.innerText = totalCount;
  if (countInStockEl) countInStockEl.innerText = inStockCount;
  if (countEmptyEl) countEmptyEl.innerText = emptyCount;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: var(--text-sub);">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--bg-surface); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
        </div>
        <div style="font-weight: 700; color: #fff; font-size: 14px;">Tidak Ada Barcode Ditemukan</div>
        <div style="font-size: 12px; margin-top: 4px;">Daftarkan barcode baru atau sesuaikan kata kunci pencarian.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isArchived = item.is_active === 0;
    const stockQty = item.stock || 0;
    const barcodeDisplay = item.barcode ? item.barcode : '<span style="color: var(--text-muted); font-style: italic;">Tanpa Barcode</span>';
    
    let stockBadge = '';
    if (isArchived) {
      stockBadge = `<span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); color: var(--text-sub);">Tersimpan (Nonaktif)</span>`;
    } else if (stockQty > 0) {
      stockBadge = `<span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: rgba(0, 245, 155, 0.15); color: var(--emerald);">Stok: ${stockQty} ${item.unit || 'pcs'}</span>`;
    } else {
      stockBadge = `<span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: rgba(244, 63, 94, 0.15); color: var(--rose);">Stok Habis</span>`;
    }

    const itemJsonEscaped = JSON.stringify(item).replace(/"/g, '&quot;');

    return `
      <div class="master-barcode-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
              <span style="font-family: monospace; font-size: 11px; font-weight: 800; background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); color: var(--emerald);">
                ${barcodeDisplay}
              </span>
              <span style="font-size: 10px; font-weight: 700; color: var(--text-sub); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">
                ${item.category || 'Umum'}
              </span>
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #fff; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${item.name}
            </div>
          </div>
          <div>${stockBadge}</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; background: var(--bg-surface); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border);">
          <div>
            <span style="color: var(--text-sub); font-size: 10px; display: block;">Modal (HPP):</span>
            <span style="font-weight: 700; color: var(--amber);">${window.formatRp ? window.formatRp(item.buy_price) : 'Rp ' + item.buy_price}</span>
          </div>
          <div style="text-align: right;">
            <span style="color: var(--text-sub); font-size: 10px; display: block;">Harga Jual:</span>
            <span style="font-weight: 800; color: var(--emerald);">${window.formatRp ? window.formatRp(item.sell_price) : 'Rp ' + item.sell_price}</span>
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 2px;">
          <button type="button" class="btn" onclick="openQuickRestockModal(${item.id})" style="flex: 2; padding: 9px 8px; font-size: 12px; font-weight: 800; background: rgba(0, 245, 155, 0.15); border: 1px solid rgba(0, 245, 155, 0.3); color: var(--emerald); display: flex; align-items: center; justify-content: center; gap: 5px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Tambah Stok</span>
          </button>
          <button type="button" class="btn" onclick="openItemSheet(masterBarcodes.find(i => i.id === ${item.id}))" style="flex: 1; padding: 9px 8px; font-size: 12px; font-weight: 700; background: var(--bg-surface); border: 1px solid var(--border); color: #fff;">
            Edit
          </button>
          <button type="button" class="btn-icon-subtle" onclick="deleteMasterBarcode(${item.id}, '${item.name.replace(/'/g, "\\'")}')" title="Hapus barcode" style="padding: 6px 10px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" stroke-width="2.2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function setBarcodeFilter(filter) {
  barcodeFilter = filter;
  ['all', 'instock', 'empty'].forEach(f => {
    const el = document.getElementById(`chipBarcode_${f}`);
    if (el) {
      if (f === filter) el.classList.add('active');
      else el.classList.remove('active');
    }
  });
  renderMasterBarcodesUI();
}

function openQuickRestockModal(itemOrId) {
  const item = (typeof itemOrId === 'object' && itemOrId !== null) ? itemOrId : masterBarcodes.find(i => i.id === Number(itemOrId));
  if (!item) return;

  currentRestockItem = item;

  const nameEl = document.getElementById('restockItemName');
  const barcodeEl = document.getElementById('restockItemBarcode');
  const currentStockEl = document.getElementById('restockCurrentStock');
  const qtyInput = document.getElementById('restockQtyInput');

  if (nameEl) nameEl.innerText = item.name;
  if (barcodeEl) barcodeEl.innerText = item.barcode ? `Barcode: ${item.barcode}` : 'Tanpa Barcode';
  if (currentStockEl) currentStockEl.innerText = `${item.stock || 0} ${item.unit || 'pcs'}`;
  if (qtyInput) qtyInput.value = '1';

  updateRestockPreview();
  window.openSheet('sheetQuickRestock');
}

function updateRestockPreview() {
  if (!currentRestockItem) return;
  const qtyInput = document.getElementById('restockQtyInput');
  const totalPreviewEl = document.getElementById('restockTotalPreview');
  const addQty = Math.max(1, Number(qtyInput?.value) || 1);
  const current = currentRestockItem.stock || 0;
  const finalStock = current + addQty;

  if (totalPreviewEl) {
    totalPreviewEl.innerText = `${finalStock} ${currentRestockItem.unit || 'pcs'} (+${addQty})`;
  }
}

function setRestockQtyPreset(val) {
  const qtyInput = document.getElementById('restockQtyInput');
  if (!qtyInput) return;
  qtyInput.value = val;
  updateRestockPreview();
}

function adjustRestockQtyStep(step) {
  const qtyInput = document.getElementById('restockQtyInput');
  if (!qtyInput) return;
  const current = Math.max(1, Number(qtyInput.value) || 1);
  const next = Math.max(1, current + step);
  qtyInput.value = next;
  updateRestockPreview();
}

async function submitQuickRestock() {
  if (!currentRestockItem) return;
  const qtyInput = document.getElementById('restockQtyInput');
  const addQty = Math.max(1, Number(qtyInput?.value) || 1);

  try {
    const res = await window.api.patch(`/items/${currentRestockItem.id}/stock`, { qty: addQty });
    if (res && res.success) {
      window.closeSheet('sheetQuickRestock');
      window.showToast(`Stok ${currentRestockItem.name} bertambah +${addQty} (Total: ${res.data.stock})`, 'success');
      loadMasterBarcodes();
      window.loadItems?.();
      window.loadDashboard?.();
      window.triggerRealtimeSync?.('item_stock_updated');
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal menambah stok', 'error');
  }
}

function deleteMasterBarcode(id, name) {
  if (window.showConfirmModal) {
    window.showConfirmModal({
      title: 'Hapus Data Barcode',
      message: `Hapus produk "${name}" dari katalog barcode?`,
      confirmText: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          const res = await window.api.delete(`/items/${id}?permanent=true`);
          if (res && res.success) {
            window.showToast(`Produk "${name}" berhasil dihapus`, 'success');
            masterBarcodes = masterBarcodes.filter(i => Number(i.id) !== Number(id));
            renderMasterBarcodesUI();
            window.appStore?.removeFromCart?.(Number(id));
            loadMasterBarcodes();
            window.loadItems?.();
            window.loadDashboard?.();
            window.triggerRealtimeSync?.('item_deleted');
          }
        } catch (err) {
          window.showToast(err.message || 'Gagal menghapus barcode', 'error');
        }
      }
    });
  } else {
    if (confirm(`Hapus barcode "${name}"?`)) {
      window.api.delete(`/items/${id}?permanent=true`).then(() => {
        masterBarcodes = masterBarcodes.filter(i => Number(i.id) !== Number(id));
        renderMasterBarcodesUI();
        loadMasterBarcodes();
        window.loadItems?.();
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.loadMasterBarcodes = loadMasterBarcodes;
  window.renderMasterBarcodesUI = renderMasterBarcodesUI;
  window.setBarcodeFilter = setBarcodeFilter;
  window.openQuickRestockModal = openQuickRestockModal;
  window.updateRestockPreview = updateRestockPreview;
  window.setRestockQtyPreset = setRestockQtyPreset;
  window.adjustRestockQtyStep = adjustRestockQtyStep;
  window.submitQuickRestock = submitQuickRestock;
  window.deleteMasterBarcode = deleteMasterBarcode;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadMasterBarcodes,
    renderMasterBarcodesUI,
    setBarcodeFilter,
    openQuickRestockModal,
    submitQuickRestock,
    deleteMasterBarcode
  };
}
