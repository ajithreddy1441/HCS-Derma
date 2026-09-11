const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'dev-insecure-secret';
if (nodeEnv === 'production' && (!process.env.JWT_SECRET || jwtSecret === 'dev-insecure-secret')) {
  throw new Error('Set a strong JWT_SECRET in backend/.env before running in production');
}

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
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  shiprocket: {
    email: process.env.SHIPROCKET_EMAIL || '',
    password: process.env.SHIPROCKET_PASSWORD || '',
    pickup: process.env.SHIPROCKET_PICKUP || 'work',
    baseUrl: process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external',
  },
};
