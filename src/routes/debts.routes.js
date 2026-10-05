const { Router } = require('express');
const { DebtsService } = require('../services/debts.service');
const { DebtsController } = require('../controllers/debts.controller');

function createDebtsRouter(db) {
  const router = Router();
  const service = new DebtsService(db);
  const controller = new DebtsController(service);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.post('/:id/pay', controller.pay);
  router.delete('/:id', controller.delete);

  return router;
}

module.exports = { createDebtsRouter };
