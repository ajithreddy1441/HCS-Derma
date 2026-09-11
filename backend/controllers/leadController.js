const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination, isAdmin } = require('../utils/scope');
const { logActivity } = require('../services/auditService');

function scope(req) {
  if (isAdmin(req.user) || req.user.role === 'accountant') return { sql: '', params: [] };
  return { sql: ' AND l.assigned_employee_id = ?', params: [req.user.employee_id] };
}

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const q = `%${req.query.q || ''}%`;
  const sc = scope(req);
  const st = req.query.status ? ' AND l.status=?' : '';
  const params = [q, q, q, ...sc.params];
  if (req.query.status) params.push(req.query.status);
  const rows = await query(
    `SELECT l.*, e.name AS telecaller_name, e.public_id AS employee_code, c.public_id AS customer_code
     FROM leads l
     LEFT JOIN employees e ON e.id = l.assigned_employee_id
     LEFT JOIN customers c ON c.id = l.converted_customer_id
     WHERE (l.customer_name LIKE ? OR l.mobile LIKE ? OR l.public_id LIKE ?) ${sc.sql} ${st}
     ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return success(res, 'OK', { items: rows, page });
});

exports.get = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT l.*, e.name AS telecaller_name FROM leads l
     LEFT JOIN employees e ON e.id=l.assigned_employee_id WHERE l.id=? OR l.public_id=?`,
    [req.params.id, req.params.id]
  );
  if (!rows.length) return fail(res, 'Lead not found', 404);
  const followups = await query('SELECT * FROM followups WHERE lead_id=? ORDER BY id DESC', [rows[0].id]);
  const notes = await query('SELECT * FROM customer_notes WHERE lead_id=? ORDER BY id DESC', [rows[0].id]);
  return success(res, 'OK', { lead: rows[0], followups, notes });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.customer_name || !b.mobile) return fail(res, 'Name and mobile are required');
  const created = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'LEAD', 'LEAD');
    const assigned = b.assigned_employee_id || req.user.employee_id;
    const [ins] = await conn.query(
      `INSERT INTO leads (public_id, customer_name, mobile, interested_product, source, reason_not_purchasing,
        assigned_employee_id, notes, next_followup_date, next_followup_time, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        publicId,
        b.customer_name,
        b.mobile,
        b.interested_product || null,
        b.source || null,
        b.reason_not_purchasing || null,
        assigned,
        b.notes || null,
        b.next_followup_date || null,
        b.next_followup_time || null,
        b.status || 'new',
        req.user.employee_id,
      ]
    );
    if (b.next_followup_date) {
      const fuId = await nextPublicId(conn, 'FU', 'FU');
      const [fu] = await conn.query(
        `INSERT INTO followups (public_id, lead_id, assigned_employee_id, followup_date, followup_time, reason, notes, status, created_by)
         VALUES (?,?,?,?,?,?,?,'pending',?)`,
        [fuId, ins.insertId, assigned, b.next_followup_date, b.next_followup_time || null, 'Lead follow-up', b.notes || null, req.user.employee_id]
      );
      await conn.query('INSERT INTO lead_followups (lead_id, followup_id) VALUES (?,?)', [ins.insertId, fu.insertId]);
    }
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Lead Created',
      module: 'leads',
      recordId: publicId,
      description: b.customer_name,
    });
    return { id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Lead created successfully', created, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM leads WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Lead not found', 404);
  const l = rows[0];
  if (!isAdmin(req.user) && Number(l.assigned_employee_id) !== Number(req.user.employee_id)) {
    return fail(res, 'Forbidden', 403);
  }
  const b = req.body;
  await query(
    `UPDATE leads SET customer_name=?, mobile=?, interested_product=?, source=?, reason_not_purchasing=?,
      notes=?, next_followup_date=?, next_followup_time=?, status=?, assigned_employee_id=? WHERE id=?`,
    [
      b.customer_name ?? l.customer_name,
      b.mobile ?? l.mobile,
      b.interested_product ?? l.interested_product,
      b.source ?? l.source,
      b.reason_not_purchasing ?? l.reason_not_purchasing,
      b.notes ?? l.notes,
      b.next_followup_date ?? l.next_followup_date,
      b.next_followup_time ?? l.next_followup_time,
      b.status ?? l.status,
      b.assigned_employee_id ?? l.assigned_employee_id,
      l.id,
    ]
  );
  return success(res, 'Lead updated');
});

exports.convert = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM leads WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Lead not found', 404);
  const l = rows[0];
  if (l.converted_customer_id) {
    const existing = await query('SELECT public_id FROM customers WHERE id=?', [l.converted_customer_id]);
    return success(res, 'Lead already converted', { customer_id: l.converted_customer_id, public_id: existing[0]?.public_id });
  }
  const result = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'CUS', 'CUS');
    const [ins] = await conn.query(
      `INSERT INTO customers (public_id, name, mobile, assigned_employee_id, status, converted_from_lead_id, created_by)
       VALUES (?,?,?,?, 'active', ?, ?)`,
      [publicId, l.customer_name, l.mobile, l.assigned_employee_id, l.id, req.user.employee_id]
    );
    await conn.query('UPDATE leads SET status="converted", converted_customer_id=? WHERE id=?', [ins.insertId, l.id]);
    await conn.query('UPDATE followups SET customer_id=? WHERE lead_id=?', [ins.insertId, l.id]);
    await conn.query('UPDATE customer_notes SET customer_id=? WHERE lead_id=?', [ins.insertId, l.id]);
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Lead Converted',
      module: 'leads',
      recordId: l.public_id,
      description: `Converted to ${publicId}`,
    });
    return { customer_id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Lead converted to customer', result);
});
