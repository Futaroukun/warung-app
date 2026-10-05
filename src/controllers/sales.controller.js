class SalesController {
  constructor(service) {
    this.service = service;
  }

  getAll = (req, res, next) => {
    try {
      const sales = this.service.getAll(req.query);
      res.json({ success: true, data: sales });
    } catch (err) {
      next(err);
    }
  };

  getById = (req, res, next) => {
    try {
      const sale = this.service.getById(req.params.id);
      if (!sale) return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
      res.json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  };

  create = (req, res, next) => {
    try {
      const sale = this.service.createTransaction(req.body);
      res.status(201).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { SalesController };
