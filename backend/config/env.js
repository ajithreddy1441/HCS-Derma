const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.production') });
}

function envVal(name, fallback) {
  const value = process.env[name];
  if (!value || value === name || value === `$${name}` || value === `\${${name}}`) return fallback;
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret =
  envVal('JWT_SECRET') ||
  (process.env.VERCEL ? 'HcsDerma_Jwt_8f3c91a2e7b64d0c5a18f92e4b77c3d1' : 'dev-insecure-secret');

const onVercel = Boolean(process.env.VERCEL);

module.exports = {
  nodeEnv,
  port: Number(envVal('PORT', '5000')),
  jwtSecret,
  jwtExpiresIn: envVal('JWT_EXPIRES_IN', '8h'),
  db: {
    host: envVal('DB_HOST', onVercel ? 'srv843.hstgr.io' : '127.0.0.1'),
    port: Number(envVal('DB_PORT', '3306')),
    user: envVal('DB_USER', onVercel ? 'u611284906_xova' : 'root'),
    password: envVal('DB_PASSWORD', ''),
    database: envVal('DB_NAME', onVercel ? 'u611284906_xova' : 'nexus_crm'),
  },
  frontendUrl:
    process.env.FRONTEND_URL ||
    (nodeEnv === 'production' ? 'https://hcs-derma.vercel.app' : 'http://localhost:5173'),
  publicAppUrl: process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || (onVercel ? '/tmp/uploads' : 'uploads'),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  shiprocket: {
    email: process.env.SHIPROCKET_EMAIL || '',
    password: process.env.SHIPROCKET_PASSWORD || '',
    pickup: process.env.SHIPROCKET_PICKUP || 'work',
    baseUrl: process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external',
  },
};
