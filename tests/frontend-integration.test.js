const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { getDb } = require('../src/config/database');
const { createApp } = require('../src/app');

test('Frontend Static Assets Verification', async (t) => {
  const testDbPath = path.join(__dirname, 'test-frontend.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  const db = getDb(testDbPath);

  const app = createApp(db, testDbPath);
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const assets = [
    '/',
    '/css/variables.css',
    '/css/base.css',
    '/css/components.css',
    '/css/print.css',
    '/js/utils.js',
    '/js/store.js',
    '/js/local-db.js',
    '/js/api.js',
    '/js/components/toast.js',
    '/js/components/sheets.js',
    '/js/components/printer.js',
    '/js/components/scanner.js',
    '/js/tabs/dashboard.js',
    '/js/tabs/pos.js',
    '/js/tabs/barcode.js',
    '/js/tabs/debts.js',
    '/js/tabs/history.js',
    '/js/tabs/system.js',
    '/js/app.js',
    '/js/bundle.js',
    '/theme-preview.html'
  ];

  for (const asset of assets) {
    await t.test(`GET ${asset} returns 200 OK`, async () => {
      const res = await fetch(`${baseUrl}${asset}`);
      assert.equal(res.status, 200, `Expected 200 OK for ${asset}`);
      const text = await res.text();
      assert.ok(text.length > 0, `Expected non-empty content for ${asset}`);
    });
  }

  await new Promise(resolve => server.close(resolve));
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  ['wal', 'shm'].forEach(ext => {
    if (fs.existsSync(`${testDbPath}-${ext}`)) fs.unlinkSync(`${testDbPath}-${ext}`);
  });
});
