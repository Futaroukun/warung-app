const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'warung.db');

const db = new DatabaseSync(dbPath);

// Inisialisasi Tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Umum',
    buy_price INTEGER DEFAULT 0,
    sell_price INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 3,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    amount INTEGER NOT NULL,
    paid_amount INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'belum_lunas',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_amount INTEGER NOT NULL,
    payment_type TEXT NOT NULL, -- 'cash' atau 'debt'
    cash_received INTEGER DEFAULT 0,
    cash_change INTEGER DEFAULT 0,
    customer_name TEXT DEFAULT '',
    debt_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === API SUMMARY / DASHBOARD ===
app.get('/api/summary', (req, res) => {
  try {
    const itemStats = db.prepare(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(stock), 0) as total_units,
        COALESCE(SUM(stock * buy_price), 0) as total_modal,
        COALESCE(SUM(stock * sell_price), 0) as total_potensi_jual,
        COUNT(CASE WHEN stock <= min_stock THEN 1 END) as low_stock_count
      FROM items
    `).get();

    const debtStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status != 'lunas' THEN 1 END) as active_debtors,
        COALESCE(SUM(CASE WHEN status != 'lunas' THEN (amount - paid_amount) ELSE 0 END), 0) as total_unpaid_debt
      FROM debts
    `).get();

    // Penjualan hari ini
    const todaySales = db.prepare(`
      SELECT 
        COUNT(*) as tx_count,
        COALESCE(SUM(total_amount), 0) as total_omset
      FROM sales
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `).get();

    res.json({
      success: true,
      data: {
        total_items: itemStats.total_items,
        total_units: itemStats.total_units,
        total_modal: itemStats.total_modal,
        total_potensi_jual: itemStats.total_potensi_jual,
        potensi_keuntungan: itemStats.total_potensi_jual - itemStats.total_modal,
        low_stock_count: itemStats.low_stock_count,
        active_debtors: debtStats.active_debtors,
        total_unpaid_debt: debtStats.total_unpaid_debt,
        today_omset: todaySales.total_omset,
        today_tx: todaySales.tx_count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === API ITEMS / STOK BARANG ===
app.get('/api/items', (req, res) => {
  try {
    const { search, low_stock } = req.query;
    let query = 'SELECT * FROM items WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (low_stock === 'true') {
      query += ' AND stock <= min_stock';
    }

    query += ' ORDER BY name ASC';
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/items', (req, res) => {
  try {
    const { name, category, buy_price, sell_price, stock, min_stock } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Nama barang wajib diisi' });
    }

    const stmt = db.prepare(`
      INSERT INTO items (name, category, buy_price, sell_price, stock, min_stock, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    const result = stmt.run(
      name.trim(),
      category ? category.trim() : 'Umum',
      Number(buy_price) || 0,
      Number(sell_price) || 0,
      Number(stock) || 0,
      Number(min_stock) !== undefined ? Number(min_stock) : 3
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, buy_price, sell_price, stock, min_stock } = req.body;

    const stmt = db.prepare(`
      UPDATE items
      SET name = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const result = stmt.run(
      name.trim(),
      category ? category.trim() : 'Umum',
      Number(buy_price) || 0,
      Number(sell_price) || 0,
      Number(stock) || 0,
      Number(min_stock) !== undefined ? Number(min_stock) : 3,
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Barang tidak ditemukan' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Penyesuaian stok cepat (+1, -1, atau nilai custom)
app.patch('/api/items/:id/adjust-stock', (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;

    const item = db.prepare('SELECT stock FROM items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Barang tidak ditemukan' });
    }

    let newStock = Number(item.stock) + Number(delta);
    if (newStock < 0) newStock = 0;

    db.prepare(`
      UPDATE items 
      SET stock = ?, updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(newStock, id);

    res.json({ success: true, newStock });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === API CHECKOUT & TRANSAKSI KASIR ===
app.post('/api/checkout', (req, res) => {
  try {
    const { items, payment_type, cash_received, customer_name, customer_phone } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Keranjang belanja masih kosong' });
    }

    let totalAmount = 0;
    const itemDetails = [];

    for (const it of items) {
      const dbItem = db.prepare('SELECT id, name, sell_price, stock FROM items WHERE id = ?').get(it.id);
      if (!dbItem) {
        return res.status(400).json({ success: false, error: `Produk "${it.name}" tidak ditemukan` });
      }

      const qty = Number(it.qty) || 1;
      const price = Number(dbItem.sell_price);
      const subtotal = price * qty;
      totalAmount += subtotal;

      itemDetails.push({
        id: dbItem.id,
        name: dbItem.name,
        price,
        qty,
        subtotal,
        currentStock: dbItem.stock
      });
    }

    let cashChange = 0;
    let debtId = null;

    if (payment_type === 'cash') {
      const received = Number(cash_received);
      if (isNaN(received) || received < totalAmount) {
        return res.status(400).json({ 
          success: false, 
          error: `Uang yang diterima kurang! Total: Rp ${totalAmount.toLocaleString('id-ID')}` 
        });
      }
      cashChange = received - totalAmount;
    } else if (payment_type === 'debt') {
      if (!customer_name || customer_name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Nama pengutang wajib diisi untuk pembayaran kasbon' });
      }

      const notes = itemDetails.map(i => `${i.name} (${i.qty}x)`).join(', ');
      const debtStmt = db.prepare(`
        INSERT INTO debts (customer_name, phone, amount, paid_amount, notes, status, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, 'belum_lunas', datetime('now', 'localtime'), datetime('now', 'localtime'))
      `);
      const debtRes = debtStmt.run(customer_name.trim(), customer_phone ? customer_phone.trim() : '', totalAmount, notes);
      debtId = debtRes.lastInsertRowid;
    } else {
      return res.status(400).json({ success: false, error: 'Tipe pembayaran tidak valid' });
    }

    // Kurangi stok barang
    for (const it of itemDetails) {
      const newStock = Math.max(0, it.currentStock - it.qty);
      db.prepare(`UPDATE items SET stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(newStock, it.id);
    }

    // Catat penjualan
    const saleStmt = db.prepare(`
      INSERT INTO sales (total_amount, payment_type, cash_received, cash_change, customer_name, debt_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    const saleRes = saleStmt.run(
      totalAmount,
      payment_type,
      payment_type === 'cash' ? Number(cash_received) : 0,
      cashChange,
      customer_name ? customer_name.trim() : 'Umum',
      debtId
    );
    const saleId = saleRes.lastInsertRowid;

    // Catat item penjualan
    const itemInsertStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, item_id, item_name, qty, price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const it of itemDetails) {
      itemInsertStmt.run(saleId, it.id, it.name, it.qty, it.price, it.subtotal);
    }

    res.json({
      success: true,
      sale_id: saleId,
      total_amount: totalAmount,
      payment_type,
      cash_received: payment_type === 'cash' ? Number(cash_received) : 0,
      cash_change: cashChange,
      customer_name: customer_name || 'Umum',
      items: itemDetails
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Riwayat Penjualan
app.get('/api/sales', (req, res) => {
  try {
    const sales = db.prepare(`
      SELECT * FROM sales ORDER BY created_at DESC LIMIT 30
    `).all();

    const result = sales.map(s => {
      const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(s.id);
      return { ...s, items };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === API DEBTS / CATATAN HUTANG ===
app.get('/api/debts', (req, res) => {
  try {
    const { search, status } = req.query;
    let query = 'SELECT * FROM debts WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (customer_name LIKE ? OR notes LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY CASE WHEN status = "belum_lunas" THEN 0 ELSE 1 END, created_at DESC';
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/debts', (req, res) => {
  try {
    const { customer_name, phone, amount, notes } = req.body;
    if (!customer_name || customer_name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Nama pengutang wajib diisi' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Nominal hutang harus lebih dari 0' });
    }

    const stmt = db.prepare(`
      INSERT INTO debts (customer_name, phone, amount, paid_amount, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, 'belum_lunas', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);
    const result = stmt.run(
      customer_name.trim(),
      phone ? phone.trim() : '',
      Number(amount),
      notes ? notes.trim() : ''
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bayar sebagian atau lunasi hutang
app.post('/api/debts/:id/pay', (req, res) => {
  try {
    const { id } = req.params;
    const { pay_amount } = req.body;

    const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
    if (!debt) {
      return res.status(404).json({ success: false, error: 'Catatan hutang tidak ditemukan' });
    }

    const currentPaid = Number(debt.paid_amount) || 0;
    const totalAmount = Number(debt.amount) || 0;
    const payment = Number(pay_amount);

    if (isNaN(payment) || payment <= 0) {
      return res.status(400).json({ success: false, error: 'Nominal bayar harus lebih dari 0' });
    }

    const newPaid = currentPaid + payment;
    const newStatus = newPaid >= totalAmount ? 'lunas' : 'belum_lunas';

    db.prepare(`
      UPDATE debts 
      SET paid_amount = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newPaid, newStatus, id);

    res.json({
      success: true,
      paid_amount: newPaid,
      remaining: Math.max(0, totalAmount - newPaid),
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hapus catatan hutang
app.delete('/api/debts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM debts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Warung aktif di http://localhost:${PORT}`);
});
