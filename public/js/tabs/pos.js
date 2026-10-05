function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadItems() {
  try {
    const res = await window.api.get('/items');
    if (res.success) {
      window.appStore.setState({ items: res.data });
      renderItemsUI();
    }
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

function renderProductCardHtml(item) {
  let borderClass = '';
  let badgeType = 'safe';
  let badgeLabel = `Stok ${item.stock}`;

  if (item.stock === 0) {
    borderClass = 'border-danger';
    badgeType = 'danger';
    badgeLabel = 'Habis';
  } else if (item.stock <= item.min_stock) {
    borderClass = 'border-warning';
    badgeType = 'warning';
    badgeLabel = `Kritis (${item.stock})`;
  }

  const margin = Math.max(0, Number(item.sell_price) - Number(item.buy_price));
  const cart = window.appStore.getState().cart;
  const inCartItem = cart.find(c => Number(c.id) === Number(item.id));
  const inCartQty = inCartItem ? inCartItem.qty : 0;
  const initialChar = (item.name || 'P').trim().charAt(0).toUpperCase();

  return `
    <div class="product-card ${borderClass}" id="card-item-${item.id}">
      <div class="product-card-top">
        <div class="product-avatar">
          <span>${initialChar}</span>
        </div>
        <div class="product-meta">
          <div class="product-title-row">
            <span class="product-name">${escapeXml(item.name)}</span>
            <span class="badge-stock ${badgeType}">${badgeLabel}</span>
          </div>
          <div class="product-category-row">
            <span class="product-cat-pill">${escapeXml(item.category || 'Umum')}</span>
            <span class="product-margin-pill">Laba +${window.formatRp(margin)}</span>
          </div>
        </div>
      </div>

      <div class="product-card-mid">
        <div>
          <div class="price-label">Harga Jual</div>
          <div class="price-value">${window.formatRp(item.sell_price)}</div>
        </div>
        <div style="text-align: right;">
          <div class="price-label">Modal Beli</div>
          <div class="price-modal">${window.formatRp(item.buy_price)}</div>
        </div>
      </div>

      <div class="product-card-bottom">
        <div class="stock-stepper-ctrl">
          <button class="btn-stepper-mini" onclick="fastAdjustStock(${item.id}, -1)" title="Kurangi stok">-1</button>
          <span class="stock-indicator-val">Stok: <b>${item.stock}</b></span>
          <button class="btn-stepper-mini" onclick="fastAdjustStock(${item.id}, 1)" title="Tambah stok">+1</button>
          <button class="btn-stepper-mini btn-stepper-edit" onclick='openItemSheet(${JSON.stringify(item).replace(/'/g, "&apos;")})' title="Edit data barang">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>

        <div class="product-action-cta">
          ${item.stock === 0 ? `
            <button class="btn-cart-cta out-of-stock" disabled>
              <span>Habis</span>
            </button>
          ` : inCartQty > 0 ? `
            <div class="cart-stepper-active">
              <button type="button" class="btn-cart-step" onclick="changeCartQty(${item.id}, -1)">-</button>
              <span class="cart-step-num">${inCartQty}</span>
              <button type="button" class="btn-cart-step" onclick="changeCartQty(${item.id}, 1)">+</button>
            </div>
          ` : `
            <button class="btn-cart-cta add-to-cart" onclick="addToCartById(${item.id})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              <span>+ Keranjang</span>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderItemsUI() {
  const container = document.getElementById('itemsListContainer');
  const searchInput = document.getElementById('itemSearchField');
  const search = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const state = window.appStore.getState();
  const items = state.items || [];
  const filter = state.itemFilter || 'all';

  // Update stats counters
  const totalAll = items.length;
  const totalLow = items.filter(i => i.stock <= i.min_stock && i.stock > 0).length;
  const totalOut = items.filter(i => i.stock === 0).length;

  const elStatTotal = document.getElementById('itemsStatTotal');
  if (elStatTotal) elStatTotal.textContent = totalAll;
  const elStatLow = document.getElementById('itemsStatCritical');
  if (elStatLow) elStatLow.textContent = totalLow;
  const elStatOut = document.getElementById('itemsStatOut');
  if (elStatOut) elStatOut.textContent = totalOut;

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search) ||
      (item.category && item.category.toLowerCase().includes(search)) ||
      (item.barcode && item.barcode.toLowerCase().includes(search));
    if (!matchSearch) return false;

    if (filter === 'low') return item.stock <= item.min_stock && item.stock > 0;
    if (filter === 'out') return item.stock === 0;
    return true;
  });

  if (container) {
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-box" style="text-align: center; padding: 40px 20px; color: var(--text-sub);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; opacity: 0.5;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <div style="font-size: 13px; font-weight: 600;">Tidak ada produk yang cocok</div>
        </div>
      `;
    } else {
      container.innerHTML = filtered.map(item => renderProductCardHtml(item)).join('');
    }
  }

  updateCartBar();
}

function addToCartById(id) {
  const item = window.appStore.getState().items.find(i => Number(i.id) === Number(id));
  if (!item) return;

  try {
    window.appStore.addToCart(item);
    window.showToast(`+1 ${item.name} ke keranjang`, 'success');
  } catch (err) {
    window.showToast(err.message, 'warning');
  }
}

function changeCartQty(id, delta) {
  try {
    window.appStore.updateCartQty(id, delta);
  } catch (err) {
    window.showToast(err.message, 'warning');
  }
}

function updateCartBar() {
  const bar = document.getElementById('cartBar');
  if (!bar) return;

  const count = window.appStore.getCartItemCount();
  const total = window.appStore.getCartTotal();

  if (count > 0) {
    bar.classList.add('show');
    const badge = document.getElementById('cartBadge');
    const totalEl = document.getElementById('cartBarTotal');
    if (badge) badge.innerText = `${count} item`;
    if (totalEl) totalEl.innerText = window.formatRp(total);
  } else {
    bar.classList.remove('show');
  }
}

async function fastAdjustStock(id, delta) {
  try {
    const res = await window.api.patch(`/items/${id}/stock`, { qty: delta });
    if (res.success) {
      const items = window.appStore.getState().items.map(it => it.id === id ? res.data : it);
      window.appStore.setState({ items });
      renderItemsUI();
      window.showToast(`Stok ${res.data.name} diperbarui: ${res.data.stock}`, 'success');
    }
  } catch (err) {
    window.showToast(err.message || 'Gagal mengubah stok', 'error');
  }
}

// Scanner Hook
function handleBarcodeScanned(barcode) {
  const items = window.appStore.getState().items || [];
  const found = items.find(it => it.barcode === barcode);

  if (found) {
    try {
      window.appStore.addToCart(found);
      window.showToast(`[Barcode] +1 ${found.name}`, 'success');
      window.closeSheet('sheetScanner');
    } catch (err) {
      window.showToast(err.message, 'warning');
    }
  } else {
    window.closeSheet('sheetScanner');
    window.openItemSheet({ barcode, name: '' });
    window.showToast(`Barcode ${barcode} belum terdaftar. Silakan lengkapi produk baru.`, 'warning');
  }
}

if (typeof window !== 'undefined') {
  window.loadItems = loadItems;
  window.renderItemsUI = renderItemsUI;
  window.addToCartById = addToCartById;
  window.changeCartQty = changeCartQty;
  window.updateCartBar = updateCartBar;
  window.fastAdjustStock = fastAdjustStock;
  window.handleBarcodeScanned = handleBarcodeScanned;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadItems, renderItemsUI, addToCartById, changeCartQty, fastAdjustStock, handleBarcodeScanned };
}
