const test = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../public/js/store');
const { formatRp, toTitleCase, cleanNumber, autoCapitalizeWords, autoCapitalizeSentences, fetchOnlineBarcodeProduct } = require('../public/js/utils');

test('Frontend Store & Utilities', async (t) => {
  await t.test('formatRp and cleanNumber utilities', () => {
    assert.equal(formatRp(15000), 'Rp 15.000');
    assert.equal(formatRp(0), 'Rp 0');
    assert.equal(toTitleCase('beras rojo lele 5kg'), 'Beras Rojo Lele 5kg');
    assert.equal(cleanNumber('15.000'), 15000);
    assert.equal(cleanNumber('Rp 25.500'), 25500);
    assert.equal(autoCapitalizeWords('kopi kapal api 65g'), 'Kopi Kapal Api 65g');
    assert.equal(autoCapitalizeSentences('titip tetangga. lunas besok'), 'Titip tetangga. Lunas besok');
  });

  await t.test('Store: Cart calculations, updates, and removals', () => {
    const store = new Store();
    let listenerCalled = false;
    store.subscribe(() => { listenerCalled = true; });

    store.addToCart({ id: 1, name: 'Kopi', sell_price: 3000, buy_price: 2000, stock: 10 });
    assert.equal(listenerCalled, true);
    assert.equal(store.getCartItemCount(), 1);
    assert.equal(store.getCartTotal(), 3000);

    // Increase qty
    store.updateCartQty(1, 2);
    assert.equal(store.getCartItemCount(), 3);
    assert.equal(store.getCartTotal(), 9000);

    // Decrement qty
    store.updateCartQty(1, -1);
    assert.equal(store.getCartItemCount(), 2);
    assert.equal(store.getCartTotal(), 6000);

    // Add another item
    store.addToCart({ id: 2, name: 'Gula', sell_price: 15000, buy_price: 13000, stock: 5 });
    assert.equal(store.getCartItemCount(), 3);
    assert.equal(store.getCartTotal(), 21000);

    // Remove first item
    store.removeFromCart(1);
    assert.equal(store.getCartItemCount(), 1);
    assert.equal(store.getCartTotal(), 15000);

    // Clear cart
    store.clearCart();
    assert.equal(store.getCartItemCount(), 0);
    assert.equal(store.getCartTotal(), 0);
  });

  await t.test('generateDebtReminderMessage formats WhatsApp message properly', () => {
    const { generateDebtReminderMessage } = require('../public/js/tabs/debts');
    const msg = generateDebtReminderMessage({
      customer_name: 'Pak Budi',
      amount: 50000,
      paid_amount: 20000,
      notes: 'Rokok & Kopi',
      created_at: '2026-10-05T07:00:00Z'
    });
    assert.ok(msg.includes('Pak Budi'));
    assert.ok(msg.includes('30.000'));
    assert.ok(msg.includes('50.000'));
    assert.ok(msg.includes('Rokok & Kopi'));
  });

  await t.test('fetchOnlineBarcodeProduct handles invalid or empty barcode safely', async () => {
    assert.equal(await fetchOnlineBarcodeProduct(''), null);
    assert.equal(await fetchOnlineBarcodeProduct('123'), null);
    assert.equal(await fetchOnlineBarcodeProduct(null), null);
  });
});
