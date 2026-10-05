const { getDb, DEFAULT_DB_PATH } = require('./src/config/database');
const { createApp } = require('./src/app');

const PORT = process.env.PORT || 3000;
const db = getDb();
const app = createApp(db, DEFAULT_DB_PATH);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`   WARUNG PRO SERVER MODULAR ENGINE V2.0       `);
  console.log(`   Status     : Running                        `);
  console.log(`   Local URL  : http://localhost:${PORT}        `);
  console.log(`   DB Engine  : SQLite WAL Mode (Ultra-Fast)   `);
  console.log(`===============================================`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Closing HTTP server and flushing SQLite database...`);
  server.close(() => {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      db.close();
      console.log('Database safely closed. Process exiting.');
    } catch (err) {
      console.error('Error during database closure:', err);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
