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

  await t.test('Merges multiple POS debt transactions for same customer into one active debt', () => {
    const sale1 = salesService.createTransaction({
      items: [{ id: item2.id, qty: 1 }],
      payment_type: 'debt',
      customer_name: 'Pak RT'
    });

    const sale2 = salesService.createTransaction({
      items: [{ id: item2.id, qty: 2 }],
      payment_type: 'debt',
      customer_name: 'Pak RT'
    });

    assert.equal(sale1.debt_id, sale2.debt_id);
    const debtsService = new (require('../src/services/debts.service').DebtsService)(db);
    const debt = debtsService.getById(sale1.debt_id);
    assert.equal(debt.amount, 18000 + 36000);
    assert.equal(debt.items.length, 2);
  });

  await t.test('Updates debt_status automatically in sales history from belum_lunas to lunas when debt is paid', () => {
    const debtsService = new (require('../src/services/debts.service').DebtsService)(db);

    // Initial check: status must be belum_lunas
    const salesBefore = salesService.getAll();
    const rtSale = salesBefore.find(s => s.customer_name === 'Pak RT');
    assert.ok(rtSale);
    assert.equal(rtSale.debt_status, 'belum_lunas');

    // Pay full debt
    debtsService.recordPayment(rtSale.debt_id, { amount: 54000 });

    // Check sales list again: debt_status must automatically be 'lunas'
    const salesAfter = salesService.getAll();
    const rtSalePaid = salesAfter.find(s => s.customer_name === 'Pak RT');
    assert.ok(rtSalePaid);
    assert.equal(rtSalePaid.debt_status, 'lunas');

    // Also verify getById
    const singleSale = salesService.getById(rtSale.id);
    assert.equal(singleSale.debt_status, 'lunas');
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
