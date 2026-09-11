const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { createQr, nextQrNumber, scanUrl } = require('../services/qrService');
const QRCode = require('qrcode');

exports.generate = asyncHandler(async (req, res) => {
  const { qr_type, product_id, quantity } = req.body;
  const qty = Math.min(Math.max(Number(quantity || 100), 1), 500);
  const pid = product_id != null && String(product_id).trim() && String(product_id) !== 'undefined'
    ? String(product_id).trim()
    : '';
  let product = null;
  if (pid) {
      const products = await query('SELECT * FROM products WHERE id=? OR public_id=? OR sku=?', [
        pid,
        pid,
        pid,
      ]);
    if (!products.length) return fail(res, 'Product not found', 404);
    product = products[0];
  }
  const type = product ? (qr_type || 'PRODUCT_UNIT') : 'PRODUCT';
  const items = await withTransaction(async (conn) => {
    const out = [];
    const { nextPublicId } = require('../utils/ids');
    for (let i = 0; i < qty; i += 1) {
      const qrNumber = await nextQrNumber(conn);
      const sku = String(qrNumber);
      let unitId = null;
      if (type === 'PRODUCT_UNIT' && product) {
        const unitPublicId = await nextPublicId(conn, 'UNIT', 'UNIT');
        const [ins] = await conn.query(
          `INSERT INTO product_units (public_id, product_id, sku, status) VALUES (?,?,?,'available')`,
          [unitPublicId, product.id, sku]
        );
        unitId = ins.insertId;
      }
      const qr = await createQr(conn, {
        type,
        productId: product?.id || null,
        unitId,
        qrNumber,
        skipImage: true,
        employeeId: req.user.employee_id,
      });
      out.push({
        ...qr,
        sku,
        product_name: product?.name || null,
        status: 'ACTIVE',
        order_code: null,
      });
    }
    return out;
  });
  return success(res, `${items.length} QR codes generated`, { items });
});

exports.bulk = exports.generate;

exports.getByToken = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM qr_codes WHERE token=?', [req.params.token]);
  if (!rows.length) return fail(res, 'QR not found', 404);
  const qr = rows[0];
  const url = scanUrl(qr.token);
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  return success(res, 'OK', { qr, url, dataUrl });
});

exports.update = asyncHandler(async (req, res) => {
  await query('UPDATE qr_codes SET status=? WHERE id=? OR public_id=?', [req.body.status, req.params.id, req.params.id]);
  return success(res, 'QR updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM qr_codes WHERE id=? OR public_id=? OR token=?', [
    req.params.id,
    req.params.id,
    req.params.id,
  ]);
  if (!rows.length) return fail(res, 'QR not found', 404);
  const qr = rows[0];
  if (qr.order_id) return fail(res, 'Cannot delete a QR that is already assigned to an order', 400);
  await withTransaction(async (conn) => {
    await conn.query(`UPDATE qr_codes SET status='DISABLED' WHERE id=?`, [qr.id]);
    if (qr.product_unit_id) {
      await conn.query(`UPDATE product_units SET status='damaged' WHERE id=? AND order_id IS NULL`, [qr.product_unit_id]);
    }
  });
  return success(res, 'QR deleted');
});

exports.available = asyncHandler(async (req, res) => {
  let extra = " AND q.order_id IS NULL AND q.status='ACTIVE'";
  const params = [];
  if (req.query.product_id) {
    extra += ' AND (q.product_id=? OR q.product_id IS NULL)';
    params.push(req.query.product_id);
  }
  const items = await query(
    `SELECT q.id, q.qr_number, q.public_id, q.qr_type, q.product_id,
            CAST(q.qr_number AS CHAR) AS sku, p.name AS product_name, u.sku AS unit_sku
     FROM qr_codes q
     LEFT JOIN products p ON p.id = q.product_id
     LEFT JOIN product_units u ON u.id = q.product_unit_id
     WHERE 1=1 ${extra}
     ORDER BY q.qr_number ASC`,
    params
  );
  return success(res, 'OK', { items });
});

exports.list = asyncHandler(async (_req, res) => {
  const items = await query(
    `SELECT q.*, CAST(q.qr_number AS CHAR) AS sku, p.name AS product_name, p.sku AS product_sku,
            u.public_id AS unit_code, u.sku AS unit_sku, o.public_id AS order_code
     FROM qr_codes q
     LEFT JOIN products p ON p.id = q.product_id
     LEFT JOIN product_units u ON u.id = q.product_unit_id
     LEFT JOIN orders o ON o.id = q.order_id
     WHERE q.status != 'DISABLED'
     ORDER BY q.qr_number ASC
     LIMIT 2000`
  );
  return success(res, 'OK', { items });
});
