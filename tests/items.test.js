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

  await t.test('Deletes item (soft delete)', () => {
    const item = service.getByBarcode('8991234567890');
    const result = service.delete(item.id);
    assert.equal(result.deleted, true);
    assert.equal(service.getById(item.id), undefined);
  });

  await t.test('Performs batch restock (kulakan) with stock & price update', () => {
    const itemA = service.create({
      name: 'Kopi Kapal Api Special Mix',
      buy_price: 1500,
      sell_price: 2000,
      stock: 10
    });
    const itemB = service.create({
      name: 'Indomie Goreng Original',
      buy_price: 2800,
      sell_price: 3500,
      stock: 20
    });

    const restockRes = service.batchRestock({
      notes: 'Kulakan Agen Surya',
      items: [
        { id: itemA.id, qty: 24, buy_price: 1600 },
        { id: itemB.id, qty: 40, buy_price: 2900, sell_price: 3600 }
      ]
    });

    assert.ok(restockRes.id);
    assert.ok(restockRes.invoice_no.startsWith('KUL-'));
    assert.equal(restockRes.total_items, 64);
    assert.equal(restockRes.total_amount, (24 * 1600) + (40 * 2900));
    assert.equal(restockRes.notes, 'Kulakan Agen Surya');

    const updatedA = service.getById(itemA.id);
    const updatedB = service.getById(itemB.id);

    assert.equal(updatedA.stock, 34); // 10 + 24
    assert.equal(updatedA.buy_price, 1600); // updated buy_price
    assert.equal(updatedB.stock, 60); // 20 + 40
    assert.equal(updatedB.buy_price, 2900);
    assert.equal(updatedB.sell_price, 3600);

    const history = service.getRestocks({ limit: 10 });
    assert.equal(history.length, 1);
    assert.equal(history[0].items.length, 2);
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
