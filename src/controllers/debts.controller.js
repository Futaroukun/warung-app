class DebtsController {
  constructor(service) {
    this.service = service;
  }

  getAll = (req, res, next) => {
    try {
      const debts = this.service.getAll(req.query);
      res.json({ success: true, data: debts });
    } catch (err) {
      next(err);
    }
  };

  getById = (req, res, next) => {
    try {
      const debt = this.service.getById(req.params.id);
      if (!debt) return res.status(404).json({ success: false, error: 'Hutang tidak ditemukan' });
      res.json({ success: true, data: debt });
    } catch (err) {
      next(err);
    }
  };

  create = (req, res, next) => {
    try {
      const newDebt = this.service.create(req.body);
      res.status(201).json({ success: true, data: newDebt });
    } catch (err) {
      next(err);
    }
  };

  pay = (req, res, next) => {
    try {
      const updated = this.service.recordPayment(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  update = (req, res, next) => {
    try {
      const updated = this.service.update(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  delete = (req, res, next) => {
    try {
      const result = this.service.delete(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { DebtsController };
