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
