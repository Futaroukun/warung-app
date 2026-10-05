const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../src/config/database');
const { ItemsService } = require('../src/services/items.service');
const { SalesService } = require('../src/services/sales.service');
const { ReportsService } = require('../src/services/reports.service');

test('Financial Analytics: Profit & Loss and CSV exports', async (t) => {
  const testDbPath = path.join(__dirname, 'test-financial.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);

  const itemsService = new ItemsService(db);
  const salesService = new SalesService(db);
  const reportsService = new ReportsService(db);

  // Setup sample inventory
  const it1 = itemsService.create({ name: 'Beras Ramos 5kg', barcode: '111111', buy_price: 60000, sell_price: 75000, stock: 10 });
  const it2 = itemsService.create({ name: 'Telur Ayam 1kg', barcode: '222222', buy_price: 24000, sell_price: 28000, stock: 15 });

  // Record sales
  salesService.createTransaction({
    items: [
      { id: it1.id, qty: 2 },
      { id: it2.id, qty: 1 }
    ],
    payment_type: 'cash',
    cash_received: 200000
  });

  await t.test('Calculates profit & loss accurately', () => {
    const pl = reportsService.getProfitLossStatement();
    assert.equal(pl.gross_revenue, (75000 * 2) + 28000); // 178000
    assert.equal(pl.cogs_total, (60000 * 2) + 24000);   // 144000
    assert.equal(pl.net_profit, 34000);
    assert.ok(pl.profit_margin_percent > 19);
    assert.ok(Array.isArray(pl.top_products_by_revenue));
  });

  await t.test('Generates valid CSV for sales and items', () => {
    const salesCsv = reportsService.generateSalesCsv();
    assert.ok(salesCsv.includes('No Invoice'));
    assert.ok(salesCsv.includes('Beras Ramos 5kg'));

    const itemsCsv = reportsService.generateItemsCsv();
    assert.ok(itemsCsv.includes('Nama Produk'));
    assert.ok(itemsCsv.includes('Beras Ramos 5kg'));
    assert.ok(itemsCsv.includes('111111'));
  });

  await t.test('HTTP endpoints for profit-loss and CSV exports', async () => {
    const http = require('node:http');
    const { createApp } = require('../src/app');
    const app = createApp(db, testDbPath);
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;

    const plRes = await fetch(`http://127.0.0.1:${port}/api/reports/profit-loss`);
    assert.equal(plRes.status, 200);
    const plJson = await plRes.json();
    assert.equal(plJson.success, true);
    assert.equal(plJson.data.net_profit, 34000);

    const csvRes = await fetch(`http://127.0.0.1:${port}/api/reports/export/sales`);
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get('content-type').includes('text/csv'));

    const itemsCsvRes = await fetch(`http://127.0.0.1:${port}/api/reports/export/items`);
    assert.equal(itemsCsvRes.status, 200);
    assert.ok(itemsCsvRes.headers.get('content-type').includes('text/csv'));

    await new Promise(r => server.close(r));
  });

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
