const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { isAdmin } = require('../utils/scope');

exports.list = asyncHandler(async (req, res) => {
  let extra = '';
  const params = [];
  if (!isAdmin(req.user) && req.user.role === 'telecaller') {
    extra = ' AND r.assigned_employee_id=?';
    params.push(req.user.employee_id);
  }
  if (req.query.status) {
    extra += ' AND r.status=?';
    params.push(req.query.status);
  }
  const items = await query(
    `SELECT r.*, c.name AS customer_name, c.mobile, c.address, o.public_id AS previous_order_code, o.order_date AS previous_order_date,
            p.name AS product_name, p.sku
     FROM reorders r
     JOIN customers c ON c.id = r.customer_id
     JOIN orders o ON o.id = r.previous_order_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE 1=1 ${extra}
     ORDER BY r.due_date ASC`,
    params
  );
  return success(res, 'OK', { items });
});

exports.prefill = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT r.*, c.*, o.public_id AS previous_order_code, o.order_date, p.name AS product_name, p.id AS product_pk, p.sku
     FROM reorders r
     JOIN customers c ON c.id = r.customer_id
     JOIN orders o ON o.id = r.previous_order_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE r.id=? OR r.public_id=?`,
    [req.params.id, req.params.id]
  );
  if (!rows.length) return fail(res, 'Reorder not found', 404);
  return success(res, 'OK', { reorder: rows[0] });
});

exports.convert = asyncHandler(async (req, res) => {
  await query(`UPDATE reorders SET status='converted', new_order_id=? WHERE id=? OR public_id=?`, [
    req.body.order_id,
    req.params.id,
    req.params.id,
  ]);
  return success(res, 'Reorder linked to new order');
});
