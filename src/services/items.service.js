const { toTitleCase } = require('../middlewares/validator');

class ItemsService {
  constructor(db) {
    this.db = db;
  }

  getAll({ search, category, low_stock, include_all } = {}) {
    let query = 'SELECT * FROM items WHERE 1=1';
    const params = [];

    if (!include_all || (include_all !== 'true' && include_all !== true)) {
      query += ' AND is_active = 1';
    }

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

  getByBarcode(barcode, includeAll = false) {
    if (!barcode) return null;
    let query = 'SELECT * FROM items WHERE barcode = ?';
    if (!includeAll) {
      query += ' AND is_active = 1';
    }
    return this.db.prepare(query).get(barcode.trim());
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
      const barcodeExists = this.db.prepare('SELECT id, name, is_active FROM items WHERE barcode = ?').get(cleanBarcode);
      if (barcodeExists) {
        if (barcodeExists.is_active === 1) {
          const err = new Error(`Barcode sudah digunakan oleh "${barcodeExists.name}"!`);
          err.status = 409;
          throw err;
        } else {
          // Re-activate soft-deleted/archived item with new data
          return this.update(barcodeExists.id, {
            ...data,
            name: cleanName,
            barcode: cleanBarcode,
            is_active: 1
          });
        }
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

    const targetActive = data.is_active !== undefined ? Number(data.is_active) : existing.is_active;

    const stmt = this.db.prepare(`
      UPDATE items
      SET barcode = ?, name = ?, category = ?, buy_price = ?, sell_price = ?, stock = ?, min_stock = ?, unit = ?, is_active = ?, updated_at = datetime('now', 'localtime')
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
      targetActive,
      id
    );

    return this.db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  }

  updateStock(id, diffQty) {
    const item = this.getById(id) || this.db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!item) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const newStock = Math.max(0, item.stock + Number(diffQty));
    this.db.prepare("UPDATE items SET stock = ?, is_active = 1, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newStock, id);
    return this.db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  }

  delete(id, permanent = false) {
    const existing = this.db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) {
      const err = new Error('Barang tidak ditemukan');
      err.status = 404;
      throw err;
    }

    const isUsed = this.db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE item_id = ?').get(id)?.count > 0;
    if (!isUsed || permanent) {
      this.db.prepare('DELETE FROM items WHERE id = ?').run(id);
      return { id: Number(id), deleted: true, permanent: true };
    } else {
      this.db.prepare("UPDATE items SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
      return { id: Number(id), deleted: true, permanent: false };
    }
  }

  generateRestockInvoiceNo() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `KUL-${dateStr}-${timestamp}-${randomSuffix}`;
  }

  batchRestock({ items, notes = '' } = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Daftar barang kulakan kosong');
      err.status = 400;
      throw err;
    }

    this.db.exec('BEGIN TRANSACTION');

    try {
      let totalAmount = 0;
      let totalItems = 0;
      const restockItemRecords = [];
      const invoiceNo = this.generateRestockInvoiceNo();

      const insertRestockStmt = this.db.prepare(`
        INSERT INTO restocks (invoice_no, total_amount, total_items, notes, created_at)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `);

      const insertRestockItemStmt = this.db.prepare(`
        INSERT INTO restock_items (restock_id, item_id, item_name, qty, buy_price, sell_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const updateItemStmt = this.db.prepare(`
        UPDATE items
        SET stock = stock + ?,
            buy_price = CASE WHEN ? > 0 THEN ? ELSE buy_price END,
            sell_price = CASE WHEN ? > 0 THEN ? ELSE sell_price END,
            is_active = 1,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const entry of items) {
        let item = null;
        if (entry.id) {
          item = this.db.prepare('SELECT * FROM items WHERE id = ?').get(entry.id);
        } else if (entry.barcode) {
          item = this.getByBarcode(entry.barcode, true);
        }

        if (!item) {
          if (entry.name && entry.name.trim()) {
            item = this.create({
              name: entry.name,
              barcode: entry.barcode || null,
              category: entry.category || 'Umum',
              buy_price: entry.buy_price || 0,
              sell_price: entry.sell_price || 0,
              stock: 0,
              unit: entry.unit || 'pcs'
            });
          } else {
            const err = new Error(`Barang ${entry.id || entry.barcode || ''} tidak ditemukan`);
            err.status = 404;
            throw err;
          }
        }

        const qty = Number(entry.qty);
        if (isNaN(qty) || qty <= 0) {
          const err = new Error(`Jumlah stok masuk untuk "${item.name}" harus lebih dari 0`);
          err.status = 400;
          throw err;
        }

        const newBuyPrice = entry.buy_price !== undefined && entry.buy_price !== null && !isNaN(entry.buy_price) && Number(entry.buy_price) >= 0
          ? Number(entry.buy_price)
          : (item.buy_price || 0);

        const newSellPrice = entry.sell_price !== undefined && entry.sell_price !== null && !isNaN(entry.sell_price) && Number(entry.sell_price) >= 0
          ? Number(entry.sell_price)
          : 0;

        const subtotal = newBuyPrice * qty;
        totalAmount += subtotal;
        totalItems += qty;

        restockItemRecords.push({
          itemId: item.id,
          name: item.name,
          qty,
          buyPrice: newBuyPrice,
          sellPrice: newSellPrice,
          subtotal
        });
      }

      const restockResult = insertRestockStmt.run(
        invoiceNo,
        totalAmount,
        totalItems,
        notes ? notes.trim() : ''
      );
      const restockId = restockResult.lastInsertRowid;

      for (const rec of restockItemRecords) {
        insertRestockItemStmt.run(
          restockId,
          rec.itemId,
          rec.name,
          rec.qty,
          rec.buyPrice,
          rec.sellPrice,
          rec.subtotal
        );

        updateItemStmt.run(
          rec.qty,
          rec.buyPrice,
          rec.buyPrice,
          rec.sellPrice,
          rec.sellPrice,
          rec.itemId
        );
      }

      this.db.exec('COMMIT');

      const restockData = this.db.prepare('SELECT * FROM restocks WHERE id = ?').get(restockId);
      const itemsData = this.db.prepare('SELECT * FROM restock_items WHERE restock_id = ?').all(restockId);

      return {
        ...restockData,
        items: itemsData
      };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getRestocks({ limit = 30, offset = 0 } = {}) {
    const list = this.db.prepare(`
      SELECT * FROM restocks ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset));

    const getItemsStmt = this.db.prepare('SELECT * FROM restock_items WHERE restock_id = ?');
    return list.map(r => ({
      ...r,
      items: getItemsStmt.all(r.id)
    }));
  }
}

module.exports = { ItemsService };
