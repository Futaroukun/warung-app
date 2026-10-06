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

let batchRestockItems = [];

function openBatchRestockModal() {
  renderBatchRestockUI();
  window.openSheet?.('sheetBatchRestock');
  const searchInput = document.getElementById('batchRestockSearchField');
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 200);
  }
}

function renderBatchRestockUI() {
  const container = document.getElementById('batchRestockListContainer');
  const badgeEl = document.getElementById('batchRestockItemsCountBadge');
  const summaryItemsEl = document.getElementById('batchRestockSummaryItems');
  const summaryTotalEl = document.getElementById('batchRestockSummaryTotal');

  const totalKinds = batchRestockItems.length;
  const totalQty = batchRestockItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const totalAmount = batchRestockItems.reduce((acc, it) => acc + ((Number(it.qty) || 0) * (Number(it.buy_price) || 0)), 0);

  if (badgeEl) badgeEl.innerText = `${totalKinds} Barang (${totalQty} pcs)`;
  if (summaryItemsEl) summaryItemsEl.innerText = `${totalKinds} jenis (${totalQty} pcs)`;
  if (summaryTotalEl) summaryTotalEl.innerText = window.formatRp ? window.formatRp(totalAmount) : `Rp ${totalAmount.toLocaleString('id-ID')}`;

  const hudCount = document.getElementById('scannerRestockCount');
  const hudBtnCount = document.getElementById('scannerRestockCountBtn');
  if (hudCount) hudCount.innerText = totalKinds;
  if (hudBtnCount) hudBtnCount.innerText = totalKinds;

  if (!container) return;

  if (batchRestockItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 16px; color: var(--text-sub);">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-surface); margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
        </div>
        <div style="font-weight: 700; color: #fff; font-size: 13px;">Daftar Kulakan Masih Kosong</div>
        <div style="font-size: 11px; margin-top: 4px;">Ketik nama produk di atas atau klik <b>Scan Kamera</b> untuk menambah barang beruntun.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = batchRestockItems.map(item => {
    const subtotal = (Number(item.qty) || 0) * (Number(item.buy_price) || 0);
    return `
      <div class="batch-restock-card" style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13px; font-weight: 800; color: #fff; line-height: 1.3;">${item.name}</div>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 3px; font-size: 10px;">
              <span style="font-family: monospace; color: var(--emerald); background: rgba(0, 245, 155, 0.1); padding: 1px 5px; border-radius: 4px;">${item.barcode || 'Tanpa Barcode'}</span>
              <span style="color: var(--text-sub);">Stok Sekarang: <b>${item.current_stock || 0} ${item.unit || 'pcs'}</b></span>
            </div>
          </div>
          <button type="button" class="btn-icon-subtle" onclick="removeBatchRestockItem(${item.id})" title="Hapus dari kulakan" style="padding: 4px; color: var(--rose);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; background: var(--bg-card); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border);">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-sub);">Masuk (+):</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button type="button" class="btn" onclick="adjustBatchRestockQty(${item.id}, -1)" style="width: 30px; height: 30px; padding: 0; font-size: 16px; font-weight: 800; background: var(--bg-surface); border: 1px solid var(--border); color: #fff; border-radius: 6px;">−</button>
            <input type="number" min="1" value="${item.qty}" onchange="updateBatchRestockQty(${item.id}, this.value)" style="width: 52px; height: 30px; text-align: center; font-weight: 800; font-size: 14px; background: var(--bg-base); border: 1px solid var(--border); color: var(--emerald); border-radius: 6px;">
            <button type="button" class="btn" onclick="adjustBatchRestockQty(${item.id}, 1)" style="width: 30px; height: 30px; padding: 0; font-size: 16px; font-weight: 800; background: var(--bg-surface); border: 1px solid var(--border); color: #fff; border-radius: 6px;">+</button>
          </div>
          <div style="display: flex; gap: 4px;">
            <button type="button" onclick="adjustBatchRestockQty(${item.id}, 6)" style="font-size: 10px; font-weight: 700; padding: 4px 6px; border-radius: 6px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;">+6</button>
            <button type="button" onclick="adjustBatchRestockQty(${item.id}, 12)" style="font-size: 10px; font-weight: 700; padding: 4px 6px; border-radius: 6px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;">+12</button>
            <button type="button" onclick="adjustBatchRestockQty(${item.id}, 24)" style="font-size: 10px; font-weight: 700; padding: 4px 6px; border-radius: 6px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;">+24</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <span style="font-size: 10px; font-weight: 700; color: var(--text-sub); display: block; margin-bottom: 2px;">Modal / HPP Satuan:</span>
            <input type="number" min="0" value="${item.buy_price}" onchange="updateBatchRestockBuyPrice(${item.id}, this.value)" style="width: 100%; height: 32px; padding: 4px 8px; font-size: 12px; font-weight: 700; background: var(--bg-card); border: 1px solid var(--border); color: var(--amber); border-radius: 6px;">
          </div>
          <div>
            <span style="font-size: 10px; font-weight: 700; color: var(--text-sub); display: block; margin-bottom: 2px;">Subtotal Biaya Modal:</span>
            <div style="height: 32px; display: flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--emerald); padding-left: 2px;">
              ${window.formatRp ? window.formatRp(subtotal) : 'Rp ' + subtotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addBatchRestockItem(item, addQty = 1) {
  if (!item) return;
  const existing = batchRestockItems.find(i => Number(i.id) === Number(item.id));
  if (existing) {
    existing.qty = Math.max(1, (Number(existing.qty) || 0) + addQty);
  } else {
    batchRestockItems.unshift({
      id: item.id,
      name: item.name,
      barcode: item.barcode || '',
      category: item.category || 'Umum',
      current_stock: item.stock || 0,
      unit: item.unit || 'pcs',
      qty: Math.max(1, Number(addQty) || 1),
      buy_price: item.buy_price || 0,
      sell_price: item.sell_price || 0
    });
  }
  renderBatchRestockUI();
}

function updateBatchRestockQty(itemId, val) {
  const item = batchRestockItems.find(i => Number(i.id) === Number(itemId));
  if (!item) return;
  item.qty = Math.max(1, Number(val) || 1);
  renderBatchRestockUI();
}

function adjustBatchRestockQty(itemId, step) {
  const item = batchRestockItems.find(i => Number(i.id) === Number(itemId));
  if (!item) return;
  item.qty = Math.max(1, (Number(item.qty) || 0) + step);
  renderBatchRestockUI();
}

function updateBatchRestockBuyPrice(itemId, val) {
  const item = batchRestockItems.find(i => Number(i.id) === Number(itemId));
  if (!item) return;
  item.buy_price = Math.max(0, Number(val) || 0);
  renderBatchRestockUI();
}

function removeBatchRestockItem(itemId) {
  batchRestockItems = batchRestockItems.filter(i => Number(i.id) !== Number(itemId));
  renderBatchRestockUI();
}

function clearBatchRestockList() {
  if (batchRestockItems.length === 0) return;
  batchRestockItems = [];
  renderBatchRestockUI();
  window.showToast?.('Daftar barang kulakan dikosongkan', 'info');
}

function startContinuousRestockScan() {
  window.closeSheet?.('sheetBatchRestock');
  window.openBarcodeScanner?.('restock');
}

function finishRestockScanning() {
  window.closeBarcodeScanner?.();
  openBatchRestockModal();
}

async function onRestockBarcodeScanned(barcode) {
  const cleanBarcode = String(barcode || '').trim();
  if (!cleanBarcode) return;

  let found = masterBarcodes.find(i => String(i.barcode || '').trim() === cleanBarcode);
  if (!found) {
    const activeItems = window.appStore?.getState()?.items || [];
    found = activeItems.find(i => String(i.barcode || '').trim() === cleanBarcode);
  }

  if (!found && window.api) {
    try {
      const res = await window.api.get(`/items/barcode/${encodeURIComponent(cleanBarcode)}?include_all=true`);
      if (res && res.success && res.data) {
        found = res.data;
      }
    } catch (_) {}
  }

  if (found) {
    addBatchRestockItem(found, 1);
    const existing = batchRestockItems.find(i => Number(i.id) === Number(found.id));
    const currentQty = existing ? existing.qty : 1;

    // Update camera HUD in real-time
    const hudEl = document.getElementById('scannerRestockHud');
    const hudTitle = document.getElementById('scannerRestockHudTitle');
    const hudSub = document.getElementById('scannerRestockHudSub');
    if (hudEl) hudEl.style.display = 'flex';
    if (hudTitle) hudTitle.innerText = found.name;
    if (hudSub) hudSub.innerText = `+1 Masuk Kulakan (Total: ${currentQty} ${found.unit || 'pcs'})`;

    window.showToast?.(`[Kulakan] +1 ${found.name}`, 'success');
  } else {
    window.closeBarcodeScanner?.();
    window.openItemSheet?.({ barcode: cleanBarcode, stock: 12 });
    window.showToast?.(`Barcode ${cleanBarcode} belum terdaftar. Silakan daftarkan produk.`, 'warning');
  }
}

function onBatchRestockSearchInput(query) {
  const dropdown = document.getElementById('batchRestockDropdown');
  if (!dropdown) return;
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  const matches = masterBarcodes.filter(i => 
    (i.name || '').toLowerCase().includes(q) ||
    (i.barcode || '').toLowerCase().includes(q)
  ).slice(0, 8);

  if (matches.length === 0) {
    dropdown.style.display = 'block';
    dropdown.innerHTML = `
      <div style="padding: 10px 12px; font-size: 12px; color: var(--text-sub); text-align: center;">
        Produk tidak ditemukan.
      </div>
    `;
    return;
  }

  dropdown.style.display = 'block';
  dropdown.innerHTML = matches.map(item => `
    <div onclick="selectBatchRestockSearchResult(${item.id})" style="padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; hover: background: var(--bg-surface);">
      <div>
        <div style="font-size: 13px; font-weight: 700; color: #fff;">${item.name}</div>
        <div style="font-size: 10px; color: var(--text-sub); font-family: monospace;">${item.barcode || 'Tanpa Barcode'} | Stok: ${item.stock || 0}</div>
      </div>
      <div style="font-size: 12px; font-weight: 800; color: var(--emerald);">
        + Masuk
      </div>
    </div>
  `).join('');
}

function selectBatchRestockSearchResult(itemId) {
  const item = masterBarcodes.find(i => Number(i.id) === Number(itemId));
  if (item) {
    addBatchRestockItem(item, 1);
    window.showToast?.(`+1 ${item.name} masuk daftar kulakan`, 'success');
  }
  const searchInput = document.getElementById('batchRestockSearchField');
  const dropdown = document.getElementById('batchRestockDropdown');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
  }
}

async function submitBatchRestock() {
  if (batchRestockItems.length === 0) {
    window.showToast?.('Daftar barang kulakan masih kosong', 'warning');
    return;
  }

  const notesInput = document.getElementById('batchRestockNotesInput');
  const notes = notesInput ? notesInput.value.trim() : '';

  const payload = {
    notes,
    items: batchRestockItems.map(i => ({
      id: i.id,
      qty: Number(i.qty) || 1,
      buy_price: Number(i.buy_price) || 0,
      sell_price: Number(i.sell_price) || 0
    }))
  };

  try {
    const res = await window.api.post('/items/restock-batch', payload);
    if (res && res.success) {
      const totalPcs = batchRestockItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
      const totalRp = batchRestockItems.reduce((acc, it) => acc + ((Number(it.qty) || 0) * (Number(it.buy_price) || 0)), 0);

      window.closeSheet?.('sheetBatchRestock');
      batchRestockItems = [];
      if (notesInput) notesInput.value = '';

      window.showToast?.(`Kulakan sukses: +${totalPcs} pcs stok masuk (Total: ${window.formatRp ? window.formatRp(totalRp) : 'Rp ' + totalRp})`, 'success');

      // Refresh stores and views
      loadMasterBarcodes();
      window.loadItems?.();
      window.loadDashboard?.();
      window.triggerRealtimeSync?.('batch_restock_completed');
    }
  } catch (err) {
    window.showToast?.(err.message || 'Gagal menyimpan kulakan', 'error');
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

  // Batch Restock exports
  window.openBatchRestockModal = openBatchRestockModal;
  window.renderBatchRestockUI = renderBatchRestockUI;
  window.addBatchRestockItem = addBatchRestockItem;
  window.updateBatchRestockQty = updateBatchRestockQty;
  window.adjustBatchRestockQty = adjustBatchRestockQty;
  window.updateBatchRestockBuyPrice = updateBatchRestockBuyPrice;
  window.removeBatchRestockItem = removeBatchRestockItem;
  window.clearBatchRestockList = clearBatchRestockList;
  window.submitBatchRestock = submitBatchRestock;
  window.onBatchRestockSearchInput = onBatchRestockSearchInput;
  window.selectBatchRestockSearchResult = selectBatchRestockSearchResult;
  window.startContinuousRestockScan = startContinuousRestockScan;
  window.finishRestockScanning = finishRestockScanning;
  window.onRestockBarcodeScanned = onRestockBarcodeScanned;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadMasterBarcodes,
    renderMasterBarcodesUI,
    setBarcodeFilter,
    openQuickRestockModal,
    submitQuickRestock,
    deleteMasterBarcode,
    openBatchRestockModal,
    renderBatchRestockUI,
    addBatchRestockItem,
    submitBatchRestock
  };
}
