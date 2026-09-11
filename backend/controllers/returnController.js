const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination } = require('../utils/scope');
const { changeStock } = require('../services/inventoryService');
const { logActivity } = require('../services/auditService');

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const items = await query(
    `SELECT r.*, o.public_id AS order_code, c.name AS customer_name, e.name AS requested_by_name
     FROM returns r
     JOIN orders o ON o.id = r.order_id
     JOIN customers c ON c.id = r.customer_id
     LEFT JOIN employees e ON e.id = r.requested_by
     ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return success(res, 'OK', { items, page });
});

exports.get = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT r.*, o.public_id AS order_code FROM returns r JOIN orders o ON o.id=r.order_id WHERE r.id=? OR r.public_id=?`,
    [req.params.id, req.params.id]
  );
  if (!rows.length) return fail(res, 'Return not found', 404);
  const items = await query(
    `SELECT ri.*, p.name AS product_name FROM return_items ri JOIN products p ON p.id=ri.product_id WHERE ri.return_id=?`,
    [rows[0].id]
  );
  return success(res, 'OK', { return: rows[0], items });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  const orders = await query('SELECT * FROM orders WHERE id=? OR public_id=?', [b.order_id, b.order_id]);
  if (!orders.length) return fail(res, 'Order not found', 404);
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const created = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'RET', 'RET');
    const [ins] = await conn.query(
      `INSERT INTO returns (public_id, order_id, customer_id, reason, requested_by, status, image_path)
       VALUES (?,?,?,?,?,'return_requested',?)`,
      [publicId, orders[0].id, orders[0].customer_id, b.reason || 'other', req.user.employee_id, image]
    );
    let lines = [];
    try {
      if (b.items && b.items !== '') {
        lines = typeof b.items === 'string' ? JSON.parse(b.items) : b.items;
      }
    } catch {
      lines = [];
    }
    for (const line of lines) {
      const [p] = await conn.query('SELECT id, sku FROM products WHERE id=? OR public_id=? OR sku=?', [
        line.product_id,
        line.product_id,
        line.sku,
      ]);
      if (p.length) {
        await conn.query('INSERT INTO return_items (return_id, product_id, sku, quantity) VALUES (?,?,?,?)', [
          ins.insertId,
          p[0].id,
          p[0].sku,
          line.quantity || 1,
        ]);
      }
    }
    await conn.query(`UPDATE orders SET order_status='returned' WHERE id=?`, [orders[0].id]);
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Return Created',
      module: 'returns',
      recordId: publicId,
      description: b.reason,
    });
    return { id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Return created', created, 201);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM returns WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Return not found', 404);
  const r = rows[0];
  const status = req.body.status;
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE returns SET status=?, admin_remarks=?, return_awb=COALESCE(?, return_awb),
        received_date=IF(?='received', NOW(), received_date),
        approval_date=IF(? IN ('approved','approved_for_inventory'), NOW(), approval_date),
        approved_by=IF(? IN ('approved','approved_for_inventory'), ?, approved_by)
       WHERE id=?`,
      [status, req.body.admin_remarks || r.admin_remarks, req.body.return_awb || null, status, status, status, req.user.employee_id, r.id]
    );
    if (status === 'approved_for_inventory') {
      const [items] = await conn.query('SELECT * FROM return_items WHERE return_id=?', [r.id]);
      for (const item of items) {
        await changeStock(conn, {
          productId: item.product_id,
          delta: item.quantity,
          reason: 'return_approved',
          returnId: r.id,
          employeeId: req.user.employee_id,
          notes: 'Approved customer return',
        });
      }
    }
  });
  return success(res, 'Return updated');
});
