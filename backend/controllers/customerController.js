const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination, isAdmin } = require('../utils/scope');
const { logActivity, logAudit } = require('../services/auditService');

function filterAssigned(req) {
  if (isAdmin(req.user) || req.user.role === 'accountant') return { sql: '', params: [] };
  return { sql: ' AND c.assigned_employee_id = ?', params: [req.user.employee_id] };
}

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const q = `%${req.query.q || ''}%`;
  const scope = filterAssigned(req);
  const rows = await query(
    `SELECT c.*, e.name AS telecaller_name, e.public_id AS employee_code
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     WHERE (c.name LIKE ? OR c.mobile LIKE ? OR c.public_id LIKE ? OR c.store_name LIKE ?) ${scope.sql}
     ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    [q, q, q, q, ...scope.params, limit, offset]
  );
  const total = await query(
    `SELECT COUNT(*) AS c FROM customers c WHERE (c.name LIKE ? OR c.mobile LIKE ? OR c.public_id LIKE ?) ${scope.sql}`,
    [q, q, q, ...scope.params]
  );
  return success(res, 'OK', { items: rows, page, total: total[0].c });
});

exports.get = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT c.*, e.name AS telecaller_name, e.public_id AS employee_code
     FROM customers c LEFT JOIN employees e ON e.id = c.assigned_employee_id
     WHERE c.id=? OR c.public_id=?`,
    [req.params.id, req.params.id]
  );
  if (!rows.length) return fail(res, 'Customer not found', 404);
  const c = rows[0];
  const stats = await query(
    `SELECT
       COUNT(*) AS total_orders,
       COALESCE(SUM(CASE WHEN order_status='order_confirmed' OR order_status IN ('processing','ready_to_dispatch','dispatched','in_transit','out_for_delivery','delivered') THEN total ELSE 0 END),0) AS total_sales,
       COALESCE(SUM(payment_amount),0) AS total_payments,
       COALESCE(SUM(CASE WHEN payment_status IN ('pending','under_verification','payment_mismatch') THEN total ELSE 0 END),0) AS pending_payments,
       SUM(order_status='delivered') AS delivered_orders,
       SUM(order_status='cancelled') AS cancelled_orders,
       SUM(order_status='returned') AS returned_orders,
       MAX(order_date) AS last_order_date
     FROM orders WHERE customer_id=?`,
    [c.id]
  );
  const orders = await query('SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC LIMIT 50', [c.id]);
  const payments = await query('SELECT * FROM payments WHERE customer_id=? ORDER BY id DESC LIMIT 50', [c.id]);
  const followups = await query('SELECT * FROM followups WHERE customer_id=? ORDER BY followup_date DESC', [c.id]);
  const notes = await query(
    `SELECT n.*, e.name AS employee_name, e.public_id AS employee_code
     FROM customer_notes n LEFT JOIN employees e ON e.id = n.employee_id
     WHERE n.customer_id=? ORDER BY n.id DESC`,
    [c.id]
  );
  const returns = await query('SELECT * FROM returns WHERE customer_id=? ORDER BY id DESC', [c.id]);
  const reorders = await query('SELECT * FROM reorders WHERE customer_id=? ORDER BY id DESC', [c.id]);
  const activity = await query(
    `SELECT * FROM activity_logs WHERE record_id IN (?,?) OR (module='customers' AND record_id=?) ORDER BY id DESC LIMIT 100`,
    [c.public_id, String(c.id), c.public_id]
  );
  const deliveries = await query(
    `SELECT s.*, o.public_id AS order_code FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.customer_id=?`,
    [c.id]
  );
  return success(res, 'OK', {
    customer: c,
    stats: stats[0],
    orders,
    payments,
    followups,
    notes,
    returns,
    reorders,
    deliveries,
    activity,
  });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.name || !b.mobile) return fail(res, 'Customer name and mobile are required');
  if (!b.address || !b.city || !b.state || !String(b.pincode || '').replace(/\D/g, '').match(/^\d{6}$/)) {
    return fail(res, 'Address, city, state and 6-digit pincode are required for delivery');
  }
  const created = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'CUS', 'CUS');
    const assigned = b.assigned_employee_id || req.user.employee_id;
    const [ins] = await conn.query(
      `INSERT INTO customers (public_id, name, store_name, mobile, alternate_mobile, email, address, city, state, pincode, assigned_employee_id, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active', ?)`,
      [publicId, b.name, b.store_name || null, b.mobile, b.alternate_mobile || null, b.email || null, b.address || null, b.city || null, b.state || null, b.pincode || null, assigned, req.user.employee_id]
    );
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Customer Created',
      module: 'customers',
      recordId: publicId,
      description: b.name,
    });
    return { id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Customer created successfully', created, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM customers WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Customer not found', 404);
  const c = rows[0];
  const b = req.body;
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE customers SET name=?, store_name=?, mobile=?, alternate_mobile=?, email=?, address=?, city=?, state=?, pincode=?, assigned_employee_id=?, status=? WHERE id=?`,
      [
        b.name ?? c.name,
        b.store_name ?? c.store_name,
        b.mobile ?? c.mobile,
        b.alternate_mobile ?? c.alternate_mobile,
        b.email ?? c.email,
        b.address ?? c.address,
        b.city ?? c.city,
        b.state ?? c.state,
        b.pincode ?? c.pincode,
        b.assigned_employee_id ?? c.assigned_employee_id,
        b.status ?? c.status,
        c.id,
      ]
    );
    for (const f of ['name', 'mobile', 'status', 'assigned_employee_id']) {
      if (b[f] != null && String(b[f]) !== String(c[f])) {
        await logAudit(conn, {
          employeeId: req.user.employee_id,
          module: 'customers',
          recordId: c.public_id,
          field: f,
          oldValue: c[f],
          newValue: b[f],
          action: 'update',
        });
      }
    }
  });
  return success(res, 'Customer updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 'Forbidden', 403);
  const rows = await query('SELECT * FROM customers WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Customer not found', 404);
  await query('UPDATE customers SET status="inactive" WHERE id=?', [rows[0].id]);
  return success(res, 'Customer deactivated');
});

exports.addNote = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM customers WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Customer not found', 404);
  if (!req.body.note) return fail(res, 'Note is required');
  await query('INSERT INTO customer_notes (customer_id, note, employee_id) VALUES (?,?,?)', [
    rows[0].id,
    req.body.note,
    req.user.employee_id,
  ]);
  return success(res, 'Note added', {}, 201);
});
