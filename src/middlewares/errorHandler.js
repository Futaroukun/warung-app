function errorHandler(err, req, res, next) {
  console.error(`[ERROR ${new Date().toISOString()}]`, err);

  const status = err.status || (err.message && err.message.includes('UNIQUE constraint') ? 409 : 500);
  const message = err.clientMessage || err.message || 'Terjadi kesalahan pada server';

  res.status(status).json({
    success: false,
    error: message
  });
}

module.exports = { errorHandler };
