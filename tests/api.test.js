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
