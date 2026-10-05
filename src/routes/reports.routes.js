const { Router } = require('express');
const { ReportsService } = require('../services/reports.service');
const { ReportsController } = require('../controllers/reports.controller');

function createReportsRouter(db) {
  const router = Router();
  const service = new ReportsService(db);
  const controller = new ReportsController(service);

  router.get('/summary', controller.getSummary);
  router.get('/sales', controller.getSalesReport);
  router.get('/profit-loss', controller.getProfitLoss);
  router.get('/export/sales', controller.exportSalesCsv);
  router.get('/export/items', controller.exportItemsCsv);

  return router;
}

module.exports = { createReportsRouter };
