const express = require('express');
const path = require('node:path');
const { requestLogger } = require('./middlewares/logger');
const { errorHandler } = require('./middlewares/errorHandler');
const { createApiRouter } = require('./routes');

function createApp(db, dbPath) {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  // Static files for frontend
  app.use(express.static(path.join(__dirname, '../public'), {
    etag: false,
    maxAge: 0
  }));

  // Mount API router
  app.use('/api', createApiRouter(db, dbPath));

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
