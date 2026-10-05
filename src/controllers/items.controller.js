class ItemsController {
  constructor(service) {
    this.service = service;
  }

  getAll = (req, res, next) => {
    try {
      const items = this.service.getAll(req.query);
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  };

  getById = (req, res, next) => {
    try {
      const item = this.service.getById(req.params.id);
      if (!item) return res.status(404).json({ success: false, error: 'Barang tidak ditemukan' });
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  getByBarcode = (req, res, next) => {
    try {
      const includeAll = req.query.include_all === 'true' || req.query.all === 'true';
      const item = this.service.getByBarcode(req.params.barcode, includeAll);
      if (!item) return res.status(404).json({ success: false, error: 'Barang dengan barcode ini tidak ditemukan' });
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  create = (req, res, next) => {
    try {
      const newItem = this.service.create(req.body);
      res.status(201).json({ success: true, data: newItem });
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

  updateStock = (req, res, next) => {
    try {
      const { qty } = req.body;
      if (qty === undefined) return res.status(400).json({ success: false, error: 'Jumlah qty wajib diisi' });
      const updated = this.service.updateStock(req.params.id, qty);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  delete = (req, res, next) => {
    try {
      const permanent = req.query.permanent === 'true' || req.query.permanent === true;
      const result = this.service.delete(req.params.id, permanent);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ItemsController };
