const path = require('node:path');
const fs = require('node:fs');

class SystemController {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
  }

  health = (req, res) => {
    const memory = process.memoryUsage();
    res.json({
      success: true,
      data: {
        status: 'ok',
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage_mb: {
          rss: (memory.rss / 1024 / 1024).toFixed(2),
          heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2),
          heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(2)
        },
        database: 'connected (WAL mode)'
      }
    });
  };

  backup = (req, res, next) => {
    try {
      // Checkpoint WAL first to flush write buffer to disk
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `warung-backup-${dateStr}.db`;

      res.setHeader('Content-Type', 'application/vnd.sqlite3');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(this.dbPath);
      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { SystemController };
