const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.production') });
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret =
  process.env.JWT_SECRET ||
  (process.env.VERCEL ? 'HcsDerma_Jwt_8f3c91a2e7b64d0c5a18f92e4b77c3d1' : 'dev-insecure-secret');

const onVercel = Boolean(process.env.VERCEL);

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT || 5000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexus_crm',
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
