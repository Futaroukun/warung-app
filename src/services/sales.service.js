class SalesService {
  constructor(db) {
    this.db = db;
  }

  generateInvoiceNo() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${dateStr}-${randomSuffix}`;
  }

  getAll({ limit = 50, offset = 0, date } = {}) {
    let query = 'SELECT * FROM sales';
    const params = [];

    if (date) {
      query += " WHERE date(created_at) = date(?)";
      params.push(date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const sales = this.db.prepare(query).all(...params);

    // Attach sale items to each sale
    const getItemStmt = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
    return sales.map(sale => ({
      ...sale,
      items: getItemStmt.all(sale.id)
    }));
  }

  getById(id) {
    const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return null;

    sale.items = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    return sale;
  }

  createTransaction({ items, payment_type = 'cash', cash_received = 0, customer_name = '', notes = '' }) {
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Keranjang belanja kosong');
      err.status = 400;
      throw err;
    }

    this.db.exec('BEGIN TRANSACTION');

    try {
      let totalAmount = 0;
      let totalCost = 0;
      const preparedItems = [];

      for (const cartItem of items) {
        const item = this.db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(cartItem.id);
        if (!item) {
          const err = new Error(`Barang dengan ID ${cartItem.id} tidak ditemukan`);
          err.status = 404;
          throw err;
        }

        const qty = Number(cartItem.qty);
        if (qty <= 0) {
          const err = new Error(`Jumlah untuk barang "${item.name}" harus lebih dari 0`);
          err.status = 400;
          throw err;
        }

        if (item.stock < qty) {
          const err = new Error(`Stok untuk "${item.name}" tidak mencukupi (sisa ${item.stock})`);
          err.status = 400;
          throw err;
        }

        const subtotal = item.sell_price * qty;
        const itemCost = (item.buy_price || 0) * qty;

        totalAmount += subtotal;
        totalCost += itemCost;

        preparedItems.push({
          itemId: item.id,
          name: item.name,
          buyPrice: item.buy_price || 0,
          sellPrice: item.sell_price,
          qty,
          subtotal
        });
      }

      let cashReceivedNum = Number(cash_received) || 0;
      let cashChange = 0;
      let debtId = null;

      if (payment_type === 'cash') {
        if (cashReceivedNum < totalAmount) {
          const err = new Error('Uang tunai yang diterima kurang dari total belanja');
          err.status = 400;
          throw err;
        }
        cashChange = cashReceivedNum - totalAmount;
      } else if (payment_type === 'debt') {
        if (!customer_name || !customer_name.trim()) {
          const err = new Error('Nama pelanggan wajib diisi untuk transaksi kasbon / hutang');
          err.status = 400;
          throw err;
        }

        const insertDebt = this.db.prepare(`
          INSERT INTO debts (customer_name, amount, paid_amount, notes, status, created_at, updated_at)
          VALUES (?, ?, 0, ?, 'belum_lunas', datetime('now', 'localtime'), datetime('now', 'localtime'))
        `);
        const debtResult = insertDebt.run(customer_name.trim(), totalAmount, notes ? notes.trim() : 'Transaksi Kasir');
        debtId = debtResult.lastInsertRowid;
      }

      const invoiceNo = this.generateInvoiceNo();
      const insertSale = this.db.prepare(`
        INSERT INTO sales (invoice_no, total_amount, total_cost, payment_type, cash_received, cash_change, customer_name, debt_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `);

      const saleResult = insertSale.run(
        invoiceNo,
        totalAmount,
        totalCost,
        payment_type,
        cashReceivedNum,
        cashChange,
        customer_name ? customer_name.trim() : '',
        debtId
      );

      const saleId = saleResult.lastInsertRowid;

      // Insert sale items and deduct inventory
      const insertSaleItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, item_id, item_name, buy_price, sell_price, qty, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const deductStock = this.db.prepare(`
        UPDATE items
        SET stock = stock - ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const pItem of preparedItems) {
        insertSaleItem.run(saleId, pItem.itemId, pItem.name, pItem.buyPrice, pItem.sellPrice, pItem.qty, pItem.subtotal);
        deductStock.run(pItem.qty, pItem.itemId);
      }

      this.db.exec('COMMIT');

      return this.getById(saleId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

module.exports = { SalesService };
