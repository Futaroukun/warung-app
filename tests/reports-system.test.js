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
