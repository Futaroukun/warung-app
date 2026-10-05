class ReportsController {
  constructor(service) {
    this.service = service;
  }

  getSummary = (req, res, next) => {
    try {
      const summary = this.service.getSummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  };

  getSalesReport = (req, res, next) => {
    try {
      const report = this.service.getSalesReport(req.query);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  };

  getProfitLoss = (req, res, next) => {
    try {
      const data = this.service.getProfitLossStatement(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  exportSalesCsv = (req, res, next) => {
    try {
      const csv = this.service.generateSalesCsv();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="laporan-penjualan-${dateStr}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };

  exportItemsCsv = (req, res, next) => {
    try {
      const csv = this.service.generateItemsCsv();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="data-stok-warung-${dateStr}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ReportsController };
