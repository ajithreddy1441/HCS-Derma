const crypto = require('crypto');
const QRCode = require('qrcode');
const env = require('../config/env');
const { nextPublicId } = require('../utils/ids');

function randomToken() {
  return crypto.randomBytes(16).toString('hex');
}

function scanUrl(token) {
  return `${env.publicAppUrl.replace(/\/$/, '')}/scan/${token}`;
}

async function nextQrNumber(conn) {
  await conn.query("INSERT IGNORE INTO id_sequences (entity, last_number) VALUES ('QRNUM', 0)");
  await conn.query("UPDATE id_sequences SET last_number = last_number + 1 WHERE entity='QRNUM'");
  const [rows] = await conn.query("SELECT last_number FROM id_sequences WHERE entity='QRNUM'");
  return Number(rows[0].last_number);
}

async function createQr(conn, { type, productId, unitId, orderId, employeeId, qrNumber, skipImage }) {
  const token = randomToken();
  const publicId = await nextPublicId(conn, 'QR', 'QR');
  const number = qrNumber || await nextQrNumber(conn);
  await conn.query(
    `INSERT INTO qr_codes (public_id, token, qr_number, qr_type, product_id, product_unit_id, order_id, status, packed_status, created_by)
     VALUES (?,?,?,?,?,?,?, 'ACTIVE', 'pending', ?)`,
    [publicId, token, number, type, productId || null, unitId || null, orderId || null, employeeId || null]
  );
  const url = scanUrl(token);
  const item = { public_id: publicId, publicId, token, qr_number: number, sku: String(number), url };
  if (!skipImage) item.dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  return item;
}

module.exports = { randomToken, scanUrl, createQr, nextQrNumber };
