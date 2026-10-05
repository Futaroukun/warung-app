const test = require('node:test');
const assert = require('node:assert/strict');
const { toTitleCase } = require('../src/middlewares/validator');
const { errorHandler } = require('../src/middlewares/errorHandler');

test('Middlewares: Validator and Error Handler', async (t) => {
  await t.test('toTitleCase normalizes words and spacing', () => {
    assert.equal(toTitleCase('kopi tubruk cap lele'), 'Kopi Tubruk Cap Lele');
    assert.equal(toTitleCase('  indomie kuah kari   ayam '), 'Indomie Kuah Kari Ayam');
    assert.equal(toTitleCase(''), '');
    assert.equal(toTitleCase(null), '');
  });

  await t.test('errorHandler returns formatted JSON and status', () => {
    let responseStatus = null;
    let responseJson = null;

    const mockRes = {
      status(code) { responseStatus = code; return this; },
      json(payload) { responseJson = payload; return this; }
    };

    const err = new Error('Barang tidak ditemukan');
    err.status = 404;

    errorHandler(err, {}, mockRes, () => {});
    assert.equal(responseStatus, 404);
    assert.deepEqual(responseJson, { success: false, error: 'Barang tidak ditemukan' });
  });
});
