const path = require('path');
const fs = require('fs');
const multer = require('multer');
const env = require('../config/env');

const dest = path.isAbsolute(env.uploadDir) ? env.uploadDir : path.join(__dirname, '..', env.uploadDir);
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dest),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new Error('Invalid file type'));
    cb(null, true);
  },
});

module.exports = { upload, dest };
