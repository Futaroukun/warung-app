const { Router } = require('express');
const { SalesService } = require('../services/sales.service');
const { SalesController } = require('../controllers/sales.controller');

function createSalesRouter(db) {
  const router = Router();
  const service = new SalesService(db);
  const controller = new SalesController(service);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);

  return router;
}

module.exports = { createSalesRouter };
