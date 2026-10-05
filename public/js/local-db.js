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
