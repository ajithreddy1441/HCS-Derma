const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { pagination } = require('../utils/scope');

exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return success(res, 'OK', { items: [] });
  const like = `%${q}%`;
  const [customers, leads, orders, payments, employees, products, units, qrs, shipments] = await Promise.all([
    query(
      `SELECT public_id AS id, name AS title, mobile AS subtitle, 'customer' AS type FROM customers
       WHERE name LIKE ? OR mobile LIKE ? OR public_id LIKE ? LIMIT 8`,
      [like, like, like]
    ),
    query(
      `SELECT public_id AS id, customer_name AS title, mobile AS subtitle, 'lead' AS type FROM leads
       WHERE customer_name LIKE ? OR mobile LIKE ? OR public_id LIKE ? LIMIT 8`,
      [like, like, like]
    ),
    query(
      `SELECT public_id AS id, public_id AS title, CAST(total AS CHAR) AS subtitle, 'order' AS type FROM orders
       WHERE public_id LIKE ? LIMIT 8`,
      [like]
    ),
    query(
      `SELECT public_id AS id, public_id AS title, COALESCE(utr,'') AS subtitle, 'payment' AS type FROM payments
       WHERE public_id LIKE ? OR utr LIKE ? LIMIT 8`,
      [like, like]
    ),
    query(
      `SELECT public_id AS id, name AS title, public_id AS subtitle, 'employee' AS type FROM employees
       WHERE name LIKE ? OR public_id LIKE ? OR mobile LIKE ? LIMIT 8`,
      [like, like, like]
    ),
    query(
      `SELECT public_id AS id, name AS title, sku AS subtitle, 'product' AS type FROM products
       WHERE name LIKE ? OR sku LIKE ? OR public_id LIKE ? OR barcode LIKE ? LIMIT 8`,
      [like, like, like, like]
    ),
    query(
      `SELECT public_id AS id, public_id AS title, sku AS subtitle, 'unit' AS type FROM product_units
       WHERE public_id LIKE ? LIMIT 8`,
      [like]
    ),
    query(
      `SELECT public_id AS id, token AS title, qr_type AS subtitle, 'qr' AS type FROM qr_codes
       WHERE token LIKE ? OR public_id LIKE ? LIMIT 8`,
      [like, like]
    ),
    query(
      `SELECT o.public_id AS id, COALESCE(s.awb_number, o.public_id) AS title, s.tracking_status AS subtitle, 'shipment' AS type
       FROM shipments s JOIN orders o ON o.id=s.order_id
       WHERE s.awb_number LIKE ? OR o.public_id LIKE ? LIMIT 8`,
      [like, like]
    ),
  ]);
  return success(res, 'OK', {
    items: [...customers, ...leads, ...orders, ...payments, ...employees, ...products, ...units, ...qrs, ...shipments],
  });
});

exports.notifications = asyncHandler(async (req, res) => {
  const items = await query(
    `SELECT * FROM notifications WHERE employee_id=? ORDER BY id DESC LIMIT 50`,
    [req.user.employee_id]
  );
  const unread = items.filter((n) => !n.is_read).length;
  return success(res, 'OK', { items, unread });
});

exports.markNotification = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read=1 WHERE id=? AND employee_id=?', [req.params.id, req.user.employee_id]);
  return success(res, 'Notification read');
});

exports.markAllNotifications = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read=1 WHERE employee_id=?', [req.user.employee_id]);
  return success(res, 'All notifications read');
});

exports.activity = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const admin = req.user.role === 'admin';
  const items = admin
    ? await query(
        `SELECT a.*, e.name AS employee_name, e.public_id AS employee_code
         FROM activity_logs a LEFT JOIN employees e ON e.id=a.employee_id
         ORDER BY a.id DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      )
    : await query(
        `SELECT a.*, e.name AS employee_name, e.public_id AS employee_code
         FROM activity_logs a LEFT JOIN employees e ON e.id=a.employee_id
         WHERE a.employee_id=?
         ORDER BY a.id DESC LIMIT ? OFFSET ?`,
        [req.user.employee_id, limit, offset]
      );
  return success(res, 'OK', { items, page, mine: !admin });
});

exports.audit = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 'Forbidden', 403);
  const { limit, offset, page } = pagination(req.query);
  const items = await query(
    `SELECT a.*, e.name AS employee_name, e.public_id AS employee_code
     FROM audit_logs a LEFT JOIN employees e ON e.id=a.employee_id
     WHERE (?='' OR a.record_id LIKE ? OR a.module LIKE ?)
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [req.query.q || '', `%${req.query.q || ''}%`, `%${req.query.q || ''}%`, limit, offset]
  );
  return success(res, 'OK', { items, page });
});

exports.settings = asyncHandler(async (_req, res) => {
  const rows = await query('SELECT setting_key, setting_value FROM settings');
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  if (map.shiprocket_password) map.shiprocket_password = '********';
  return success(res, 'OK', { settings: map });
});

exports.saveSettings = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 'Forbidden', 403);
  const entries = Object.entries(req.body.settings || req.body || {});
  for (const [k, v] of entries) {
    if (k === 'shiprocket_password' && (!v || String(v).includes('*'))) continue;
    await query(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?,?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
      [k, String(v)]
    );
  }
  return success(res, 'Settings saved');
});
