const { toTitleCase } = require('../middlewares/validator');

class DebtsService {
  constructor(db) {
    this.db = db;
  }

  getAll({ status, search } = {}) {
    let query = 'SELECT * FROM debts WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (customer_name LIKE ? OR phone LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += " ORDER BY CASE WHEN status = 'belum_lunas' THEN 0 ELSE 1 END, updated_at DESC";
    const debts = this.db.prepare(query).all(...params);

    const getPayments = this.db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY payment_date DESC');
    const getItems = this.db.prepare(`
      SELECT si.id, si.item_name, COALESCE(si.sell_price, si.price, 0) AS sell_price, si.qty, si.subtotal, s.invoice_no, s.created_at
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.debt_id = ?
      ORDER BY s.created_at ASC
    `);

    return debts.map(d => ({
      ...d,
      payments: getPayments.all(d.id),
      items: getItems.all(d.id)
    }));
  }

  getById(id) {
    const debt = this.db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
    if (!debt) return null;

    debt.payments = this.db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY payment_date DESC').all(id);
    debt.items = this.db.prepare(`
      SELECT si.id, si.item_name, COALESCE(si.sell_price, si.price, 0) AS sell_price, si.qty, si.subtotal, s.invoice_no, s.created_at
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.debt_id = ?
      ORDER BY s.created_at ASC
    `).all(id);
    return debt;
  }

  create({ customer_name, phone = '', amount, notes = '', due_date = null }) {
    if (!customer_name || !customer_name.trim()) {
      const err = new Error('Nama pelanggan wajib diisi');
      err.status = 400;
      throw err;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      const err = new Error('Nominal hutang harus lebih dari 0');
      err.status = 400;
      throw err;
    }

    const cleanCustName = toTitleCase(customer_name);

    // Check if customer already has an active (belum_lunas) debt
    const existing = this.db.prepare(`
      SELECT id, amount, notes, phone FROM debts
      WHERE LOWER(TRIM(customer_name)) = LOWER(TRIM(?)) AND status = 'belum_lunas'
      ORDER BY id DESC LIMIT 1
    `).get(cleanCustName);

    if (existing) {
      const combinedAmount = existing.amount + numAmount;
      const combinedNotes = [existing.notes, notes ? notes.trim() : ''].filter(Boolean).join('; ');
      const cleanPhone = phone ? phone.trim() : existing.phone;
      this.db.prepare(`
        UPDATE debts
        SET amount = ?, notes = ?, phone = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(combinedAmount, combinedNotes, cleanPhone, existing.id);
      return this.getById(existing.id);
    }

    const stmt = this.db.prepare(`
      INSERT INTO debts (customer_name, phone, amount, paid_amount, notes, status, due_date, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, 'belum_lunas', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      cleanCustName,
      phone ? phone.trim() : '',
      numAmount,
      notes ? notes.trim() : '',
      due_date || null
    );

    return this.getById(result.lastInsertRowid);
  }

  recordPayment(id, { amount, notes = '' }) {
    const debt = this.getById(id);
    if (!debt) {
      const err = new Error('Catatan hutang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      const err = new Error('Nominal pembayaran harus lebih dari 0');
      err.status = 400;
      throw err;
    }

    const remaining = debt.amount - debt.paid_amount;
    if (payAmount > remaining) {
      const err = new Error(`Nominal pembayaran melebihi sisa hutang (sisa: Rp ${remaining.toLocaleString('id-ID')})`);
      err.status = 400;
      throw err;
    }

    this.db.exec('BEGIN TRANSACTION');
    try {
      this.db.prepare(`
        INSERT INTO debt_payments (debt_id, amount, notes, payment_date)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
      `).run(id, payAmount, notes ? notes.trim() : '');

      const newPaidAmount = debt.paid_amount + payAmount;
      const newStatus = newPaidAmount >= debt.amount ? 'lunas' : 'belum_lunas';

      this.db.prepare(`
        UPDATE debts
        SET paid_amount = ?, status = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newPaidAmount, newStatus, id);

      this.db.exec('COMMIT');
      return this.getById(id);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  delete(id) {
    const debt = this.getById(id);
    if (!debt) {
      const err = new Error('Catatan hutang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    this.db.prepare('DELETE FROM debts WHERE id = ?').run(id);
    return { id: Number(id), deleted: true };
  }
}

module.exports = { DebtsService };
