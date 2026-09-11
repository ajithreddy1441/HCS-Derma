const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = Array.from(
  new Set(
    [
      'https://hcs-derma.vercel.app',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      ...String(env.frontendUrl || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ]
  )
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/hcs-derma[\w.-]*\.vercel\.app$/.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(path.isAbsolute(env.uploadDir) ? env.uploadDir : path.join(__dirname, env.uploadDir)));

app.get('/api/health', (_req, res) =>
  res.json({
    success: true,
    message: 'HCS DERMA API',
    data:
      env.nodeEnv === 'production'
        ? { ok: true, env: 'production' }
        : {
            dbHost: env.db.host,
            dbPort: env.db.port,
            dbUser: env.db.user,
            dbName: env.db.database,
          },
  })
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/users', require('./routes/employees'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/products', require('./routes/products'));
app.use('/api/product-units', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/payment-approvals', require('./routes/payments'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/tracking', require('./routes/shipments'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/reorders', require('./routes/reorders'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api', require('./routes/hr'));
app.use('/api', require('./routes/system'));

const webRoot = process.env.VERCEL
  ? null
  : [path.join(__dirname, 'public'), path.join(__dirname, '..', 'frontend', 'dist')].find((dir) =>
      fs.existsSync(path.join(dir, 'index.html'))
    );
if (webRoot) {
  app.use(express.static(webRoot));
  app.get(/^(?!\/api)(?!\/uploads).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(webRoot, 'index.html'));
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  return res.status(404).send('Not found');
});
app.use(errorHandler);

module.exports = app;
