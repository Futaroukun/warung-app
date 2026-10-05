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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode) WHERE barcode IS NOT NULL;
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
    db.exec('ALTER TABLE items ADD COLUMN barcode TEXT;');
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
