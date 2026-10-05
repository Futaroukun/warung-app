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
}

module.exports = { ReportsService };
