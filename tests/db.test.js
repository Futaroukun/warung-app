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
      // Simulasikan kegagalan transaksi
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
