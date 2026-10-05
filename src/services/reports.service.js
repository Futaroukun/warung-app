class ReportsService {
  constructor(db) {
    this.db = db;
  }

  getSummary() {
    const todaySales = this.db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total,
        COALESCE(SUM(total_amount - total_cost), 0) AS profit,
        COUNT(id) AS count
      FROM sales
      WHERE date(created_at) = date('now', 'localtime')
    `).get();

    const monthSales = this.db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total,
        COALESCE(SUM(total_amount - total_cost), 0) AS profit,
        COUNT(id) AS count
      FROM sales
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
    `).get();

    const debtStats = this.db.prepare(`
      SELECT 
        COALESCE(SUM(amount - paid_amount), 0) AS total_debt,
        COUNT(id) AS debt_count
      FROM debts
      WHERE status = 'belum_lunas'
    `).get();

    const itemStats = this.db.prepare(`
      SELECT 
        COUNT(id) AS total_items,
        SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END) AS low_stock_count,
        COALESCE(SUM(stock * buy_price), 0) AS asset_value
      FROM items
      WHERE is_active = 1
    `).get();

    return {
      today_sales: todaySales.total,
      today_profit: todaySales.profit,
      today_transactions: todaySales.count,
      month_sales: monthSales.total,
      month_profit: monthSales.profit,
      month_transactions: monthSales.count,
      total_debt: debtStats.total_debt,
      debt_count: debtStats.debt_count,
      total_items: itemStats.total_items,
      low_stock_count: itemStats.low_stock_count || 0,
      inventory_asset_value: itemStats.asset_value
    };
  }

  getSalesReport({ startDate, endDate } = {}) {
    let query = `
      SELECT 
        date(created_at) AS sale_date,
        COUNT(id) AS transaction_count,
        SUM(total_amount) AS total_revenue,
        SUM(total_cost) AS total_cost,
        SUM(total_amount - total_cost) AS net_profit
      FROM sales
    `;
    const params = [];

    if (startDate && endDate) {
      query += ' WHERE date(created_at) BETWEEN date(?) AND date(?)';
      params.push(startDate, endDate);
    }

    query += ' GROUP BY date(created_at) ORDER BY date(created_at) DESC';
    return this.db.prepare(query).all(...params);
  }

  getProfitLossStatement({ startDate, endDate } = {}) {
    let salesQuery = `
      SELECT 
        COALESCE(SUM(total_amount), 0) AS gross_revenue,
        COALESCE(SUM(total_cost), 0) AS cogs_total,
        COALESCE(SUM(total_amount - total_cost), 0) AS net_profit,
        COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE cash_received END), 0) AS cash_collected
      FROM sales
      WHERE 1=1
    `;
    const params = [];
    if (startDate && endDate) {
      salesQuery += ' AND date(created_at) BETWEEN date(?) AND date(?)';
      params.push(startDate, endDate);
    }
    const salesStats = this.db.prepare(salesQuery).get(...params);

    const grossRev = Number(salesStats.gross_revenue) || 0;
    const cogs = Number(salesStats.cogs_total) || 0;
    const netProfit = Number(salesStats.net_profit) || 0;
    const marginPercent = grossRev > 0 ? Number(((netProfit / grossRev) * 100).toFixed(1)) : 0;

    let topQuery = `
      SELECT 
        item_name,
        SUM(qty) AS total_qty,
        SUM(subtotal) AS total_revenue,
        SUM(subtotal - (buy_price * qty)) AS total_profit
      FROM sale_items
      GROUP BY item_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const topProducts = this.db.prepare(topQuery).all();

    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      gross_revenue: grossRev,
      cogs_total: cogs,
      net_profit: netProfit,
      profit_margin_percent: marginPercent,
      cash_collected: Number(salesStats.cash_collected) || 0,
      top_products_by_revenue: topProducts
    };
  }

  generateSalesCsv() {
    const sales = this.db.prepare(`
      SELECT 
        s.id,
        s.invoice_no,
        s.created_at,
        s.customer_name,
        s.payment_type,
        s.total_amount,
        s.total_cost,
        (s.total_amount - s.total_cost) AS profit
      FROM sales s
      ORDER BY s.created_at DESC
    `).all();

    const getItemStmt = this.db.prepare('SELECT item_name, qty, sell_price, subtotal FROM sale_items WHERE sale_id = ?');

    let csv = '"No Invoice","Tanggal","Pelanggan","Metode Pembayaran","Total Belanja (Rp)","Modal HPP (Rp)","Laba Bersih (Rp)","Rincian Produk"\n';

    for (const s of sales) {
      const items = getItemStmt.all(s.id);
      const itemsStr = items.map(it => `${it.item_name} (${it.qty}x)`).join('; ');

      const row = [
        `"${s.invoice_no || ''}"`,
        `"${s.created_at}"`,
        `"${(s.customer_name || 'Umum').replace(/"/g, '""')}"`,
        `"${s.payment_type === 'cash' ? 'Tunai' : (s.payment_type === 'debt' ? 'Kasbon' : s.payment_type)}"`,
        s.total_amount,
        s.total_cost,
        s.profit,
        `"${itemsStr.replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  generateItemsCsv() {
    const items = this.db.prepare(`
      SELECT barcode, name, category, buy_price, sell_price, stock, min_stock, unit, (stock * buy_price) AS asset_val
      FROM items
      WHERE is_active = 1
      ORDER BY name ASC
    `).all();

    let csv = '"Barcode","Nama Produk","Kategori","Harga Modal (Rp)","Harga Jual (Rp)","Margin Laba (Rp)","Stok","Satuan","Nilai Aset Modal (Rp)","Status Stok"\n';

    for (const it of items) {
      const margin = (it.sell_price || 0) - (it.buy_price || 0);
      let status = 'Aman';
      if (it.stock === 0) status = 'Habis';
      else if (it.stock <= it.min_stock) status = 'Kritis';

      const row = [
        `"${it.barcode || ''}"`,
        `"${(it.name || '').replace(/"/g, '""')}"`,
        `"${(it.category || 'Umum').replace(/"/g, '""')}"`,
        it.buy_price || 0,
        it.sell_price || 0,
        margin,
        it.stock || 0,
        `"${it.unit || 'pcs'}"`,
        it.asset_val || 0,
        `"${status}"`
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }
}

module.exports = { ReportsService };
