const { toTitleCase } = require('../middlewares/validator');

class ItemsService {
  constructor(db) {
    this.db = db;
  }

  getAll({ search, category, low_stock } = {}) {
    let query = 'SELECT * FROM items WHERE is_active = 1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR barcode LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category.trim());
    }

    if (low_stock === 'true' || low_stock === true) {
      query += ' AND stock <= min_stock';
    }

    query += ' ORDER BY name ASC';
    return this.db.prepare(query).all(...params);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(id);
  }

  getByBarcode(barcode) {
    if (!barcode) return null;
    return this.db.prepare('SELECT * FROM items WHERE barcode = ? AND is_active = 1').get(barcode.trim());
  }

  create(data) {
    const { name, category, buy_price, sell_price, stock, min_stock, barcode, unit } = data;
    if (!name || !name.trim()) {
      const err = new Error('Nama barang wajib diisi');
      err.status = 400;
      throw err;
    }

    const cleanName = toTitleCase(name);
    const existing = this.db.prepare('SELECT id, name FROM items WHERE LOWER(TRIM(name)) = LOWER(?) AND is_active = 1').get(cleanName);
    if (existing) {
      const err = new Error(`Produk "${existing.name}" sudah ada di daftar stok!`);
      err.status = 409;
      throw err;
    }

    const cleanBarcode = barcode && barcode.trim() ? barcode.trim() : null;
    if (cleanBarcode) {
      const barcodeExists = this.db.prepare('SELECT id, name FROM items WHERE barcode = ? AND is_active = 1').get(cleanBarcode);
      if (barcodeExists) {
        const err = new Error(`Barcode sudah digunakan oleh "${barcodeExists.name}"!`);
        err.status = 409;
        throw err;
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO items (barcode, name, category, buy_price, sell_price, stock, min_stock, unit, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      cleanBarcode,
      cleanName,
      toTitleCase(category || 'Umum'),
      Number(buy_price) || 0,
      Number(sell_price) || 0,
      Math.max(0, Number(stock) || 0),
      Number(min_stock) >= 0 ? Number(min_stock) : 3,
      unit ? unit.trim().toLowerCase() : 'pcs'
    );

    return this.getById(result.lastInsertRowid);
  }

  update(id, data) {
    const { name, category, buy_price, sell_price, stock, min_stock, barcode, unit } = data;
    const existing = this.getById(id);
    if (!existing) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const cleanName = name ? toTitleCase(name) : existing.name;
    const nameCheck = this.db.prepare('SELECT id, name FROM items WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND is_active = 1').get(cleanName, id);
    if (nameCheck) {
      const err = new Error(`Nama produk "${nameCheck.name}" sudah digunakan produk lain!`);
      err.status = 409;
      throw err;
    }

    const cleanBarcode = barcode !== undefined ? (barcode ? barcode.trim() : null) : existing.barcode;
    if (cleanBarcode) {
      const barcodeCheck = this.db.prepare('SELECT id, name FROM items WHERE barcode = ? AND id != ? AND is_active = 1').get(cleanBarcode, id);
      if (barcodeCheck) {
        const err = new Error(`Barcode sudah digunakan oleh produk "${barcodeCheck.name}"!`);
        err.status = 409;
        throw err;
      }
    }

    const stmt = this.db.prepare(`
      UPDATE items
      SET barcode = ?, name = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, unit = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    stmt.run(
      cleanBarcode,
      cleanName,
      toTitleCase(category || existing.category),
      buy_price !== undefined ? Number(buy_price) : existing.buy_price,
      sell_price !== undefined ? Number(sell_price) : existing.sell_price,
      stock !== undefined ? Math.max(0, Number(stock)) : existing.stock,
      min_stock !== undefined ? Number(min_stock) : existing.min_stock,
      unit !== undefined ? unit.trim().toLowerCase() : existing.unit,
      id
    );

    return this.getById(id);
  }

  updateStock(id, diffQty) {
    const item = this.getById(id);
    if (!item) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const newStock = Math.max(0, item.stock + Number(diffQty));
    this.db.prepare("UPDATE items SET stock = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newStock, id);
    return this.getById(id);
  }

  delete(id) {
    const existing = this.getById(id);
    if (!existing) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    // Soft delete to protect relational sales history
    this.db.prepare("UPDATE items SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
    return { id: Number(id), deleted: true };
  }
}

module.exports = { ItemsService };
