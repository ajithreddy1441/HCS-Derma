const { logError } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logError(err, req);
  const dbDenied = err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR' || err.errno === 1044 || err.errno === 1045;
  const dbDown = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET';
  if (dbDenied || dbDown) {
    return res.status(503).json({
      success: false,
      message: err.message || 'Cannot connect to MySQL. Restart the backend after changing .env. From your PC, DB_HOST must be srv843.hstgr.io and Remote MySQL must allow your IP.',
    });
  }
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
}

module.exports = errorHandler;
