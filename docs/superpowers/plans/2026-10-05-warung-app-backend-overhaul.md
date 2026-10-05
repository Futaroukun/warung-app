# Backend Architecture & Database Engine Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah backend monolitik `server.js` menjadi arsitektur modular berlapis (layered architecture) dengan engine SQLite berperforma tinggi (WAL mode, indexing, atomic transactions), standardisasi respons API, centralized error handling, serta sistem backup data instan.

**Architecture:** Menggunakan arsitektur modular Express berlapis (`config/`, `routes/`, `controllers/`, `services/`, `middlewares/`) dengan driver native `node:sqlite` DatabaseSync. Business logic dan transaksi atomik dikelola di service layer untuk memastikan konsistensi mutasi stok dan pencatatan transaksi kasir.

**Tech Stack:** Node.js (v22+ with `node:sqlite`), Express 5, `node:test` dan `node:assert` untuk unit/integration testing tanpa dependensi eksternal berat.

**Spec:** `docs/superpowers/specs/2026-10-05-warung-app-backend-overhaul-design.md`

## Global Constraints
- Tetap menggunakan `node:sqlite` (DatabaseSync) bawaan Node.js tanpa dependensi native C++ eksternal agar 100% stabil di Termux.
- Menjaga backward-compatibility pada endpoint API yang dikonsumsi oleh `public/index.html` dan Android WebView.
- Semua operasi tulis data majemuk (penjualan kasir + potong stok + kasbon) wajib dieksekusi secara atomik dalam blok transaksi SQLite.
- Tidak boleh menghapus data warung yang sudah ada (`warung.db`); skema baru harus diinisialisasi melalui migrasi aman (`ALTER TABLE ADD COLUMN`).

---

### Task 1: Database Engine & Migration Module

**Files:**
- Create: `src/config/database.js`
- Test: `tests/db.test.js`

**Interfaces:**
- Consumes: `node:sqlite`, `node:path`
- Produces: `getDb(customPath)` function returning an initialized SQLite database connection with WAL mode, pragmas, indices, and auto-migrations applied.

- [ ] **Step 1: Write the failing test for Database Engine**

Create `tests/db.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../src/config/database');

test('Database Engine: initialization, pragmas, tables, and rollback safety', async (t) => {
  const testDbPath = path.join(__dirname, 'test-warung.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = getDb(testDbPath);

  await t.test('Applies WAL journal mode and foreign keys', () => {
    const journalMode = db.prepare('PRAGMA journal_mode').get();
    assert.equal(journalMode.journal_mode.toLowerCase(), 'wal');

    const foreignKeys = db.prepare('PRAGMA foreign_keys').get();
    assert.equal(foreignKeys.foreign_keys, 1);
  });

  await t.test('Creates required tables and indices', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    assert.ok(tables.includes('items'));
    assert.ok(tables.includes('sales'));
    assert.ok(tables.includes('sale_items'));
    assert.ok(tables.includes('debts'));
    assert.ok(tables.includes('debt_payments'));

    const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name);
    assert.ok(indices.includes('idx_items_name'));
    assert.ok(indices.includes('idx_sales_created_at'));
  });

  await t.test('Rolls back transaction on error without corrupting data', () => {
    db.prepare("INSERT INTO items (name, buy_price, sell_price, stock) VALUES ('Kopi Sachet', 1000, 1500, 10)").run();
    
    assert.throws(() => {
      db.exec('BEGIN TRANSACTION');
      db.prepare("UPDATE items SET stock = stock - 5 WHERE name = 'Kopi Sachet'").run();
      // sengaja throw error untuk memicu rollback
      throw new Error('Simulated failure');
    });
    db.exec('ROLLBACK');

    const item = db.prepare("SELECT stock FROM items WHERE name = 'Kopi Sachet'").get();
    assert.equal(item.stock, 10);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const walPath = `${testDbPath}-wal`;
  const shmPath = `${testDbPath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/db.test.js`
Expected: FAIL with "Cannot find module '../src/config/database'"

- [ ] **Step 3: Implement database.js with pragmas, migrations, and indexing**

Create `src/config/database.js`:
```javascript
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DEFAULT_DB_PATH = path.join(__dirname, '../../warung.db');

function initPragmas(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA cache_size = -8000;
    PRAGMA temp_store = MEMORY;
  `);
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Umum',
      buy_price INTEGER DEFAULT 0,
      sell_price INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 3,
      unit TEXT DEFAULT 'pcs',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      amount INTEGER NOT NULL,
      paid_amount INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'belum_lunas' CHECK(status IN ('belum_lunas', 'lunas')),
      due_date DATE DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE,
      total_amount INTEGER NOT NULL,
      total_cost INTEGER DEFAULT 0,
      payment_type TEXT NOT NULL,
      cash_received INTEGER DEFAULT 0,
      cash_change INTEGER DEFAULT 0,
      customer_name TEXT DEFAULT '',
      debt_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      buy_price INTEGER DEFAULT 0,
      sell_price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      subtotal INTEGER NOT NULL
    );
  `);
}

function initIndices(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
    CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customer_name);
    CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
  `);
}

function runSafeMigrations(db) {
  const getColumns = (tableName) => {
    try {
      return db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
    } catch {
      return [];
    }
  };

  const itemCols = getColumns('items');
  if (itemCols.length && !itemCols.includes('barcode')) {
    db.exec('ALTER TABLE items ADD COLUMN barcode TEXT UNIQUE;');
  }
  if (itemCols.length && !itemCols.includes('unit')) {
    db.exec("ALTER TABLE items ADD COLUMN unit TEXT DEFAULT 'pcs';");
  }
  if (itemCols.length && !itemCols.includes('is_active')) {
    db.exec('ALTER TABLE items ADD COLUMN is_active INTEGER DEFAULT 1;');
  }

  const salesCols = getColumns('sales');
  if (salesCols.length && !salesCols.includes('invoice_no')) {
    db.exec('ALTER TABLE sales ADD COLUMN invoice_no TEXT;');
  }
  if (salesCols.length && !salesCols.includes('total_cost')) {
    db.exec('ALTER TABLE sales ADD COLUMN total_cost INTEGER DEFAULT 0;');
  }

  const saleItemCols = getColumns('sale_items');
  if (saleItemCols.length && !saleItemCols.includes('buy_price')) {
    db.exec('ALTER TABLE sale_items ADD COLUMN buy_price INTEGER DEFAULT 0;');
  }

  const debtCols = getColumns('debts');
  if (debtCols.length && !debtCols.includes('due_date')) {
    db.exec('ALTER TABLE debts ADD COLUMN due_date DATE DEFAULT NULL;');
  }
}

let activeDbInstance = null;

function getDb(customPath = null) {
  if (customPath) {
    const db = new DatabaseSync(customPath);
    initPragmas(db);
    initTables(db);
    runSafeMigrations(db);
    initIndices(db);
    return db;
  }

  if (!activeDbInstance) {
    activeDbInstance = new DatabaseSync(DEFAULT_DB_PATH);
    initPragmas(activeDbInstance);
    initTables(activeDbInstance);
    runSafeMigrations(activeDbInstance);
    initIndices(activeDbInstance);
  }
  return activeDbInstance;
}

module.exports = {
  getDb,
  DEFAULT_DB_PATH
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/db.test.js`
Expected: PASS with all subtests green

- [ ] **Step 5: Commit**

```bash
git add src/config/database.js tests/db.test.js
git commit -m "feat(db): modularize database engine with WAL mode, indexing, and auto-migrations"
```

---

### Task 2: Core Middlewares (Logger, Validator, ErrorHandler)

**Files:**
- Create: `src/middlewares/logger.js`
- Create: `src/middlewares/validator.js`
- Create: `src/middlewares/errorHandler.js`
- Test: `tests/middlewares.test.js`

**Interfaces:**
- `logger`: Express middleware logging method, url, and response duration.
- `validator.toTitleCase(str)`: String sanitizer for product names & categories.
- `validator.formatCurrency(num)`: Number validator.
- `errorHandler`: Centralized Express error handler formatting `{ success: false, error: message }` with appropriate status code.

- [ ] **Step 1: Write test for middlewares**

Create `tests/middlewares.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { toTitleCase } = require('../src/middlewares/validator');
const { errorHandler } = require('../src/middlewares/errorHandler');

test('Middlewares: Validator and Error Handler', async (t) => {
  await t.test('toTitleCase normalizes words and spacing', () => {
    assert.equal(toTitleCase('kopi tubruk cap lele'), 'Kopi Tubruk Cap Lele');
    assert.equal(toTitleCase('  indomie kuah kari   ayam '), 'Indomie Kuah Kari Ayam');
    assert.equal(toTitleCase(''), '');
    assert.equal(toTitleCase(null), '');
  });

  await t.test('errorHandler returns formatted JSON and status', () => {
    let responseStatus = null;
    let responseJson = null;

    const mockRes = {
      status(code) { responseStatus = code; return this; },
      json(payload) { responseJson = payload; return this; }
    };

    const err = new Error('Barang tidak ditemukan');
    err.status = 404;

    errorHandler(err, {}, mockRes, () => {});
    assert.equal(responseStatus, 404);
    assert.deepEqual(responseJson, { success: false, error: 'Barang tidak ditemukan' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/middlewares.test.js`
Expected: FAIL with missing modules

- [ ] **Step 3: Implement middlewares**

Create `src/middlewares/logger.js`:
```javascript
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
}

module.exports = { requestLogger };
```

Create `src/middlewares/validator.js`:
```javascript
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\(\)\[\]\/\-_.,])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

module.exports = { toTitleCase };
```

Create `src/middlewares/errorHandler.js`:
```javascript
function errorHandler(err, req, res, next) {
  console.error(`[ERROR ${new Date().toISOString()}]`, err);

  const status = err.status || (err.message && err.message.includes('UNIQUE constraint') ? 409 : 500);
  const message = err.clientMessage || err.message || 'Terjadi kesalahan pada server';

  res.status(status).json({
    success: false,
    error: message
  });
}

module.exports = { errorHandler };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/middlewares.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/middlewares/ tests/middlewares.test.js
git commit -m "feat(middlewares): add request logger, validator, and centralized error handler"
```

---

### Task 3: Items Module (Service, Controller, Routes)

**Files:**
- Create: `src/services/items.service.js`
- Create: `src/controllers/items.controller.js`
- Create: `src/routes/items.routes.js`
- Test: `tests/items.test.js`

**Interfaces:**
- `itemsService`: `getAll(options)`, `getById(id)`, `getByBarcode(barcode)`, `create(data)`, `update(id, data)`, `updateStock(id, qty, reason)`, `delete(id)`
- Routes: `GET /api/items`, `GET /api/items/:id`, `GET /api/items/barcode/:barcode`, `POST /api/items`, `PUT /api/items/:id`, `PATCH /api/items/:id/stock`, `DELETE /api/items/:id`

- [ ] **Step 1: Write test for Items Module**

Create `tests/items.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../src/config/database');
const { ItemsService } = require('../src/services/items.service');

test('ItemsService: CRUD and validation', async (t) => {
  const testDbPath = path.join(__dirname, 'test-items.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);
  const service = new ItemsService(db);

  await t.test('Creates new item and formats title case', () => {
    const item = service.create({
      name: 'teh pucuk harum 350ml',
      category: 'minuman',
      buy_price: 3000,
      sell_price: 4000,
      stock: 24,
      min_stock: 5,
      barcode: '8991234567890'
    });
    assert.equal(item.name, 'Teh Pucuk Harum 350ml');
    assert.equal(item.category, 'Minuman');
    assert.equal(item.stock, 24);
  });

  await t.test('Prevents duplicate item names', () => {
    assert.throws(() => {
      service.create({ name: 'Teh Pucuk Harum 350ml', sell_price: 4000 });
    }, /sudah ada/);
  });

  await t.test('Finds item by barcode', () => {
    const found = service.getByBarcode('8991234567890');
    assert.ok(found);
    assert.equal(found.name, 'Teh Pucuk Harum 350ml');
  });

  await t.test('Updates stock directly', () => {
    const item = service.getByBarcode('8991234567890');
    const updated = service.updateStock(item.id, -4);
    assert.equal(updated.stock, 20);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/items.test.js`
Expected: FAIL with "Cannot find module '../src/services/items.service'"

- [ ] **Step 3: Implement Items Service, Controller, and Routes**

Create `src/services/items.service.js`:
```javascript
const { toTitleCase } = require('../middlewares/validator');

class ItemsService {
  constructor(db) {
    this.db = db;
  }

  getAll({ search, category, low_stock } = {}) {
    let query = 'SELECT * FROM items WHERE is_active = 1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR barcode LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category.trim());
    }

    if (low_stock === 'true' || low_stock === true) {
      query += ' AND stock <= min_stock';
    }

    query += ' ORDER BY name ASC';
    return this.db.prepare(query).all(...params);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(id);
  }

  getByBarcode(barcode) {
    if (!barcode) return null;
    return this.db.prepare('SELECT * FROM items WHERE barcode = ? AND is_active = 1').get(barcode.trim());
  }

  create(data) {
    const { name, category, buy_price, sell_price, stock, min_stock, barcode, unit } = data;
    if (!name || !name.trim()) {
      const err = new Error('Nama barang wajib diisi');
      err.status = 400;
      throw err;
    }

    const cleanName = toTitleCase(name);
    const existing = this.db.prepare('SELECT id, name FROM items WHERE LOWER(TRIM(name)) = LOWER(?) AND is_active = 1').get(cleanName);
    if (existing) {
      const err = new Error(`Produk "${existing.name}" sudah ada di daftar stok!`);
      err.status = 409;
      throw err;
    }

    const cleanBarcode = barcode && barcode.trim() ? barcode.trim() : null;
    if (cleanBarcode) {
      const barcodeExists = this.db.prepare('SELECT id, name FROM items WHERE barcode = ? AND is_active = 1').get(cleanBarcode);
      if (barcodeExists) {
        const err = new Error(`Barcode sudah digunakan oleh "${barcodeExists.name}"!`);
        err.status = 409;
        throw err;
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO items (barcode, name, category, buy_price, sell_price, stock, min_stock, unit, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      cleanBarcode,
      cleanName,
      toTitleCase(category || 'Umum'),
      Number(buy_price) || 0,
      Number(sell_price) || 0,
      Number(stock) || 0,
      Number(min_stock) >= 0 ? Number(min_stock) : 3,
      unit ? unit.trim().toLowerCase() : 'pcs'
    );

    return this.getById(result.lastInsertRowid);
  }

  update(id, data) {
    const { name, category, buy_price, sell_price, stock, min_stock, barcode, unit } = data;
    const existing = this.getById(id);
    if (!existing) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const cleanName = name ? toTitleCase(name) : existing.name;
    const nameCheck = this.db.prepare('SELECT id, name FROM items WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND is_active = 1').get(cleanName, id);
    if (nameCheck) {
      const err = new Error(`Nama produk "${nameCheck.name}" sudah digunakan produk lain!`);
      err.status = 409;
      throw err;
    }

    const cleanBarcode = barcode !== undefined ? (barcode ? barcode.trim() : null) : existing.barcode;
    if (cleanBarcode) {
      const barcodeCheck = this.db.prepare('SELECT id, name FROM items WHERE barcode = ? AND id != ? AND is_active = 1').get(cleanBarcode, id);
      if (barcodeCheck) {
        const err = new Error(`Barcode sudah digunakan oleh produk "${barcodeCheck.name}"!`);
        err.status = 409;
        throw err;
      }
    }

    const stmt = this.db.prepare(`
      UPDATE items
      SET barcode = ?, name = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, unit = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    stmt.run(
      cleanBarcode,
      cleanName,
      toTitleCase(category || existing.category),
      buy_price !== undefined ? Number(buy_price) : existing.buy_price,
      sell_price !== undefined ? Number(sell_price) : existing.sell_price,
      stock !== undefined ? Number(stock) : existing.stock,
      min_stock !== undefined ? Number(min_stock) : existing.min_stock,
      unit !== undefined ? unit.trim().toLowerCase() : existing.unit,
      id
    );

    return this.getById(id);
  }

  updateStock(id, diffQty) {
    const item = this.getById(id);
    if (!item) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const newStock = item.stock + Number(diffQty);
    this.db.prepare("UPDATE items SET stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newStock, id);
    return this.getById(id);
  }

  delete(id) {
    const existing = this.getById(id);
    if (!existing) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    // Soft delete to protect relational sales history
    this.db.prepare("UPDATE items SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
    return { id: Number(id), deleted: true };
  }
}

module.exports = { ItemsService };
```

Create `src/controllers/items.controller.js`:
```javascript
class ItemsController {
  constructor(service) {
    this.service = service;
  }

  getAll = (req, res, next) => {
    try {
      const items = this.service.getAll(req.query);
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  };

  getById = (req, res, next) => {
    try {
      const item = this.service.getById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: 'Barang tidak ditemukan' });
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  getByBarcode = (req, res, next) => {
    try {
      const item = this.service.getByBarcode(req.params.barcode);
      if (!item) return res.status(404).json({ success: false, error: 'Barang dengan barcode ini tidak ditemukan' });
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  create = (req, res, next) => {
    try {
      const newItem = this.service.create(req.body);
      res.status(201).json({ success: true, data: newItem });
    } catch (err) {
      next(err);
    }
  };

  update = (req, res, next) => {
    try {
      const updated = this.service.update(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  updateStock = (req, res, next) => {
    try {
      const { qty } = req.body;
      if (qty === undefined) return res.status(400).json({ success: false, error: 'Jumlah qty wajib diisi' });
      const updated = this.service.updateStock(req.params.id, qty);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  delete = (req, res, next) => {
    try {
      const result = this.service.delete(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ItemsController };
```

Create `src/routes/items.routes.js`:
```javascript
const { Router } = require('express');
const { ItemsService } = require('../services/items.service');
const { ItemsController } = require('../controllers/items.controller');

function createItemsRouter(db) {
  const router = Router();
  const service = new ItemsService(db);
  const controller = new ItemsController(service);

  router.get('/', controller.getAll);
  router.get('/barcode/:barcode', controller.getByBarcode);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.patch('/:id/stock', controller.updateStock);
  router.delete('/:id', controller.delete);

  return router;
}

module.exports = { createItemsRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/items.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/items.service.js src/controllers/items.controller.js src/routes/items.routes.js tests/items.test.js
git commit -m "feat(items): add items service, controller, and routes with barcode support"
```

---

### Task 4: Sales Module with Atomic Transactions

**Files:**
- Create: `src/services/sales.service.js`
- Create: `src/controllers/sales.controller.js`
- Create: `src/routes/sales.routes.js`
- Test: `tests/sales.test.js`

**Interfaces:**
- `salesService`: `createTransaction(data)`, `getAll(options)`, `getById(id)`
- Routes: `GET /api/sales`, `GET /api/sales/:id`, `POST /api/sales`

- [ ] **Step 1: Write test for Sales Module with Atomic Rollback**

Create `tests/sales.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../src/config/database');
const { ItemsService } = require('../src/services/items.service');
const { SalesService } = require('../src/services/sales.service');

test('SalesService: atomic transaction and stock deduction', async (t) => {
  const testDbPath = path.join(__dirname, 'test-sales.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);
  const itemsService = new ItemsService(db);
  const salesService = new SalesService(db);

  const item1 = itemsService.create({ name: 'Beras 5kg', buy_price: 60000, sell_price: 70000, stock: 5 });
  const item2 = itemsService.create({ name: 'Minyak Goreng 1L', buy_price: 15000, sell_price: 18000, stock: 10 });

  await t.test('Creates sale and reduces item stock atomically', () => {
    const sale = salesService.createTransaction({
      items: [
        { id: item1.id, qty: 2 },
        { id: item2.id, qty: 1 }
      ],
      payment_type: 'cash',
      cash_received: 160000
    });

    assert.equal(sale.total_amount, (70000 * 2) + 18000); // 158000
    assert.equal(sale.total_cost, (60000 * 2) + 15000);   // 135000
    assert.equal(sale.cash_change, 2000);
    assert.ok(sale.invoice_no.startsWith('INV-'));

    // Check stock was deducted
    const updatedItem1 = itemsService.getById(item1.id);
    const updatedItem2 = itemsService.getById(item2.id);
    assert.equal(updatedItem1.stock, 3);
    assert.equal(updatedItem2.stock, 9);
  });

  await t.test('Rolls back transaction when stock is insufficient', () => {
    assert.throws(() => {
      salesService.createTransaction({
        items: [{ id: item1.id, qty: 10 }], // only 3 in stock
        payment_type: 'cash',
        cash_received: 700000
      });
    }, /Stok.*tidak mencukupi/);

    // Verify stock remains untouched after failure
    const currentItem1 = itemsService.getById(item1.id);
    assert.equal(currentItem1.stock, 3);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sales.test.js`
Expected: FAIL with missing module

- [ ] **Step 3: Implement Sales Service, Controller, and Routes**

Create `src/services/sales.service.js`:
```javascript
class SalesService {
  constructor(db) {
    this.db = db;
  }

  generateInvoiceNo() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${dateStr}-${randomSuffix}`;
  }

  getAll({ limit = 50, offset = 0, date } = {}) {
    let query = 'SELECT * FROM sales';
    const params = [];

    if (date) {
      query += " WHERE date(created_at) = date(?)";
      params.push(date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const sales = this.db.prepare(query).all(...params);

    // Attach sale items to each sale
    const getItemStmt = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
    return sales.map(sale => ({
      ...sale,
      items: getItemStmt.all(sale.id)
    }));
  }

  getById(id) {
    const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return null;

    sale.items = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    return sale;
  }

  createTransaction({ items, payment_type = 'cash', cash_received = 0, customer_name = '', notes = '' }) {
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Keranjang belanja kosong');
      err.status = 400;
      throw err;
    }

    this.db.exec('BEGIN TRANSACTION');

    try {
      let totalAmount = 0;
      let totalCost = 0;
      const preparedItems = [];

      for (const cartItem of items) {
        const item = this.db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(cartItem.id);
        if (!item) {
          const err = new Error(`Barang dengan ID ${cartItem.id} tidak ditemukan`);
          err.status = 404;
          throw err;
        }

        const qty = Number(cartItem.qty);
        if (qty <= 0) {
          const err = new Error(`Jumlah untuk barang "${item.name}" harus lebih dari 0`);
          err.status = 400;
          throw err;
        }

        if (item.stock < qty) {
          const err = new Error(`Stok untuk "${item.name}" tidak mencukupi (sisa ${item.stock})`);
          err.status = 400;
          throw err;
        }

        const subtotal = item.sell_price * qty;
        const itemCost = (item.buy_price || 0) * qty;

        totalAmount += subtotal;
        totalCost += itemCost;

        preparedItems.push({
          itemId: item.id,
          name: item.name,
          buyPrice: item.buy_price || 0,
          sellPrice: item.sell_price,
          qty,
          subtotal
        });
      }

      let cashReceivedNum = Number(cash_received) || 0;
      let cashChange = 0;
      let debtId = null;

      if (payment_type === 'cash') {
        if (cashReceivedNum < totalAmount) {
          const err = new Error('Uang tunai yang diterima kurang dari total belanja');
          err.status = 400;
          throw err;
        }
        cashChange = cashReceivedNum - totalAmount;
      } else if (payment_type === 'debt') {
        if (!customer_name || !customer_name.trim()) {
          const err = new Error('Nama pelanggan wajib diisi untuk transaksi kasbon / hutang');
          err.status = 400;
          throw err;
        }

        const insertDebt = this.db.prepare(`
          INSERT INTO debts (customer_name, amount, paid_amount, notes, status, created_at, updated_at)
          VALUES (?, ?, 0, ?, 'belum_lunas', datetime('now', 'localtime'), datetime('now', 'localtime'))
        `);
        const debtResult = insertDebt.run(customer_name.trim(), totalAmount, notes ? notes.trim() : 'Transaksi Kasir');
        debtId = debtResult.lastInsertRowid;
      }

      const invoiceNo = this.generateInvoiceNo();
      const insertSale = this.db.prepare(`
        INSERT INTO sales (invoice_no, total_amount, total_cost, payment_type, cash_received, cash_change, customer_name, debt_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `);

      const saleResult = insertSale.run(
        invoiceNo,
        totalAmount,
        totalCost,
        payment_type,
        cashReceivedNum,
        cashChange,
        customer_name ? customer_name.trim() : '',
        debtId
      );

      const saleId = saleResult.lastInsertRowid;

      // Insert sale items and deduct inventory
      const insertSaleItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, item_name, buy_price, sell_price, qty, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const deductStock = this.db.prepare(`
        UPDATE items
        SET stock = stock - ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const pItem of preparedItems) {
        insertSaleItem.run(saleId, pItem.itemId, pItem.name, pItem.buyPrice, pItem.sellPrice, pItem.qty, pItem.subtotal);
        deductStock.run(pItem.qty, pItem.itemId);
      }

      this.db.exec('COMMIT');

      return this.getById(saleId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

module.exports = { SalesService };
```

Create `src/controllers/sales.controller.js`:
```javascript
class SalesController {
  constructor(service) {
    this.service = service;
  }

  getAll = (req, res, next) => {
    try {
      const sales = this.service.getAll(req.query);
      res.json({ success: true, data: sales });
    } catch (err) {
      next(err);
    }
  };

  getById = (req, res, next) => {
    try {
      const sale = this.service.getById(req.params.id);
      if (!sale) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
      res.json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  };

  create = (req, res, next) => {
    try {
      const sale = this.service.createTransaction(req.body);
      res.status(201).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { SalesController };
```

Create `src/routes/sales.routes.js`:
```javascript
const { Router } = require('express');
const { SalesService } = require('../services/sales.service');
const { SalesController } = require('../controllers/sales.controller');

function createSalesRouter(db) {
  const router = Router();
  const service = new SalesService(db);
  const controller = new SalesController(service);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);

  return router;
}

module.exports = { createSalesRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sales.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/sales.service.js src/controllers/sales.controller.js src/routes/sales.routes.js tests/sales.test.js
git commit -m "feat(sales): implement sales transaction service with atomic rollback and stock safety"
```

---

### Task 5: Debts & Payments Module

**Files:**
- Create: `src/services/debts.service.js`
- Create: `src/controllers/debts.controller.js`
- Create: `src/routes/debts.routes.js`
- Test: `tests/debts.test.js`

**Interfaces:**
- `debtsService`: `getAll(options)`, `getById(id)`, `create(data)`, `recordPayment(id, data)`, `delete(id)`
- Routes: `GET /api/debts`, `GET /api/debts/:id`, `POST /api/debts`, `POST /api/debts/:id/pay`, `DELETE /api/debts/:id`

- [ ] **Step 1: Write test for Debts Module**

Create `tests/debts.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../src/config/database');
const { DebtsService } = require('../src/services/debts.service');

test('DebtsService: tracking, installment payments, and status update', async (t) => {
  const testDbPath = path.join(__dirname, 'test-debts.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);
  const service = new DebtsService(db);

  let debtId;

  await t.test('Creates new debt', () => {
    const debt = service.create({
      customer_name: 'Pak Budi',
      phone: '08123456789',
      amount: 50000,
      notes: 'Beli rokok & kopi'
    });
    assert.equal(debt.customer_name, 'Pak Budi');
    assert.equal(debt.amount, 50000);
    assert.equal(debt.paid_amount, 0);
    assert.equal(debt.status, 'belum_lunas');
    debtId = debt.id;
  });

  await t.test('Records installment payment without completing debt', () => {
    const updated = service.recordPayment(debtId, { amount: 20000, notes: 'Bayar sebagian' });
    assert.equal(updated.paid_amount, 20000);
    assert.equal(updated.status, 'belum_lunas');
    assert.equal(updated.payments.length, 1);
  });

  await t.test('Completes debt when fully paid', () => {
    const updated = service.recordPayment(debtId, { amount: 30000, notes: 'Pelunasan' });
    assert.equal(updated.paid_amount, 50000);
    assert.equal(updated.status, 'lunas');
    assert.equal(updated.payments.length, 2);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/debts.test.js`
Expected: FAIL with missing module

- [ ] **Step 3: Implement Debts Service, Controller, and Routes**

Create `src/services/debts.service.js`:
```javascript
const { toTitleCase } = require('../middlewares/validator');

class DebtsService {
  constructor(db) {
    this.db = db;
  }

  getAll({ status, search } = {}) {
    let query = 'SELECT * FROM debts WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (customer_name LIKE ? OR phone LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += " ORDER BY CASE WHEN status = 'belum_lunas' THEN 0 ELSE 1 END, created_at DESC";
    const debts = this.db.prepare(query).all(...params);

    const getPayments = this.db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY payment_date DESC');
    return debts.map(d => ({
      ...d,
      payments: getPayments.all(d.id)
    }));
  }

  getById(id) {
    const debt = this.db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
    if (!debt) return null;

    debt.payments = this.db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY payment_date DESC').all(id);
    return debt;
  }

  create({ customer_name, phone = '', amount, notes = '', due_date = null }) {
    if (!customer_name || !customer_name.trim()) {
      const err = new Error('Nama pelanggan wajib diisi');
      err.status = 400;
      throw err;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      const err = new Error('Nominal hutang harus lebih dari 0');
      err.status = 400;
      throw err;
    }

    const stmt = this.db.prepare(`
      INSERT INTO debts (customer_name, phone, amount, paid_amount, notes, status, due_date, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, 'belum_lunas', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      toTitleCase(customer_name),
      phone ? phone.trim() : '',
      numAmount,
      notes ? notes.trim() : '',
      due_date || null
    );

    return this.getById(result.lastInsertRowid);
  }

  recordPayment(id, { amount, notes = '' }) {
    const debt = this.getById(id);
    if (!debt) {
      const err = new Error('Catatan hutang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      const err = new Error('Nominal pembayaran harus lebih dari 0');
      err.status = 400;
      throw err;
    }

    const remaining = debt.amount - debt.paid_amount;
    if (payAmount > remaining) {
      const err = new Error(`Nominal pembayaran melebihi sisa hutang (sisa: Rp ${remaining.toLocaleString('id-ID')})`);
      err.status = 400;
      throw err;
    }

    this.db.exec('BEGIN TRANSACTION');
    try {
      this.db.prepare(`
        INSERT INTO debt_payments (debt_id, amount, notes, payment_date)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
      `).run(id, payAmount, notes ? notes.trim() : '');

      const newPaidAmount = debt.paid_amount + payAmount;
      const newStatus = newPaidAmount >= debt.amount ? 'lunas' : 'belum_lunas';

      this.db.prepare(`
        UPDATE debts
        SET paid_amount = ?, status = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newPaidAmount, newStatus, id);

      this.db.exec('COMMIT');
      return this.getById(id);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  delete(id) {
    const debt = this.getById(id);
    if (!debt) {
      const err = new Error('Catatan hutang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    this.db.prepare('DELETE FROM debts WHERE id = ?').run(id);
    return { id: Number(id), deleted: true };
  }
}

module.exports = { DebtsService };
```

Create `src/controllers/debts.controller.js`:
```javascript
class DebtsController {
  constructor(service) {
    this.service = service;
  }

  getAll = (req, res, next) => {
    try {
      const debts = this.service.getAll(req.query);
      res.json({ success: true, data: debts });
    } catch (err) {
      next(err);
    }
  };

  getById = (req, res, next) => {
    try {
      const debt = this.service.getById(req.params.id);
      if (!debt) return res.status(404).json({ success: false, error: 'Hutang tidak ditemukan' });
      res.json({ success: true, data: debt });
    } catch (err) {
      next(err);
    }
  };

  create = (req, res, next) => {
    try {
      const newDebt = this.service.create(req.body);
      res.status(201).json({ success: true, data: newDebt });
    } catch (err) {
      next(err);
    }
  };

  pay = (req, res, next) => {
    try {
      const updated = this.service.recordPayment(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  delete = (req, res, next) => {
    try {
      const result = this.service.delete(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { DebtsController };
```

Create `src/routes/debts.routes.js`:
```javascript
const { Router } = require('express');
const { DebtsService } = require('../services/debts.service');
const { DebtsController } = require('../controllers/debts.controller');

function createDebtsRouter(db) {
  const router = Router();
  const service = new DebtsService(db);
  const controller = new DebtsController(service);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.post('/:id/pay', controller.pay);
  router.delete('/:id', controller.delete);

  return router;
}

module.exports = { createDebtsRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/debts.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/debts.service.js src/controllers/debts.controller.js src/routes/debts.routes.js tests/debts.test.js
git commit -m "feat(debts): implement debts and installment payments service, controller, and routes"
```

---

### Task 6: Reports & System Module (Health, Analytics, Instant Backup)

**Files:**
- Create: `src/services/reports.service.js`
- Create: `src/controllers/reports.controller.js`
- Create: `src/routes/reports.routes.js`
- Create: `src/controllers/system.controller.js`
- Create: `src/routes/system.routes.js`
- Test: `tests/reports-system.test.js`

**Interfaces:**
- `reportsService`: `getSummary()`, `getSalesReport(range)`
- `systemController`: `health()`, `backup(req, res)`
- Routes: `GET /api/summary`, `GET /api/reports/sales`, `GET /api/system/health`, `GET /api/system/backup`

- [ ] **Step 1: Write test for Reports & System**

Create `tests/reports-system.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../src/config/database');
const { ReportsService } = require('../src/services/reports.service');

test('ReportsService: metrics calculation', async (t) => {
  const testDbPath = path.join(__dirname, 'test-reports.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);
  const service = new ReportsService(db);

  await t.test('Calculates summary with zero state gracefully', () => {
    const summary = service.getSummary();
    assert.equal(summary.today_sales, 0);
    assert.equal(summary.today_transactions, 0);
    assert.equal(summary.total_debt, 0);
    assert.equal(summary.total_items, 0);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reports-system.test.js`
Expected: FAIL with missing module

- [ ] **Step 3: Implement Reports & System services and controllers**

Create `src/services/reports.service.js`:
```javascript
class ReportsService {
  constructor(db) {
    this.db = db;
  }

  getSummary() {
    const todaySales = this.db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total,
        COALESCE(SUM(total_amount - total_cost), 0) AS profit,
        COUNT(id) AS count
      FROM sales
      WHERE date(created_at) = date('now', 'localtime')
    `).get();

    const monthSales = this.db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total,
        COALESCE(SUM(total_amount - total_cost), 0) AS profit,
        COUNT(id) AS count
      FROM sales
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
    `).get();

    const debtStats = this.db.prepare(`
      SELECT 
        COALESCE(SUM(amount - paid_amount), 0) AS total_debt,
        COUNT(id) AS debt_count
      FROM debts
      WHERE status = 'belum_lunas'
    `).get();

    const itemStats = this.db.prepare(`
      SELECT 
        COUNT(id) AS total_items,
        SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END) AS low_stock_count,
        COALESCE(SUM(stock * buy_price), 0) AS asset_value
      FROM items
      WHERE is_active = 1
    `).get();

    return {
      today_sales: todaySales.total,
      today_profit: todaySales.profit,
      today_transactions: todaySales.count,
      month_sales: monthSales.total,
      month_profit: monthSales.profit,
      month_transactions: monthSales.count,
      total_debt: debtStats.total_debt,
      debt_count: debtStats.debt_count,
      total_items: itemStats.total_items,
      low_stock_count: itemStats.low_stock_count,
      inventory_asset_value: itemStats.asset_value
    };
  }

  getSalesReport({ startDate, endDate } = {}) {
    let query = `
      SELECT 
        date(created_at) AS sale_date,
        COUNT(id) AS transaction_count,
        SUM(total_amount) AS total_revenue,
        SUM(total_cost) AS total_cost,
        SUM(total_amount - total_cost) AS net_profit
      FROM sales
    `;
    const params = [];

    if (startDate && endDate) {
      query += ' WHERE date(created_at) BETWEEN date(?) AND date(?)';
      params.push(startDate, endDate);
    }

    query += ' GROUP BY date(created_at) ORDER BY date(created_at) DESC';
    return this.db.prepare(query).all(...params);
  }
}

module.exports = { ReportsService };
```

Create `src/controllers/reports.controller.js`:
```javascript
class ReportsController {
  constructor(service) {
    this.service = service;
  }

  getSummary = (req, res, next) => {
    try {
      const summary = this.service.getSummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  };

  getSalesReport = (req, res, next) => {
    try {
      const report = this.service.getSalesReport(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ReportsController };
```

Create `src/routes/reports.routes.js`:
```javascript
const { Router } = require('express');
const { ReportsService } = require('../services/reports.service');
const { ReportsController } = require('../controllers/reports.controller');

function createReportsRouter(db) {
  const router = Router();
  const service = new ReportsService(db);
  const controller = new ReportsController(service);

  router.get('/summary', controller.getSummary);
  router.get('/sales', controller.getSalesReport);

  return router;
}

module.exports = { createReportsRouter };
```

Create `src/controllers/system.controller.js`:
```javascript
const path = require('node:path');
const fs = require('node:fs');

class SystemController {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
  }

  health = (req, res) => {
    const memory = process.memoryUsage();
    res.json({
      success: true,
      data: {
        status: 'ok',
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage_mb: {
          rss: (memory.rss / 1024 / 1024).toFixed(2),
          heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2),
          heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(2)
        },
        database: 'connected (WAL mode)'
      }
    });
  };

  backup = (req, res, next) => {
    try {
      // Checkpoint WAL first to flush write buffer to disk
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `warung-backup-${dateStr}.db`;

      res.setHeader('Content-Type', 'application/vnd.sqlite3');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(this.dbPath);
      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { SystemController };
```

Create `src/routes/system.routes.js`:
```javascript
const { Router } = require('express');
const { SystemController } = require('../controllers/system.controller');

function createSystemRouter(db, dbPath) {
  const router = Router();
  const controller = new SystemController(db, dbPath);

  router.get('/health', controller.health);
  router.get('/backup', controller.backup);

  return router;
}

module.exports = { createSystemRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/reports-system.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/reports.service.js src/controllers/reports.controller.js src/routes/reports.routes.js src/controllers/system.controller.js src/routes/system.routes.js tests/reports-system.test.js
git commit -m "feat(system): add reports analytics, health check, and instant database backup streaming"
```

---

### Task 7: Router Aggregator & Server Refactoring

**Files:**
- Create: `src/routes/index.js`
- Modify: `server.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Router Aggregator mounts all sub-routes under `/api`
- Backward compatible endpoints: `/api/summary`, `/api/items`, `/api/sales`, `/api/debts`, `/api/system`
- Integration test suite testing the entire app over HTTP

- [ ] **Step 1: Write integration tests for all API endpoints**

Create `tests/api.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { getDb } = require('../src/config/database');
const { createApp } = require('../src/app');

test('Integration API Endpoints', async (t) => {
  const testDbPath = path.join(__dirname, 'test-api.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);

  const app = createApp(db, testDbPath);
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (pathUrl, options = {}) => {
    const res = await fetch(`${baseUrl}${pathUrl}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  await t.test('GET /api/system/health returns ok', async () => {
    const res = await request('/api/system/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.status, 'ok');
  });

  let createdItemId;
  await t.test('POST /api/items creates item', async () => {
    const res = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Gula Pasir 1kg',
        category: 'Sembako',
        buy_price: 14000,
        sell_price: 16000,
        stock: 50
      })
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.name, 'Gula Pasir 1kg');
    createdItemId = res.data.data.id;
  });

  await t.test('POST /api/sales completes sale and adjusts stock', async () => {
    const res = await request('/api/sales', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: createdItemId, qty: 5 }],
        payment_type: 'cash',
        cash_received: 100000
      })
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.total_amount, 80000);
    assert.equal(res.data.data.cash_change, 20000);

    // Verify stock deduction
    const itemRes = await request(`/api/items/${createdItemId}`);
    assert.equal(itemRes.data.data.stock, 45);
  });

  await t.test('GET /api/summary returns updated metrics', async () => {
    const res = await request('/api/summary');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.today_sales, 80000);
    assert.equal(res.data.data.today_transactions, 1);
  });

  await new Promise(resolve => server.close(resolve));
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/api.test.js`
Expected: FAIL with "Cannot find module '../src/app'"

- [ ] **Step 3: Implement Router Aggregator, App Factory, and update server.js**

Create `src/routes/index.js`:
```javascript
const { Router } = require('express');
const { createItemsRouter } = require('./items.routes');
const { createSalesRouter } = require('./sales.routes');
const { createDebtsRouter } = require('./debts.routes');
const { createReportsRouter } = require('./reports.routes');
const { createSystemRouter } = require('./system.routes');

function createApiRouter(db, dbPath) {
  const router = Router();

  router.use('/items', createItemsRouter(db));
  router.use('/sales', createSalesRouter(db));
  router.use('/debts', createDebtsRouter(db));
  router.use('/reports', createReportsRouter(db));
  router.use('/system', createSystemRouter(db, dbPath));

  // Backward compatibility alias: /api/summary directly
  const reportsRouter = createReportsRouter(db);
  router.get('/summary', (req, res, next) => {
    req.url = '/summary';
    reportsRouter(req, res, next);
  });

  return router;
}

module.exports = { createApiRouter };
```

Create `src/app.js`:
```javascript
const express = require('express');
const path = require('node:path');
const { requestLogger } = require('./middlewares/logger');
const { errorHandler } = require('./middlewares/errorHandler');
const { createApiRouter } = require('./routes');

function createApp(db, dbPath) {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  // Static files for frontend
  app.use(express.static(path.join(__dirname, '../public'), {
    etag: false,
    maxAge: 0
  }));

  // Mount API router
  app.use('/api', createApiRouter(db, dbPath));

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
```

Rewrite `server.js`:
```javascript
const { getDb, DEFAULT_DB_PATH } = require('./src/config/database');
const { createApp } = require('./src/app');

const PORT = process.env.PORT || 3000;
const db = getDb();
const app = createApp(db, DEFAULT_DB_PATH);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`   WARUNG PRO SERVER MODULAR ENGINE V2.0       `);
  console.log(`   Status     : Running                        `);
  console.log(`   Local URL  : http://localhost:${PORT}        `);
  console.log(`   DB Engine  : SQLite WAL Mode (Ultra-Fast)   `);
  console.log(`===============================================`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Closing HTTP server and flushing SQLite database...`);
  server.close(() => {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      db.close();
      console.log('Database safely closed. Process exiting.');
    } catch (err) {
      console.error('Error during database closure:', err);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```

- [ ] **Step 4: Run integration test and all test suites to verify they pass**

Run: `node --test tests/*.test.js`
Expected: ALL test suites pass (db, middlewares, items, sales, debts, reports-system, api)

- [ ] **Step 5: Verify server starts and responds locally**

Run: `node -c server.js`
Expected: Code syntax valid, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app.js src/routes/index.js server.js tests/api.test.js
git commit -m "feat(server): refactor server into modular architecture with clean app factory and graceful shutdown"
```
