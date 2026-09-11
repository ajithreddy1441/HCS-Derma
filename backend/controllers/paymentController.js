const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination, isAdmin } = require('../utils/scope');
const { classifyAmount, approvePayment, rejectPayment } = require('../services/paymentService');
const { logActivity } = require('../services/auditService');

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  let extra = '';
  const params = [];
  if (!isAdmin(req.user) && req.user.role === 'telecaller') {
    extra += ' AND p.uploaded_by = ?';
    params.push(req.user.employee_id);
  }
  if (req.query.status) {
    extra += ' AND p.status=?';
    params.push(req.query.status);
  }
  const q = `%${req.query.q || ''}%`;
  extra += ' AND (p.public_id LIKE ? OR p.utr LIKE ? OR o.public_id LIKE ? OR c.name LIKE ?)';
  params.push(q, q, q, q);
  const items = await query(
    `SELECT p.*, o.public_id AS order_code, o.total AS order_total, c.name AS customer_name, c.mobile,
            e.name AS employee_name, e.public_id AS employee_code
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = p.customer_id
     LEFT JOIN employees e ON e.id = p.uploaded_by
     WHERE 1=1 ${extra}
     ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return success(res, 'OK', { items, page });
});

exports.get = asyncHandler(async (req, res) => {
  const items = await query(
    `SELECT p.*, o.public_id AS order_code, o.total AS order_total, c.name AS customer_name
     FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=p.customer_id
     WHERE p.id=? OR p.public_id=?`,
    [req.params.id, req.params.id]
  );
  if (!items.length) return fail(res, 'Payment not found', 404);
  const approvals = await query('SELECT * FROM payment_approvals WHERE payment_id=? ORDER BY id', [items[0].id]);
  return success(res, 'OK', { payment: items[0], approvals });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.order_id || !b.amount || !b.payment_mode) return fail(res, 'Order, amount and payment mode are required');
  const orders = await query('SELECT * FROM orders WHERE id=? OR public_id=?', [b.order_id, b.order_id]);
  if (!orders.length) return fail(res, 'Order not found', 404);
  const order = orders[0];
  const screenshot = req.file ? `/uploads/${req.file.filename}` : b.screenshot_path || null;
  const created = await withTransaction(async (conn) => {
    const { status, mismatch } = classifyAmount(b.amount, order.total);
    const publicId = await nextPublicId(conn, 'PAY', 'PAY');
    const dt = b.payment_datetime || new Date();
    const [ins] = await conn.query(
      `INSERT INTO payments (public_id, order_id, customer_id, amount, payment_mode, utr, payment_datetime, screenshot_path, uploaded_by, status, mismatch_difference)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        publicId,
        order.id,
        order.customer_id,
        b.amount,
        b.payment_mode,
        b.utr || null,
        dt,
        screenshot,
        req.user.employee_id,
        status,
        mismatch,
      ]
    );
    const orderStatus = status === 'payment_mismatch' ? 'payment_verification' : 'payment_verification';
    const payStatus = status;
    await conn.query('UPDATE orders SET payment_status=?, order_status=?, payment_amount=? WHERE id=?', [
      payStatus,
      orderStatus,
      b.amount,
      order.id,
    ]);
    await conn.query('INSERT INTO payment_approvals (payment_id, action, actor_id, notes) VALUES (?,?,?,?)', [
      ins.insertId,
      'verify',
      req.user.employee_id,
      'Uploaded for verification',
    ]);
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Payment Uploaded',
      module: 'payments',
      recordId: publicId,
      description: `UTR ${b.utr || '-'}`,
    });
    const { notifyRole } = require('../services/auditService');
    await notifyRole(conn, 'admin', {
      title: status === 'payment_mismatch' ? 'Payment Mismatch' : 'Payment Verification Required',
      body: `Payment ${publicId} needs review`,
      type: status === 'payment_mismatch' ? 'payment_mismatch' : 'payment_verification',
      refModule: 'payments',
      refId: ins.insertId,
    });
    await notifyRole(conn, 'accountant', {
      title: 'Payment Verification Required',
      body: `Payment ${publicId} needs review`,
      type: 'payment_verification',
      refModule: 'payments',
      refId: ins.insertId,
    });
    return { id: ins.insertId, public_id: publicId, status, mismatch };
  });
  return success(res, 'Payment uploaded', created, 201);
});

exports.queue = asyncHandler(async (req, res) => {
  const items = await query(
    `SELECT p.*, o.public_id AS order_code, o.total AS order_total, c.name AS customer_name, c.mobile,
            e.name AS telecaller_name, e.public_id AS employee_code
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = p.customer_id
     LEFT JOIN employees e ON e.id = p.uploaded_by
     WHERE p.status IN ('pending','under_verification','payment_mismatch')
     ORDER BY CASE WHEN p.status='payment_mismatch' THEN 0 ELSE 1 END, p.id ASC`
  );
  return success(res, 'OK', { items });
});

exports.approve = asyncHandler(async (req, res) => {
  if (req.user.role === 'telecaller') return fail(res, 'Telecallers cannot approve payments', 403);
  const found = await query('SELECT id, order_id FROM payments WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!found.length) return fail(res, 'Payment not found', 404);
  await withTransaction(async (conn) => {
    await approvePayment(conn, { paymentId: found[0].id, actor: req.user, notes: req.body.notes });
  });
  let shipment = null;
  let shiprocket_error = null;
  try {
    const { syncOrderToShiprocket } = require('../services/shipmentSync');
    shipment = await syncOrderToShiprocket(found[0].order_id, { employeeId: req.user.employee_id });
  } catch (err) {
    shiprocket_error = err.message;
  }
  return success(res, shiprocket_error
    ? `Payment approved. Shiprocket push failed: ${shiprocket_error}`
    : shipment?.mock
      ? 'Payment approved. Order confirmed. Add Shiprocket credentials in Settings to send live shipments.'
      : 'Payment approved. Order confirmed and sent to Shiprocket.', { shipment, shiprocket_error });
});

exports.reject = asyncHandler(async (req, res) => {
  if (req.user.role === 'telecaller') return fail(res, 'Telecallers cannot reject payments', 403);
  if (!req.body.reason) return fail(res, 'Rejection reason is required');
  const found = await query('SELECT id FROM payments WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!found.length) return fail(res, 'Payment not found', 404);
  await withTransaction(async (conn) => {
    await rejectPayment(conn, {
      paymentId: found[0].id,
      actor: req.user,
      reason: req.body.reason,
      notes: req.body.notes,
    });
  });
  return success(res, 'Payment rejected');
});

exports.verify = asyncHandler(async (req, res) => {
  const found = await query('SELECT * FROM payments WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!found.length) return fail(res, 'Payment not found', 404);
  await query(`UPDATE payments SET status='under_verification' WHERE id=? AND status!='approved'`, [found[0].id]);
  await query('INSERT INTO payment_approvals (payment_id, action, actor_id, notes) VALUES (?,?,?,?)', [
    found[0].id,
    req.body.action || 'request_verification',
    req.user.employee_id,
    req.body.notes || null,
  ]);
  return success(res, 'Payment marked for verification');
});
