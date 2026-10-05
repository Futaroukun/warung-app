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
}

module.exports = { ReportsController };
