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

function autoCapitalizeWords(str) {
  if (!str) return '';
  return str.toString().replace(/(^|[\s\(\)\[\]\/\-_.,])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function autoCapitalizeSentences(str) {
  if (!str) return '';
  return str.toString().replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

// Support both ES Modules in browser and CommonJS in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatRp, toTitleCase, cleanNumber, formatTanggal, autoCapitalizeWords, autoCapitalizeSentences };
}

if (typeof window !== 'undefined') {
  window.formatRp = formatRp;
  window.toTitleCase = toTitleCase;
  window.cleanNumber = cleanNumber;
  window.formatTanggal = formatTanggal;
  window.autoCapitalizeWords = autoCapitalizeWords;
  window.autoCapitalizeSentences = autoCapitalizeSentences;
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


/* --- local-db.js --- */
/**
 * local-db.js - WarungPro Standalone Offline Database Engine (IndexedDB)
 * Berjalan 100% di browser & Android WebView tanpa server / Termux / localhost.
 */

class LocalDatabase {
  constructor() {
    this.dbName = 'WarungProDB';
    this.version = 1;
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('items')) {
          const store = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('barcode', 'barcode', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('is_active', 'is_active', { unique: false });
        }

        if (!db.objectStoreNames.contains('debts')) {
          const store = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
          store.createIndex('customer_name', 'customer_name', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('debt_payments')) {
          const store = db.createObjectStore('debt_payments', { keyPath: 'id', autoIncrement: true });
          store.createIndex('debt_id', 'debt_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('sales')) {
          const store = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('invoice_no', 'invoice_no', { unique: false });
          store.createIndex('debt_id', 'debt_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('sale_items')) {
          const store = db.createObjectStore('sale_items', { keyPath: 'id', autoIncrement: true });
          store.createIndex('sale_id', 'sale_id', { unique: false });
          store.createIndex('item_id', 'item_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this.seedInitialDataIfEmpty();
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('Failed to open IndexedDB:', e.target.error);
        reject(e.target.error);
      };
    });

    return this.initPromise;
  }

  // --- Transaction Helpers ---
  async tx(storeNames, mode = 'readonly') {
    await this.init();
    return this.db.transaction(storeNames, mode);
  }

  async getAll(storeName) {
    const tx = await this.tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getOne(storeName, key) {
    const tx = await this.tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const req = store.get(Number(key));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    const tx = await this.tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, value) {
    const tx = await this.tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const req = store.add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const tx = await this.tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const req = store.delete(Number(key));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  now() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // --- Seed Data Sample ---
  async seedInitialDataIfEmpty() {
    try {
      const items = await this.getAll('items');
      if (items.length > 0) return;

      const samples = [
        { name: 'Beras Premium 5kg', category: 'Sembako', buy_price: 64000, sell_price: 72000, stock: 10, min_stock: 3, unit: 'karung', barcode: '8991001' },
        { name: 'Minyak Goreng 1L', category: 'Sembako', buy_price: 15500, sell_price: 17500, stock: 15, min_stock: 4, unit: 'pouch', barcode: '8991002' },
        { name: 'Gula Pasir 1kg', category: 'Sembako', buy_price: 14500, sell_price: 16500, stock: 12, min_stock: 3, unit: 'kg', barcode: '8991003' },
        { name: 'Kopi Kapal Api Special Mix', category: 'Minuman', buy_price: 1600, sell_price: 2000, stock: 40, min_stock: 10, unit: 'sachet', barcode: '8991004' },
        { name: 'Indomie Goreng Original', category: 'Makanan', buy_price: 2900, sell_price: 3500, stock: 50, min_stock: 12, unit: 'bungkus', barcode: '8991005' },
        { name: 'Telur Ayam 1kg', category: 'Sembako', buy_price: 26000, sell_price: 29000, stock: 10, min_stock: 2, unit: 'kg', barcode: '8991006' }
      ];

      for (const it of samples) {
        await this.add('items', {
          ...it,
          is_active: 1,
          created_at: this.now(),
          updated_at: this.now()
        });
      }
      console.log('✓ Seeded initial sample items for standalone APK');
    } catch (err) {
      console.warn('Failed to seed items:', err);
    }
  }

  // ── Items API ─────────────────────────────────────────────────────────────
  async getItems(query = {}) {
    const all = await this.getAll('items');
    let items = all.filter(it => it.is_active !== 0);

    if (query.category && query.category !== 'all') {
      items = items.filter(it => (it.category || '').toLowerCase() === query.category.toLowerCase());
    }

    if (query.search) {
      const q = query.search.toLowerCase().trim();
      items = items.filter(it =>
        (it.name || '').toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return items;
  }

  async getItemById(id) {
    return this.getOne('items', id);
  }

  async getItemByBarcode(barcode) {
    const all = await this.getAll('items');
    return all.find(it => it.is_active !== 0 && it.barcode === barcode) || null;
  }

  async createItem(data) {
    if (!data.name || !data.name.trim()) throw new Error('Nama produk wajib diisi');
    const name = window.toTitleCase ? window.toTitleCase(data.name) : data.name.trim();

    const all = await this.getAll('items');
    const exists = all.find(it => it.is_active !== 0 && it.name.toLowerCase() === name.toLowerCase());
    if (exists) throw new Error(`Barang dengan nama "${name}" sudah ada`);

    const item = {
      barcode: data.barcode ? data.barcode.trim() : null,
      name,
      category: data.category ? data.category.trim() : 'Umum',
      buy_price: Math.max(0, Number(data.buy_price) || 0),
      sell_price: Math.max(0, Number(data.sell_price) || 0),
      stock: Math.max(0, Number(data.stock) || 0),
      min_stock: data.min_stock !== undefined ? Math.max(0, Number(data.min_stock) || 0) : 3,
      unit: data.unit ? data.unit.trim() : 'pcs',
      is_active: 1,
      created_at: this.now(),
      updated_at: this.now()
    };

    const id = await this.add('items', item);
    item.id = id;
    return item;
  }

  async updateItem(id, data) {
    const item = await this.getOne('items', id);
    if (!item) throw new Error('Barang tidak ditemukan');

    if (data.name !== undefined) {
      item.name = window.toTitleCase ? window.toTitleCase(data.name) : data.name.trim();
    }
    if (data.barcode !== undefined) item.barcode = data.barcode ? data.barcode.trim() : null;
    if (data.category !== undefined) item.category = data.category ? data.category.trim() : 'Umum';
    if (data.buy_price !== undefined) item.buy_price = Math.max(0, Number(data.buy_price) || 0);
    if (data.sell_price !== undefined) item.sell_price = Math.max(0, Number(data.sell_price) || 0);
    if (data.stock !== undefined) item.stock = Math.max(0, Number(data.stock) || 0);
    if (data.min_stock !== undefined) item.min_stock = Math.max(0, Number(data.min_stock) || 0);
    if (data.unit !== undefined) item.unit = data.unit ? data.unit.trim() : 'pcs';
    item.updated_at = this.now();

    await this.put('items', item);
    return item;
  }

  async updateStock(id, delta) {
    const item = await this.getOne('items', id);
    if (!item) throw new Error('Barang tidak ditemukan');
    item.stock = Math.max(0, (item.stock || 0) + Number(delta));
    item.updated_at = this.now();
    await this.put('items', item);
    return item;
  }

  async deleteItem(id) {
    const item = await this.getOne('items', id);
    if (!item) throw new Error('Barang tidak ditemukan');
    item.is_active = 0;
    item.updated_at = this.now();
    await this.put('items', item);
    return { id: Number(id), deleted: true };
  }

  // ── Debts API ─────────────────────────────────────────────────────────────
  async getDebts(query = {}) {
    const debts = await this.getAll('debts');
    const payments = await this.getAll('debt_payments');
    const sales = await this.getAll('sales');
    const saleItems = await this.getAll('sale_items');

    let result = debts.map(d => {
      const dPayments = payments.filter(p => Number(p.debt_id) === Number(d.id));
      dPayments.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));

      // Find items from sales linked to this debt
      const debtSales = sales.filter(s => Number(s.debt_id) === Number(d.id));
      const debtSaleIds = new Set(debtSales.map(s => Number(s.id)));
      const dItems = saleItems
        .filter(si => debtSaleIds.has(Number(si.sale_id)))
        .map(si => {
          const relatedSale = debtSales.find(s => Number(s.id) === Number(si.sale_id));
          return {
            ...si,
            invoice_no: relatedSale ? relatedSale.invoice_no : '',
            created_at: relatedSale ? relatedSale.created_at : ''
          };
        });

      return {
        ...d,
        payments: dPayments,
        items: dItems
      };
    });

    if (query.status) {
      result = result.filter(d => d.status === query.status);
    }

    if (query.search) {
      const q = query.search.toLowerCase().trim();
      result = result.filter(d =>
        (d.customer_name || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q)
      );
    }

    // Sort: belum_lunas first, then updated_at DESC
    result.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'belum_lunas' ? -1 : 1;
      }
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });

    return result;
  }

  async getDebtById(id) {
    const list = await this.getDebts();
    return list.find(d => Number(d.id) === Number(id)) || null;
  }

  async createDebt({ customer_name, phone = '', amount, notes = '', due_date = null }) {
    if (!customer_name || !customer_name.trim()) throw new Error('Nama pelanggan wajib diisi');
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) throw new Error('Nominal hutang harus lebih dari 0');

    const cleanName = window.toTitleCase ? window.toTitleCase(customer_name) : customer_name.trim();

    // Check if customer already has active belum_lunas debt
    const debts = await this.getAll('debts');
    const existing = debts.find(d =>
      d.status === 'belum_lunas' &&
      (d.customer_name || '').toLowerCase().trim() === cleanName.toLowerCase().trim()
    );

    if (existing) {
      existing.amount = (existing.amount || 0) + numAmount;
      if (notes && notes.trim()) {
        existing.notes = existing.notes ? `${existing.notes}; ${notes.trim()}` : notes.trim();
      }
      if (phone && phone.trim()) existing.phone = phone.trim();
      existing.updated_at = this.now();
      await this.put('debts', existing);
      return this.getDebtById(existing.id);
    }

    const debt = {
      customer_name: cleanName,
      phone: phone ? phone.trim() : '',
      amount: numAmount,
      paid_amount: 0,
      notes: notes ? notes.trim() : '',
      status: 'belum_lunas',
      due_date: due_date || null,
      created_at: this.now(),
      updated_at: this.now()
    };

    const id = await this.add('debts', debt);
    return this.getDebtById(id);
  }

  async recordDebtPayment(id, { amount, notes = '' }) {
    const debt = await this.getOne('debts', id);
    if (!debt) throw new Error('Catatan hutang tidak ditemukan');

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) throw new Error('Nominal pembayaran harus lebih dari 0');

    const remaining = (debt.amount || 0) - (debt.paid_amount || 0);
    if (payAmount > remaining) {
      throw new Error(`Nominal pembayaran melebihi sisa hutang (sisa: Rp ${remaining.toLocaleString('id-ID')})`);
    }

    await this.add('debt_payments', {
      debt_id: Number(id),
      amount: payAmount,
      notes: notes ? notes.trim() : '',
      payment_date: this.now()
    });

    debt.paid_amount = (debt.paid_amount || 0) + payAmount;
    debt.status = debt.paid_amount >= debt.amount ? 'lunas' : 'belum_lunas';
    debt.updated_at = this.now();
    await this.put('debts', debt);

    return this.getDebtById(id);
  }

  async updateDebt(id, { phone, notes, due_date } = {}) {
    const debt = await this.getOne('debts', id);
    if (!debt) throw new Error('Catatan hutang tidak ditemukan');

    if (phone !== undefined) debt.phone = phone ? phone.trim() : '';
    if (notes !== undefined) debt.notes = notes ? notes.trim() : '';
    if (due_date !== undefined) debt.due_date = due_date;
    debt.updated_at = this.now();

    await this.put('debts', debt);
    return this.getDebtById(id);
  }

  async deleteDebt(id) {
    const debt = await this.getOne('debts', id);
    if (!debt) throw new Error('Catatan hutang tidak ditemukan');

    await this.delete('debts', id);
    // Delete payments
    const payments = await this.getAll('debt_payments');
    for (const p of payments) {
      if (Number(p.debt_id) === Number(id)) {
        await this.delete('debt_payments', p.id);
      }
    }
    return { id: Number(id), deleted: true };
  }

  // ── Sales & Checkout API ──────────────────────────────────────────────────
  async getSales(query = {}) {
    const sales = await this.getAll('sales');
    const saleItems = await this.getAll('sale_items');
    const debts = await this.getAll('debts');

    const debtMap = new Map();
    for (const d of debts) {
      debtMap.set(Number(d.id), d);
    }

    let result = sales.map(s => {
      const items = saleItems.filter(si => Number(si.sale_id) === Number(s.id));
      const debt = s.debt_id ? debtMap.get(Number(s.debt_id)) : null;

      return {
        ...s,
        items,
        debt_status: debt ? debt.status : null,
        debt_paid_amount: debt ? debt.paid_amount : null,
        debt_total_amount: debt ? debt.amount : null
      };
    });

    if (query.date) {
      result = result.filter(s => (s.created_at || '').startsWith(query.date));
    }

    if (query.status && query.status !== 'all') {
      result = result.filter(s => {
        if (query.status === 'lunas') {
          return s.payment_type === 'cash' || s.debt_status === 'lunas';
        }
        if (query.status === 'belum_lunas') {
          return s.payment_type === 'kasbon' && s.debt_status !== 'lunas';
        }
        return true;
      });
    }

    result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    const limit = Number(query.limit) || 100;
    return result.slice(0, limit);
  }

  async createSale({ payment_type, cash_received = 0, customer_name = '', notes = '', items = [] }) {
    if (!items || !items.length) throw new Error('Keranjang belanja kosong');
    if (!['cash', 'kasbon', 'debt'].includes(payment_type)) {
      throw new Error('Metode pembayaran tidak valid');
    }

    // Verify and deduct stock
    const itemRecords = await this.getAll('items');
    const itemMap = new Map();
    for (const it of itemRecords) itemMap.set(Number(it.id), it);

    let totalAmount = 0;
    let totalCost = 0;
    const preparedItems = [];

    for (const cartItem of items) {
      const dbItem = itemMap.get(Number(cartItem.id));
      if (!dbItem || dbItem.is_active === 0) {
        throw new Error(`Produk "${cartItem.name}" tidak ditemukan di database`);
      }
      if (dbItem.stock < cartItem.qty) {
        throw new Error(`Stok "${dbItem.name}" tidak mencukupi (tersedia: ${dbItem.stock}, diminta: ${cartItem.qty})`);
      }

      const buyPrice = Number(cartItem.buy_price !== undefined ? cartItem.buy_price : dbItem.buy_price) || 0;
      const sellPrice = Number(cartItem.sell_price !== undefined ? cartItem.sell_price : dbItem.sell_price) || 0;
      const subtotal = sellPrice * cartItem.qty;

      totalAmount += subtotal;
      totalCost += buyPrice * cartItem.qty;

      preparedItems.push({
        itemId: dbItem.id,
        name: dbItem.name,
        buyPrice,
        sellPrice,
        qty: cartItem.qty,
        subtotal
      });
    }

    let cashReceivedNum = Number(cash_received) || 0;
    let cashChange = 0;
    let debtId = null;

    if (payment_type === 'cash') {
      if (cashReceivedNum < totalAmount) {
        throw new Error(`Uang tunai kurang (total: Rp ${totalAmount.toLocaleString('id-ID')})`);
      }
      cashChange = cashReceivedNum - totalAmount;
    } else {
      // Kasbon
      if (!customer_name || !customer_name.trim()) {
        throw new Error('Nama pelanggan wajib diisi untuk transaksi kasbon');
      }
      const itemsSummary = preparedItems.map(p => `${p.name} (${p.qty}x)`).join(', ');
      const debtResult = await this.createDebt({
        customer_name,
        amount: totalAmount,
        notes: notes ? notes.trim() : itemsSummary
      });
      debtId = debtResult.id;
    }

    // Deduct stock from items
    for (const p of preparedItems) {
      const it = itemMap.get(p.itemId);
      if (it) {
        it.stock = Math.max(0, (it.stock || 0) - p.qty);
        it.updated_at = this.now();
        await this.put('items', it);
      }
    }

    // Generate Invoice Number
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    const invoiceNo = `INV-${ymd}-${rand}`;

    const cleanCust = customer_name ? (window.toTitleCase ? window.toTitleCase(customer_name) : customer_name.trim()) : '';

    const sale = {
      invoice_no: invoiceNo,
      total_amount: totalAmount,
      total_cost: totalCost,
      payment_type: payment_type === 'debt' ? 'kasbon' : payment_type,
      cash_received: cashReceivedNum,
      cash_change: cashChange,
      customer_name: cleanCust,
      debt_id: debtId,
      created_at: this.now()
    };

    const saleId = await this.add('sales', sale);
    sale.id = saleId;

    // Insert sale_items
    for (const p of preparedItems) {
      await this.add('sale_items', {
        sale_id: saleId,
        item_id: p.itemId,
        item_name: p.name,
        buy_price: p.buyPrice,
        sell_price: p.sellPrice,
        qty: p.qty,
        subtotal: p.subtotal
      });
    }

    const createdSales = await this.getSales({ limit: 1 });
    return createdSales[0] || sale;
  }

  // ── Reports & Summary API ─────────────────────────────────────────────────
  async getSummary() {
    const today = new Date().toISOString().substring(0, 10);
    const thisMonth = new Date().toISOString().substring(0, 7);

    const sales = await this.getAll('sales');
    const debts = await this.getAll('debts');
    const items = await this.getAll('items');

    let todaySales = 0, todayProfit = 0, todayCount = 0;
    let monthSales = 0, monthProfit = 0, monthCount = 0;

    for (const s of sales) {
      const sDate = (s.created_at || '').substring(0, 10);
      const sMonth = (s.created_at || '').substring(0, 7);
      const profit = (s.total_amount || 0) - (s.total_cost || 0);

      if (sDate === today) {
        todaySales += s.total_amount || 0;
        todayProfit += profit;
        todayCount++;
      }
      if (sMonth === thisMonth) {
        monthSales += s.total_amount || 0;
        monthProfit += profit;
        monthCount++;
      }
    }

    let totalDebt = 0, debtCount = 0;
    for (const d of debts) {
      if (d.status === 'belum_lunas') {
        totalDebt += (d.amount || 0) - (d.paid_amount || 0);
        debtCount++;
      }
    }

    let totalItems = 0, lowStockCount = 0, assetValue = 0;
    for (const it of items) {
      if (it.is_active !== 0) {
        totalItems++;
        if ((it.stock || 0) <= (it.min_stock !== undefined ? it.min_stock : 3)) {
          lowStockCount++;
        }
        assetValue += (it.stock || 0) * (it.buy_price || 0);
      }
    }

    return {
      today_sales: todaySales,
      today_profit: todayProfit,
      today_transactions: todayCount,
      month_sales: monthSales,
      month_profit: monthProfit,
      month_transactions: monthCount,
      total_debt: totalDebt,
      debt_count: debtCount,
      total_items: totalItems,
      low_stock_count: lowStockCount,
      inventory_asset_value: assetValue
    };
  }

  async getProfitLoss() {
    const sales = await this.getAll('sales');
    const saleItems = await this.getAll('sale_items');

    let grossRevenue = 0, cogsTotal = 0, cashCollected = 0;
    for (const s of sales) {
      grossRevenue += s.total_amount || 0;
      cogsTotal += s.total_cost || 0;
      if (s.payment_type === 'cash') {
        cashCollected += s.total_amount || 0;
      } else {
        cashCollected += s.cash_received || 0;
      }
    }

    const netProfit = grossRevenue - cogsTotal;
    const marginPercent = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

    // Top products
    const productStats = {};
    for (const si of saleItems) {
      const name = si.item_name || 'Produk';
      if (!productStats[name]) {
        productStats[name] = { item_name: name, total_qty: 0, total_revenue: 0, total_profit: 0 };
      }
      productStats[name].total_qty += si.qty || 0;
      productStats[name].total_revenue += si.subtotal || 0;
      productStats[name].total_profit += (si.subtotal || 0) - ((si.buy_price || 0) * (si.qty || 0));
    }

    const topProducts = Object.values(productStats).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10);

    return {
      gross_revenue: grossRevenue,
      cogs_total: cogsTotal,
      net_profit: netProfit,
      profit_margin_percent: marginPercent,
      cash_collected: cashCollected,
      top_products_by_revenue: topProducts
    };
  }

  // ── Backup & Export API ───────────────────────────────────────────────────
  async exportFullBackup() {
    const items = await this.getAll('items');
    const debts = await this.getAll('debts');
    const debt_payments = await this.getAll('debt_payments');
    const sales = await this.getAll('sales');
    const sale_items = await this.getAll('sale_items');

    return {
      version: '1.2.0',
      exported_at: this.now(),
      data: { items, debts, debt_payments, sales, sale_items }
    };
  }

  async importBackup(backupJson) {
    if (!backupJson || !backupJson.data) throw new Error('Format file backup tidak valid');
    const { items, debts, debt_payments, sales, sale_items } = backupJson.data;

    if (Array.isArray(items)) {
      for (const it of items) await this.put('items', it);
    }
    if (Array.isArray(debts)) {
      for (const d of debts) await this.put('debts', d);
    }
    if (Array.isArray(debt_payments)) {
      for (const p of debt_payments) await this.put('debt_payments', p);
    }
    if (Array.isArray(sales)) {
      for (const s of sales) await this.put('sales', s);
    }
    if (Array.isArray(sale_items)) {
      for (const si of sale_items) await this.put('sale_items', si);
    }
    return true;
  }

  // ── Dispatch Handler for API Requests ─────────────────────────────────────
  async handleRequest(method, endpoint, body = null) {
    await this.init();
    const [pathOnly, queryString] = endpoint.split('?');
    const query = {};
    if (queryString) {
      new URLSearchParams(queryString).forEach((val, key) => { query[key] = val; });
    }

    const cleanPath = pathOnly.replace(/^\/api/, '');

    // 1. Health
    if (cleanPath === '/system/health') {
      return {
        success: true,
        data: {
          status: 'ok',
          uptime_seconds: Math.floor(performance.now() / 1000),
          database: 'IndexedDB (Offline Mandiri)',
          memory_usage_mb: { rss: 18, heapUsed: 9 }
        }
      };
    }

    // 2. Summary
    if (cleanPath === '/summary' || cleanPath === '/reports/summary') {
      const summary = await this.getSummary();
      return { success: true, data: summary };
    }

    // 3. Profit & Loss
    if (cleanPath === '/reports/profit-loss') {
      const pl = await this.getProfitLoss();
      return { success: true, data: pl };
    }

    // 4. Items
    if (cleanPath === '/items') {
      if (method === 'GET') {
        const items = await this.getItems(query);
        return { success: true, data: items };
      }
      if (method === 'POST') {
        const created = await this.createItem(body);
        return { success: true, data: created };
      }
    }

    const itemStockMatch = cleanPath.match(/^\/items\/(\d+)\/stock$/);
    if (itemStockMatch && method === 'PATCH') {
      const updated = await this.updateStock(itemStockMatch[1], body.qty);
      return { success: true, data: updated };
    }

    const itemMatch = cleanPath.match(/^\/items\/(\d+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      if (method === 'GET') {
        const item = await this.getItemById(id);
        return { success: true, data: item };
      }
      if (method === 'PUT') {
        const updated = await this.updateItem(id, body);
        return { success: true, data: updated };
      }
      if (method === 'DELETE') {
        const res = await this.deleteItem(id);
        return { success: true, data: res };
      }
    }

    // 5. Debts
    if (cleanPath === '/debts') {
      if (method === 'GET') {
        const debts = await this.getDebts(query);
        return { success: true, data: debts };
      }
      if (method === 'POST') {
        const debt = await this.createDebt(body);
        return { success: true, data: debt };
      }
    }

    const debtPayMatch = cleanPath.match(/^\/debts\/(\d+)\/pay$/);
    if (debtPayMatch && method === 'POST') {
      const updated = await this.recordDebtPayment(debtPayMatch[1], body);
      return { success: true, data: updated };
    }

    const debtMatch = cleanPath.match(/^\/debts\/(\d+)$/);
    if (debtMatch) {
      const id = debtMatch[1];
      if (method === 'GET') {
        const debt = await this.getDebtById(id);
        return { success: true, data: debt };
      }
      if (method === 'PUT') {
        const updated = await this.updateDebt(id, body);
        return { success: true, data: updated };
      }
      if (method === 'DELETE') {
        const res = await this.deleteDebt(id);
        return { success: true, data: res };
      }
    }

    // 6. Sales
    if (cleanPath === '/sales') {
      if (method === 'GET') {
        const sales = await this.getSales(query);
        return { success: true, data: sales };
      }
      if (method === 'POST') {
        const sale = await this.createSale(body);
        return { success: true, data: sale };
      }
    }

    throw new Error(`Endpoint offline belum didukung: ${method} ${cleanPath}`);
  }
}

// Global Singleton
const localDb = new LocalDatabase();

if (typeof window !== 'undefined') {
  window.LocalDatabase = LocalDatabase;
  window.localDb = localDb;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LocalDatabase, localDb };
}


/* --- api.js --- */
/**
 * api.js - Dual-Engine Communication Layer
 * 1. Mode Standalone (Offline APK): Diproses langsung di IndexedDB via local-db.js tanpa fetch localhost
 * 2. Mode Server: Fetch HTTP REST API ke server Node.js / Termux
 */

function shouldUseLocalDb() {
  if (typeof window === 'undefined') return false;
  // Jika user secara eksplisit memilih sambung ke server
  if (typeof localStorage !== 'undefined' && localStorage.getItem('warungpro_force_server') === 'true') {
    return false;
  }
  // Di APK WebView (file:///android_asset/...) -> Otomatis 100% Offline Lokal!
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    return true;
  }
  // Atau jika user memilih mode offline di web browser
  if (typeof localStorage !== 'undefined' && localStorage.getItem('warungpro_mode') === 'local') {
    return true;
  }
  return false;
}

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  // ── Engine 1: Offline Standalone (IndexedDB) ──────────────────────────────
  if (shouldUseLocalDb() && typeof window !== 'undefined' && window.localDb) {
    const method = (options.method || 'GET').toUpperCase();
    let body = null;
    if (options.body) {
      try {
        body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch {
        body = options.body;
      }
    }

    try {
      return await window.localDb.handleRequest(method, endpoint, body);
    } catch (err) {
      if (!options.silent && typeof window !== 'undefined' && window.showToast) {
        window.showToast(err.message || 'Operasi database lokal gagal', 'error');
      }
      throw err;
    }
  }

  // ── Engine 2: Remote / Localhost HTTP Fetch ───────────────────────────────
  const customServer = typeof localStorage !== 'undefined' ? localStorage.getItem('warungpro_server_url') : null;
  const base = (customServer && customServer.trim()) ? customServer.trim().replace(/\/$/, '') : API_BASE;
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${base}${cleanEndpoint.replace(/^\/api/, '')}`;

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
    if (!options.silent && typeof window !== 'undefined' && window.showToast) {
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
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
  shouldUseLocalDb
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, request, shouldUseLocalDb };
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
    toast.innerHTML = '<svg id="toastIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2.5"></svg><span id="toastText"></span>';
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
        if (sheet.id === 'sheetScanner') {
          window.closeBarcodeScanner ? window.closeBarcodeScanner() : closeSheet(sheet.id);
        } else {
          closeSheet(sheet.id);
        }
      }
    });
  });
}

function showConfirmModal({ title = 'Konfirmasi', message, confirmText = 'Ya, Hapus', onConfirm }) {
  const titleEl = document.getElementById('confirmDialogTitle');
  const msgEl = document.getElementById('confirmDialogMessage');
  const btnAction = document.getElementById('btnConfirmDialogAction');

  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = message;
  if (btnAction) {
    btnAction.innerText = confirmText;
    btnAction.onclick = () => {
      closeSheet('sheetConfirmDialog');
      if (typeof onConfirm === 'function') onConfirm();
    };
  }

  openSheet('sheetConfirmDialog');
}

if (typeof window !== 'undefined') {
  window.openSheet = openSheet;
  window.closeSheet = closeSheet;
  window.initSheetBackdrops = initSheetBackdrops;
  window.showConfirmModal = showConfirmModal;
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

  const isDebt = sale.payment_type === 'debt';
  const isDebtLunas = isDebt && sale.debt_status === 'lunas';
  const payTypeStr = sale.payment_type === 'cash' 
    ? 'TUNAI' 
    : (isDebt 
        ? (isDebtLunas ? 'KASBON (LUNAS)' : 'KASBON (BELUM LUNAS)') 
        : sale.payment_type.toUpperCase());

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

  const isDebt = sale.payment_type === 'debt';
  const isDebtLunas = isDebt && sale.debt_status === 'lunas';
  const payTypeLabel = sale.payment_type === 'cash' 
    ? 'Tunai' 
    : (isDebt 
        ? (isDebtLunas ? 'Kasbon (Lunas)' : 'Kasbon (Belum Lunas)') 
        : sale.payment_type.toUpperCase());

  text += `───────────────────────\n`;
  text += `• *TOTAL*     : *Rp ${Number(sale.total_amount).toLocaleString('id-ID')}*\n`;
  text += `• *PEMBAYARAN*: ${payTypeLabel}\n`;
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
const LINEAR_1D_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar'];

// Initialize native BarcodeDetector if available (hanya 1D linear barcode, tanpa QR kotak)
if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
  try {
    barcodeDetector = new window.BarcodeDetector({ formats: LINEAR_1D_FORMATS });
  } catch (e) {
    console.warn('BarcodeDetector format init fallback:', e);
    try {
      barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    } catch {
      barcodeDetector = new window.BarcodeDetector();
    }
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
        try {
          barcodeDetector = new window.BarcodeDetector({ formats: LINEAR_1D_FORMATS });
        } catch {
          barcodeDetector = new window.BarcodeDetector();
        }
      } else {
        throw new Error('BarcodeDetector API tidak aktif di browser ini. Masukkan barcode secara manual.');
      }
    }

    const detectLoop = async () => {
      if (!isScanning) return;

      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await barcodeDetector.detect(videoEl);
          if (barcodes && barcodes.length > 0 && isScanning) {
            // Filter HANYA barcode 1D garis panjang retail (EAN-13, dsb.)
            // Abaikan barcode 2D kotak (QR Code, DataMatrix BPOM seperti (90)MD...)
            const valid1DBarcodes = barcodes.filter(b => {
              const fmt = (b.format || '').toLowerCase();
              const val = String(b.rawValue || '').trim();

              // Tolak format 2D kotak
              if (['qr_code', 'data_matrix', 'aztec', 'pdf417'].includes(fmt)) return false;

              // Tolak kode BPOM / GS1 DataMatrix 2D yang diawali (90) atau (01) atau URL web
              if (val.startsWith('(90)') || val.startsWith('(01)') || val.startsWith('http://') || val.startsWith('https://')) {
                return false;
              }

              return val.length > 0;
            });

            if (valid1DBarcodes.length > 0) {
              const rawValue = String(valid1DBarcodes[0].rawValue || '').trim();
              if (rawValue) {
                // Hentikan kamera dan loop seketika untuk mencegah double-scan
                stopScanner();
                playBeep();
                navigator.vibrate?.([60]);
                onResult(rawValue);
                return;
              }
            }
          }
        } catch (err) {
          // Frame glitch, abaikan dan lanjut frame berikutnya
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

async function exportSalesCsv() {
  if (window.api && window.api.shouldUseLocalDb() && window.localDb) {
    try {
      window.showToast?.('Menyiapkan Laporan Penjualan (CSV)...', 'info');
      const sales = await window.localDb.getSales({ limit: 10000 });
      let csv = '"No Invoice","Tanggal","Pelanggan","Metode Pembayaran","Total Belanja (Rp)","Modal HPP (Rp)","Laba Bersih (Rp)","Rincian Produk"\n';
      for (const s of sales) {
        const items = s.items || [];
        const itemsStr = items.map(it => `${it.item_name} (${it.qty}x)`).join('; ');
        const profit = (s.total_amount || 0) - (s.total_cost || 0);
        const row = [
          `"${s.invoice_no || ''}"`,
          `"${s.created_at}"`,
          `"${(s.customer_name || 'Umum').replace(/"/g, '""')}"`,
          `"${s.payment_type === 'cash' ? 'Tunai' : (s.payment_type === 'debt' ? 'Kasbon' : s.payment_type)}"`,
          s.total_amount || 0,
          s.total_cost || 0,
          profit,
          `"${itemsStr.replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-penjualan-${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.('Laporan Penjualan berhasil diunduh!', 'success');
      return;
    } catch (err) {
      window.showToast?.('Gagal ekspor penjualan: ' + err.message, 'error');
      return;
    }
  }
  window.showToast('Mengunduh Laporan Penjualan (CSV)...', 'success');
  window.location.href = '/api/reports/export/sales';
}

async function exportItemsCsv() {
  if (window.api && window.api.shouldUseLocalDb() && window.localDb) {
    try {
      window.showToast?.('Menyiapkan Data Inventaris (CSV)...', 'info');
      const items = await window.localDb.getItems();
      let csv = '"Barcode","Nama Produk","Kategori","Harga Modal (Rp)","Harga Jual (Rp)","Margin Laba (Rp)","Stok","Satuan","Nilai Aset Modal (Rp)","Status Stok"\n';
      for (const it of items) {
        const margin = (it.sell_price || 0) - (it.buy_price || 0);
        let status = 'Aman';
        if (it.stock === 0) status = 'Habis';
        else if (it.stock <= it.min_stock) status = 'Kritis';
        const assetVal = (it.stock || 0) * (it.buy_price || 0);
        const row = [
          `"${it.barcode || ''}"`,
          `"${(it.name || '').replace(/"/g, '""')}"`,
          `"${(it.category || 'Umum').replace(/"/g, '""')}"`,
          it.buy_price || 0,
          it.sell_price || 0,
          margin,
          it.stock || 0,
          `"${it.unit || 'pcs'}"`,
          assetVal,
          `"${status}"`
        ];
        csv += row.join(',') + '\n';
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stok-barang-${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.('Data Stok berhasil diunduh!', 'success');
      return;
    } catch (err) {
      window.showToast?.('Gagal ekspor inventaris: ' + err.message, 'error');
      return;
    }
  }
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

// Scanner Hook with Debounce & Fallback Lookup
let lastBarcodeScanTimestamp = 0;

async function handleBarcodeScanned(barcode) {
  const now = Date.now();
  const cleanBarcode = String(barcode || '').trim();
  if (!cleanBarcode) return;

  // Proteksi debounce: cegah eksekusi berulang dalam rentang 1.2 detik
  if (now - lastBarcodeScanTimestamp < 1200) {
    return;
  }
  lastBarcodeScanTimestamp = now;

  // Tutup scanner dan matikan stream kamera secara instan
  if (window.closeBarcodeScanner) {
    window.closeBarcodeScanner();
  } else {
    window.stopScanner?.();
    window.closeSheet('sheetScanner');
  }

  let items = window.appStore.getState().items || [];
  // Fallback: Jika cache items di memory belum termuat, ambil dari database
  if (items.length === 0 && window.api) {
    try {
      const res = await window.api.get('/items');
      if (res && res.success && Array.isArray(res.data)) {
        items = res.data;
        window.appStore.setState({ items });
      }
    } catch (e) {}
  }

  // Pencarian barcode fleksibel (abaikan whitespace & case)
  const found = items.find(it => it.is_active !== 0 && String(it.barcode || '').trim() === cleanBarcode);

  if (found) {
    try {
      window.appStore.addToCart(found, 1);
      window.showToast(`[Barcode] +1 ${found.name}`, 'success');
      window.updateCartBar?.();
      window.renderItemsUI?.();
    } catch (err) {
      window.showToast(err.message, 'warning');
    }
  } else {
    window.openItemSheet({ barcode: cleanBarcode, name: '' });
    window.showToast(`Barcode ${cleanBarcode} belum terdaftar. Silakan lengkapi produk.`, 'warning');
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

if (typeof window !== 'undefined') {
  window.loadDebts = loadDebts;
  window.renderDebtsUI = renderDebtsUI;
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
  const isDebtLunas = isDebt && sale.debt_status === 'lunas';

  let badgeClass = 'cash';
  let badgeText = 'Tunai';

  if (isDebt) {
    if (isDebtLunas) {
      badgeClass = 'debt-lunas';
      badgeText = 'Kasbon (Lunas)';
    } else {
      badgeClass = 'debt';
      badgeText = 'Kasbon (Belum Lunas)';
    }
  }

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
          <span class="badge-payment ${badgeClass}">${badgeText}</span>
        </div>
      </div>

      <div class="history-card-mid">
        <div class="history-items-summary">${itemsSummary || 'Belanjaan'}</div>
        ${sale.customer_name ? `<div class="history-customer-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${sale.customer_name}</div>` : ''}
      </div>

      <div class="history-card-bottom">
        <button class="btn-receipt-action print" onclick='printHistoryReceipt(${JSON.stringify(sale).replace(/'/g, "&apos;")})' style="${(isDebt || sale.customer_phone) ? '' : 'flex: 1; justify-content: center;'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
          <span>Cetak Struk</span>
        </button>
        ${(isDebt || sale.customer_phone) ? `
          <button class="btn-receipt-action wa" onclick='shareHistoryWhatsApp(${JSON.stringify(sale).replace(/'/g, "&apos;")})'>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Kirim WA</span>
          </button>
        ` : ''}
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
      const isDebt = s.payment_type === 'debt';
      const statusText = isDebt 
        ? (s.debt_status === 'lunas' ? 'kasbon lunas' : 'kasbon belum lunas') 
        : 'tunai';
      const matchStatus = statusText.includes(search);
      if (!matchInv && !matchCust && !matchItems && !matchStatus) return false;
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
const DEFAULT_DEBT_REMINDER_TEMPLATE = 
`Halo Kak *{nama}*,
Salam hangat dari {toko} 🙏

Berikut rincian catatan kasbon yang tercatat:
• *Sisa Kasbon* : *{sisa}*
• *Total Kasbon*: {total}
• *Tanggal*     : {tanggal}
• *Keterangan*  : {rincian}

Jika ada waktu luang, mohon dibantu pelunasannya ya Kak. Terima kasih banyak atas kerjasamanya! 😊`;

async function checkSystemHealth() {
  loadDebtTemplateSetting();
  try {
    const res = await window.api.get('/system/health');
    if (res.success) {
      const data = res.data;
      const memEl = document.getElementById('sysMemoryInfo');
      const uptimeEl = document.getElementById('sysUptimeInfo');
      const dbEl = document.getElementById('sysDbInfo');

      if (memEl) memEl.innerText = `${data.memory_usage_mb.rss} MB (Heap: ${data.memory_usage_mb.heapUsed} MB)`;
      if (uptimeEl) {
        const hours = Math.floor(data.uptime_seconds / 3600);
        const mins = Math.floor((data.uptime_seconds % 3600) / 60);
        const secs = data.uptime_seconds % 60;
        const timeStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m ${secs}d`;
        uptimeEl.innerText = `Sesi Aktif: ${timeStr}`;
      }
      if (dbEl) dbEl.innerText = data.database || 'SQLite WAL Mode';
    }
  } catch (err) {
    console.error('Failed to get system health:', err);
  }
}

function loadDebtTemplateSetting() {
  const el = document.getElementById('settingDebtTemplateText');
  if (!el) return;
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_debt_reminder_template') : null;
  el.value = (saved && saved.trim()) ? saved : DEFAULT_DEBT_REMINDER_TEMPLATE;
}

function saveDebtTemplateSetting() {
  const el = document.getElementById('settingDebtTemplateText');
  if (!el) return;
  const val = el.value.trim();
  if (!val) {
    window.showToast?.('Template tagihan tidak boleh kosong', 'warning');
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('custom_debt_reminder_template', val);
  }
  window.showToast?.('Template tagihan WhatsApp berhasil disimpan!', 'success');
}

function resetDebtTemplateToDefault() {
  const el = document.getElementById('settingDebtTemplateText');
  if (el) el.value = DEFAULT_DEBT_REMINDER_TEMPLATE;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('custom_debt_reminder_template');
  }
  window.showToast?.('Template tagihan dikembalikan ke default', 'info');
}

function insertReminderTag(tag) {
  const el = document.getElementById('settingDebtTemplateText');
  if (!el) return;
  const start = el.selectionStart || el.value.length;
  const end = el.selectionEnd || el.value.length;
  const text = el.value;
  el.value = text.substring(0, start) + tag + text.substring(end);
  el.focus();
  el.setSelectionRange(start + tag.length, start + tag.length);
}

async function downloadDatabaseBackup() {
  if (window.api && window.api.shouldUseLocalDb() && window.localDb) {
    try {
      window.showToast?.('Menyiapkan file backup...', 'info');
      const backup = await window.localDb.exportFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date().toISOString().substring(0, 10);
      a.href = url;
      a.download = `warungpro-backup-${d}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.('Backup database lokal berhasil diunduh!', 'success');
      return;
    } catch (err) {
      window.showToast?.('Gagal backup: ' + err.message, 'error');
      return;
    }
  }
  window.showToast('Memulai unduh backup warung.db...', 'success');
  window.location.href = '/api/system/backup';
}

if (typeof window !== 'undefined') {
  window.DEFAULT_DEBT_REMINDER_TEMPLATE = DEFAULT_DEBT_REMINDER_TEMPLATE;
  window.checkSystemHealth = checkSystemHealth;
  window.loadDebtTemplateSetting = loadDebtTemplateSetting;
  window.saveDebtTemplateSetting = saveDebtTemplateSetting;
  window.resetDebtTemplateToDefault = resetDebtTemplateToDefault;
  window.insertReminderTag = insertReminderTag;
  window.downloadDatabaseBackup = downloadDatabaseBackup;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_DEBT_REMINDER_TEMPLATE,
    checkSystemHealth,
    loadDebtTemplateSetting,
    saveDebtTemplateSetting,
    resetDebtTemplateToDefault,
    insertReminderTag,
    downloadDatabaseBackup
  };
}


/* --- app.js --- */
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
    textEl.innerHTML = `<span style="font-weight: 800; color: var(--emerald);">+ Nama Pelanggan Baru</span>`;
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

  window.openSheet('sheetItem');
}

async function deleteCurrentItem() {
  const id = document.getElementById('itemIdField')?.value;
  const name = document.getElementById('itemNameField')?.value || 'produk ini';
  if (!id) return;

  const executeDelete = async () => {
    try {
      const res = await window.api.delete(`/items/${id}`);
      if (res.success) {
        window.closeSheet('sheetItem');
        window.showToast(`Produk "${name}" berhasil dihapus`, 'success');
        window.appStore.removeFromCart(Number(id));
        window.loadItems?.();
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


