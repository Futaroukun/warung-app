/* WarungPro High-Performance Client Bundle */

/* --- utils.js --- */
function formatRp(num) {
  const n = Number(num) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\(\)\[\]\/\-_.,])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function cleanNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9]/g, '');
  return Number(cleaned) || 0;
}

function formatTanggal(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

// Support both ES Modules in browser and CommonJS in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatRp, toTitleCase, cleanNumber, formatTanggal };
}

if (typeof window !== 'undefined') {
  window.formatRp = formatRp;
  window.toTitleCase = toTitleCase;
  window.cleanNumber = cleanNumber;
  window.formatTanggal = formatTanggal;
}


/* --- store.js --- */
class Store {
  constructor() {
    this.state = {
      activeTab: 'dashboard',
      items: [],
      debts: [],
      sales: [],
      summary: null,
      cart: [],
      itemFilter: 'all',
      itemSearch: '',
      debtFilter: 'belum_lunas',
      debtSearch: '',
      historyPeriod: 'today',
      historyDate: ''
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    }
  }

  // --- Cart Management ---
  addToCart(item, qty = 1) {
    const existingIndex = this.state.cart.findIndex(c => c.id === item.id);
    let newCart = [...this.state.cart];

    if (existingIndex >= 0) {
      const current = newCart[existingIndex];
      const newQty = current.qty + qty;
      if (item.stock !== undefined && newQty > item.stock) {
        throw new Error(`Stok tidak mencukupi (tersedia: ${item.stock})`);
      }
      newCart[existingIndex] = { ...current, qty: newQty };
    } else {
      if (item.stock !== undefined && qty > item.stock) {
        throw new Error(`Stok tidak mencukupi (tersedia: ${item.stock})`);
      }
      newCart.push({
        id: item.id,
        name: item.name,
        category: item.category,
        buy_price: item.buy_price || 0,
        sell_price: item.sell_price || 0,
        stock: item.stock,
        unit: item.unit || 'pcs',
        qty
      });
    }

    this.setState({ cart: newCart });
  }

  updateCartQty(id, delta) {
    const existingIndex = this.state.cart.findIndex(c => c.id === id);
    if (existingIndex < 0) return;

    let newCart = [...this.state.cart];
    const current = newCart[existingIndex];
    const newQty = current.qty + delta;

    if (newQty <= 0) {
      newCart.splice(existingIndex, 1);
    } else {
      if (current.stock !== undefined && newQty > current.stock) {
        throw new Error(`Stok "${current.name}" hanya tersisa ${current.stock}`);
      }
      newCart[existingIndex] = { ...current, qty: newQty };
    }

    this.setState({ cart: newCart });
  }

  removeFromCart(id) {
    const newCart = this.state.cart.filter(c => c.id !== id);
    this.setState({ cart: newCart });
  }

  clearCart() {
    this.setState({ cart: [] });
  }

  getCartTotal() {
    return this.state.cart.reduce((sum, item) => sum + (item.sell_price * item.qty), 0);
  }

  getCartItemCount() {
    return this.state.cart.reduce((sum, item) => sum + item.qty, 0);
  }
}

// Global singleton instance for browser
const appStore = new Store();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Store, appStore };
}

if (typeof window !== 'undefined') {
  window.Store = Store;
  window.appStore = appStore;
}


/* --- api.js --- */
const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = (data && data.error) ? data.error : `HTTP ${res.status} ${res.statusText}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(err.message || 'Gagal terhubung ke server', 'error');
    }
    throw err;
  }
}

const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options })
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, request };
}

if (typeof window !== 'undefined') {
  window.api = api;
}


/* --- components/toast.js --- */
let toastTimer = null;

function showToast(msg, type = 'success') {
  let toast = document.getElementById('toastMessage');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMessage';
    toast.className = 'toast';
    toast.innerHTML = '<svg id="toastIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.5"></svg><span id="toastText"></span>';
    document.body.appendChild(toast);
  }

  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastText');

  clearTimeout(toastTimer);
  toast.classList.remove('show', 'toast-error', 'toast-warning', 'toast-success');

  if (type === 'error') {
    toast.classList.add('toast-error');
    if (icon) {
      icon.setAttribute('stroke', '#f43f5e');
      icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
    }
  } else if (type === 'warning') {
    toast.classList.add('toast-warning');
    if (icon) {
      icon.setAttribute('stroke', '#f59e0b');
      icon.innerHTML = '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>';
    }
  } else {
    toast.classList.add('toast-success');
    if (icon) {
      icon.setAttribute('stroke', '#10b981');
      icon.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
    }
  }

  if (text) text.innerText = msg;
  void toast.offsetWidth; // Trigger reflow for CSS animation
  toast.classList.add('show');

  try {
    if (type === 'error' || type === 'warning') {
      navigator.vibrate?.([30, 40, 30]);
    }
  } catch (e) {}

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// Global hook
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showToast };
}


/* --- components/sheets.js --- */
function openSheet(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeSheet(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('show');
    // Only restore scroll if no other sheets are open
    if (!document.querySelector('.sheet-backdrop.show')) {
      document.body.style.overflow = '';
    }
  }
}

function initSheetBackdrops() {
  document.querySelectorAll('.sheet-backdrop').forEach(sheet => {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        closeSheet(sheet.id);
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.openSheet = openSheet;
  window.closeSheet = closeSheet;
  window.initSheetBackdrops = initSheetBackdrops;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { openSheet, closeSheet, initSheetBackdrops };
}


/* --- components/printer.js --- */
function formatReceiptHtml(sale, storeInfo = {}) {
  const storeName = storeInfo.name || 'WARUNG KITA';
  const storeAddress = storeInfo.address || 'Kasir Warung Pintar';
  const invoice = sale.invoice_no || `INV-${sale.id}`;
  const dateStr = new Date(sale.created_at || Date.now()).toLocaleString('id-ID');
  const items = sale.items || [];

  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `
      <div class="receipt-item-name">${item.item_name || item.name}</div>
      <div class="receipt-item-details">
        <span>${item.qty} x ${Number(item.sell_price || item.price).toLocaleString('id-ID')}</span>
        <span>Rp ${Number(item.subtotal).toLocaleString('id-ID')}</span>
      </div>
    `;
  }

  const payTypeStr = sale.payment_type === 'cash' ? 'TUNAI' : (sale.payment_type === 'debt' ? 'KASBON / HUTANG' : sale.payment_type.toUpperCase());

  return `
    <div class="receipt-header">
      <div class="receipt-title">${storeName}</div>
      <div class="receipt-sub">${storeAddress}</div>
      <div class="receipt-divider"></div>
    </div>
    <div class="receipt-meta">
      <div class="receipt-meta-row"><span>No. Struk</span><span>${invoice}</span></div>
      <div class="receipt-meta-row"><span>Waktu</span><span>${dateStr}</span></div>
      ${sale.customer_name ? `<div class="receipt-meta-row"><span>Pelanggan</span><span>${sale.customer_name}</span></div>` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-table">
      ${itemsHtml}
    </div>
    <div class="receipt-double-divider"></div>
    <div class="receipt-totals">
      <div class="receipt-row bold"><span>TOTAL</span><span>Rp ${Number(sale.total_amount).toLocaleString('id-ID')}</span></div>
      <div class="receipt-row"><span>METODE</span><span>${payTypeStr}</span></div>
      ${sale.payment_type === 'cash' ? `
        <div class="receipt-row"><span>BAYAR</span><span>Rp ${Number(sale.cash_received || 0).toLocaleString('id-ID')}</span></div>
        <div class="receipt-row"><span>KEMBALI</span><span>Rp ${Number(sale.cash_change || 0).toLocaleString('id-ID')}</span></div>
      ` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      <div>Terima kasih atas kunjungan Anda!</div>
      <div>Barang yang dibeli tidak dapat ditukar/dikembalikan</div>
    </div>
  `;
}

function printReceipt(sale) {
  let printArea = document.getElementById('receiptPrintArea');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'receiptPrintArea';
    document.body.appendChild(printArea);
  }

  printArea.innerHTML = formatReceiptHtml(sale);
  window.print();
}

function generateWhatsAppReceiptText(sale) {
  const invoice = sale.invoice_no || `INV-${sale.id}`;
  const dateStr = new Date(sale.created_at || Date.now()).toLocaleString('id-ID');
  const items = sale.items || [];

  let text = `╭── ✦ *STRUK PEMBELIAN WARUNG* ✦\n`;
  text += `• *No. Struk* : ${invoice}\n`;
  text += `• *Tanggal*   : ${dateStr}\n`;
  if (sale.customer_name) text += `• *Pelanggan* : ${sale.customer_name}\n`;
  text += `───────────────────────\n`;

  for (const item of items) {
    text += `› *${item.item_name || item.name}*\n`;
    text += `  ${item.qty} x Rp ${Number(item.sell_price || item.price).toLocaleString('id-ID')} = Rp ${Number(item.subtotal).toLocaleString('id-ID')}\n`;
  }

  text += `───────────────────────\n`;
  text += `• *TOTAL*     : *Rp ${Number(sale.total_amount).toLocaleString('id-ID')}*\n`;
  text += `• *PEMBAYARAN*: ${sale.payment_type === 'cash' ? 'Tunai' : (sale.payment_type === 'debt' ? 'Kasbon/Hutang' : sale.payment_type.toUpperCase())}\n`;
  if (sale.payment_type === 'cash') {
    text += `• *DITERIMA*  : Rp ${Number(sale.cash_received || 0).toLocaleString('id-ID')}\n`;
    text += `• *KEMBALI*   : Rp ${Number(sale.cash_change || 0).toLocaleString('id-ID')}\n`;
  }
  text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `_Terima kasih telah berbelanja di warung kami!_`;

  return text;
}

function shareReceiptWhatsApp(sale, phone = '') {
  const text = generateWhatsAppReceiptText(sale);
  let cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);

  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

if (typeof window !== 'undefined') {
  window.printReceipt = printReceipt;
  window.formatReceiptHtml = formatReceiptHtml;
  window.generateWhatsAppReceiptText = generateWhatsAppReceiptText;
  window.shareReceiptWhatsApp = shareReceiptWhatsApp;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatReceiptHtml, printReceipt, generateWhatsAppReceiptText, shareReceiptWhatsApp };
}


/* --- components/scanner.js --- */
let activeStream = null;
let scanAnimationId = null;
let isScanning = false;
let barcodeDetector = null;

// Initialize native BarcodeDetector if available
if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
  try {
    barcodeDetector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
    });
  } catch (e) {
    console.warn('BarcodeDetector format init fallback:', e);
    barcodeDetector = new window.BarcodeDetector();
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Audio context not allowed or unsupported
  }
}

async function startScanner(videoEl, onResult) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Kamera tidak didukung pada browser ini');
  }

  stopScanner();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    activeStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
    isScanning = true;

    if (!barcodeDetector) {
      if ('BarcodeDetector' in window) {
        barcodeDetector = new window.BarcodeDetector();
      } else {
        throw new Error('BarcodeDetector API tidak aktif di browser ini. Masukkan barcode secara manual.');
      }
    }

    let lastDetectedCode = '';
    let lastDetectedTime = 0;

    const detectLoop = async () => {
      if (!isScanning) return;

      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await barcodeDetector.detect(videoEl);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            const now = Date.now();

            // Throttle duplicate reads within 1.5 seconds
            if (rawValue !== lastDetectedCode || now - lastDetectedTime > 1500) {
              lastDetectedCode = rawValue;
              lastDetectedTime = now;
              playBeep();
              navigator.vibrate?.([50]);
              onResult(rawValue);
            }
          }
        } catch (err) {
          // Frame detection glitch, continue next frame
        }
      }

      if (isScanning) {
        scanAnimationId = requestAnimationFrame(detectLoop);
      }
    };

    scanAnimationId = requestAnimationFrame(detectLoop);
  } catch (err) {
    stopScanner();
    throw err;
  }
}

function stopScanner() {
  isScanning = false;
  if (scanAnimationId) {
    cancelAnimationFrame(scanAnimationId);
    scanAnimationId = null;
  }
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

if (typeof window !== 'undefined') {
  window.startScanner = startScanner;
  window.stopScanner = stopScanner;
  window.playBeep = playBeep;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startScanner, stopScanner, playBeep };
}


/* --- tabs/dashboard.js --- */
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

    // Also load Profit Loss statement
    loadProfitLoss();
  } catch (err) {
    console.error('Failed to load dashboard summary:', err);
  }
}

async function loadProfitLoss() {
  try {
    const res = await window.api.get('/reports/profit-loss');
    if (!res.success) return;
    const pl = res.data;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setTxt('plGrossRevenue', window.formatRp(pl.gross_revenue));
    setTxt('plCogsTotal', window.formatRp(pl.cogs_total));
    setTxt('plNetProfit', window.formatRp(pl.net_profit));
    setTxt('plMarginPercent', `${pl.profit_margin_percent}%`);
    setTxt('plCashCollected', window.formatRp(pl.cash_collected));
  } catch (err) {
    console.error('Failed to load profit loss report:', err);
  }
}

function exportSalesCsv() {
  window.showToast('Mengunduh Laporan Penjualan (CSV)...', 'success');
  window.location.href = '/api/reports/export/sales';
}

function exportItemsCsv() {
  window.showToast('Mengunduh Data Inventaris Stok (CSV)...', 'success');
  window.location.href = '/api/reports/export/items';
}

function initDashboard() {
  const btnRefresh = document.getElementById('btnRefreshDash');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadDashboard);
  }
}

if (typeof window !== 'undefined') {
  window.loadDashboard = loadDashboard;
  window.loadProfitLoss = loadProfitLoss;
  window.exportSalesCsv = exportSalesCsv;
  window.exportItemsCsv = exportItemsCsv;
  window.initDashboard = initDashboard;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadDashboard, loadProfitLoss, exportSalesCsv, exportItemsCsv, initDashboard };
}


/* --- tabs/pos.js --- */
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
  const currentItem = (window.appStore.getState().items || []).find(it => it.id === id);
  if (currentItem && currentItem.stock <= 0 && delta < 0) {
    window.showToast(`Stok ${currentItem.name} sudah 0`, 'warning');
    return;
  }

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


/* --- tabs/debts.js --- */
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

if (typeof window !== 'undefined') {
  window.loadDebts = loadDebts;
  window.renderDebtsUI = renderDebtsUI;
  window.deleteDebt = deleteDebt;
  window.generateDebtReminderMessage = generateDebtReminderMessage;
  window.sendDebtReminderWhatsApp = sendDebtReminderWhatsApp;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadDebts, renderDebtsUI, deleteDebt, generateDebtReminderMessage, sendDebtReminderWhatsApp };
}


/* --- tabs/history.js --- */
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


/* --- tabs/system.js --- */
async function checkSystemHealth() {
  try {
    const res = await window.api.get('/system/health');
    if (res.success) {
      const data = res.data;
      const memEl = document.getElementById('sysMemoryInfo');
      const uptimeEl = document.getElementById('sysUptimeInfo');
      const dbEl = document.getElementById('sysDbInfo');

      if (memEl) memEl.innerText = `RAM: ${data.memory_usage_mb.rss} MB (Heap: ${data.memory_usage_mb.heapUsed} MB)`;
      if (uptimeEl) {
        const mins = Math.floor(data.uptime_seconds / 60);
        const secs = data.uptime_seconds % 60;
        uptimeEl.innerText = `Uptime: ${mins}m ${secs}s`;
      }
      if (dbEl) dbEl.innerText = `Database: ${data.database}`;
    }
  } catch (err) {
    console.error('Failed to get system health:', err);
  }
}

function downloadDatabaseBackup() {
  window.showToast('Memulai unduh backup warung.db...', 'success');
  window.location.href = '/api/system/backup';
}

if (typeof window !== 'undefined') {
  window.checkSystemHealth = checkSystemHealth;
  window.downloadDatabaseBackup = downloadDatabaseBackup;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkSystemHealth, downloadDatabaseBackup };
}


/* --- app.js --- */
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

