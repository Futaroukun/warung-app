const { Router } = require('express');
const { createItemsRouter } = require('./items.routes');
const { createSalesRouter } = require('./sales.routes');
const { createDebtsRouter } = require('./debts.routes');
const { createReportsRouter } = require('./reports.routes');
const { createSystemRouter } = require('./system.routes');

function createApiRouter(db, dbPath) {
  const router = Router();

  router.use('/items', createItemsRouter(db));
  router.use('/sales', createSalesRouter(db));
  router.use('/debts', createDebtsRouter(db));
  router.use('/reports', createReportsRouter(db));
  router.use('/system', createSystemRouter(db, dbPath));

  // Backward compatibility alias: /api/summary directly
  const reportsRouter = createReportsRouter(db);
  router.get('/summary', (req, res, next) => {
    req.url = '/summary';
    reportsRouter(req, res, next);
  });

  return router;
}

module.exports = { createApiRouter };
