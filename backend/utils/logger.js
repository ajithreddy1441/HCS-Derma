const fs = require('fs');
const path = require('path');

const logDir = process.env.VERCEL ? '/tmp/hcs-derma-logs' : path.join(__dirname, '..', 'logs');
try {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch {
  // Vercel package filesystem is read-only; console is enough.
}

function logError(err, req) {
  const line = `[${new Date().toISOString()}] ${req?.method || ''} ${req?.originalUrl || ''} ${err.stack || err.message}\n`;
  try {
    fs.appendFile(path.join(logDir, 'error.log'), line, () => {});
  } catch {
    /* ignore */
  }
  console.error(err);
}

module.exports = { logError };
