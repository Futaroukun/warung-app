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

  await t.test('Clamps stock to minimum of 0 on excessive decrement', () => {
    const item = service.getByBarcode('8991234567890');
    const updated = service.updateStock(item.id, -100);
    assert.equal(updated.stock, 0);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
