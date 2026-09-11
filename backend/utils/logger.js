const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function logError(err, req) {
  const line = `[${new Date().toISOString()}] ${req?.method || ''} ${req?.originalUrl || ''} ${err.stack || err.message}\n`;
  fs.appendFile(path.join(logDir, 'error.log'), line, () => {});
  if (process.env.NODE_ENV !== 'production') console.error(err);
}

module.exports = { logError };
