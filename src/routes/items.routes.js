const { Router } = require('express');
const { ItemsService } = require('../services/items.service');
const { ItemsController } = require('../controllers/items.controller');

function createItemsRouter(db) {
  const router = Router();
  const service = new ItemsService(db);
  const controller = new ItemsController(service);

  router.get('/', controller.getAll);
  router.get('/barcode/:barcode', controller.getByBarcode);
  router.get('/restocks', controller.getRestocks);
  router.post('/restock-batch', controller.batchRestock);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.patch('/:id/stock', controller.updateStock);
  router.delete('/:id', controller.delete);

  return router;
}

module.exports = { createItemsRouter };
