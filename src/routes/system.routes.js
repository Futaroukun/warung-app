const { Router } = require('express');
const { SystemController } = require('../controllers/system.controller');

function createSystemRouter(db, dbPath) {
  const router = Router();
  const controller = new SystemController(db, dbPath);

  router.get('/health', controller.health);
  router.get('/backup', controller.backup);

  return router;
}

module.exports = { createSystemRouter };
