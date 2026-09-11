const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { isAdmin } = require('../utils/scope');
const { notify, notifyRole } = require('../services/auditService');

function scopeSql(req, alias = 'f') {
  if (isAdmin(req.user) || req.user.role === 'accountant') return { sql: '', params: [] };
  return { sql: ` AND ${alias}.assigned_employee_id = ?`, params: [req.user.employee_id] };
}

exports.list = asyncHandler(async (req, res) => {
  const sc = scopeSql(req);
  const today = new Date().toISOString().slice(0, 10);
  const section = req.query.section || 'today';
  let extra = '';
  const params = [...sc.params];
  if (section === 'today') extra = ' AND f.followup_date = ? AND f.status="pending"';
  else if (section === 'upcoming') extra = ' AND f.followup_date > ? AND f.status="pending"';
  else if (section === 'overdue') extra = ' AND f.followup_date < ? AND f.status="pending"';
  else extra = ' AND f.status != "pending"';
  if (section !== 'completed') params.push(today);
  const items = await query(
    `SELECT f.*, e.name AS telecaller_name, e.public_id AS employee_code,
            COALESCE(c.name, l.customer_name) AS party_name,
            COALESCE(c.mobile, l.mobile) AS mobile,
            c.public_id AS customer_code, l.public_id AS lead_code
     FROM followups f
     LEFT JOIN employees e ON e.id = f.assigned_employee_id
     LEFT JOIN customers c ON c.id = f.customer_id
     LEFT JOIN leads l ON l.id = f.lead_id
     WHERE 1=1 ${sc.sql} ${extra}
     ORDER BY f.followup_date, f.followup_time`,
    params
  );
  return success(res, 'OK', { items });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.followup_date) return fail(res, 'Follow-up date is required');
  const created = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'FU', 'FU');
    const assigned = b.assigned_employee_id || req.user.employee_id;
    const [ins] = await conn.query(
      `INSERT INTO followups (public_id, lead_id, customer_id, assigned_employee_id, followup_date, followup_time,
        reason, previous_conversation, notes, next_action, next_followup_date, next_followup_time, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`,
      [
        publicId,
        b.lead_id || null,
        b.customer_id || null,
        assigned,
        b.followup_date,
        b.followup_time || null,
        b.reason || null,
        b.previous_conversation || null,
        b.notes || null,
        b.next_action || null,
        b.next_followup_date || null,
        b.next_followup_time || null,
        req.user.employee_id,
      ]
    );
    if (b.lead_id) await conn.query('INSERT INTO lead_followups (lead_id, followup_id) VALUES (?,?)', [b.lead_id, ins.insertId]);
    return { id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Follow-up created', created, 201);
});

exports.complete = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM followups WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Follow-up not found', 404);
  const f = rows[0];
  const b = req.body;
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE followups SET status=?, notes=?, previous_conversation=?, next_action=?, next_followup_date=?, next_followup_time=? WHERE id=?`,
      [
        b.status || 'completed',
        b.notes ?? f.notes,
        b.previous_conversation ?? f.previous_conversation,
        b.next_action ?? f.next_action,
        b.next_followup_date || null,
        b.next_followup_time || null,
        f.id,
      ]
    );
    if (b.next_followup_date) {
      const publicId = await nextPublicId(conn, 'FU', 'FU');
      await conn.query(
        `INSERT INTO followups (public_id, lead_id, customer_id, assigned_employee_id, followup_date, followup_time,
          reason, previous_conversation, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,'pending',?)`,
        [
          publicId,
          f.lead_id,
          f.customer_id,
          f.assigned_employee_id,
          b.next_followup_date,
          b.next_followup_time || null,
          b.next_action || 'Next follow-up',
          b.previous_conversation || b.notes,
          req.user.employee_id,
        ]
      );
    }
  });
  return success(res, 'Follow-up updated');
});

exports.alertAdmin = asyncHandler(async (req, res) => {
  const { isAdmin } = require('../utils/scope');
  const extra = isAdmin(req.user) ? '' : ' AND assigned_employee_id=?';
  const params = isAdmin(req.user) ? [] : [req.user.employee_id];
  const items = await query(
    `SELECT f.*, COALESCE(c.name, l.customer_name) AS party_name, COALESCE(c.mobile, l.mobile) AS mobile,
            e.name AS telecaller_name, e.public_id AS employee_code
     FROM followups f
     LEFT JOIN customers c ON c.id = f.customer_id
     LEFT JOIN leads l ON l.id = f.lead_id
     LEFT JOIN employees e ON e.id = f.assigned_employee_id
     WHERE f.status='pending' AND f.followup_date < CURDATE() ${extra}
     ORDER BY f.followup_date`,
    params
  );
  const { withTransaction } = require('../config/db');
  await withTransaction(async (conn) => {
    const body = items.length
      ? items.map((i) => `${i.party_name} (${i.mobile}) due ${i.followup_date} — ${i.telecaller_name}`).join('; ')
      : 'No overdue follow-ups';
    await notifyRole(conn, 'admin', {
      title: `Overdue follow-ups (${items.length})`,
      body,
      type: 'overdue_followup',
    });
  });
  return success(res, 'Overdue details sent to admin', { count: items.length, items });
});

exports.reminders = asyncHandler(async (_req, res) => {
  const overdue = await query(
    `SELECT assigned_employee_id, COUNT(*) AS c FROM followups WHERE status='pending' AND followup_date < CURDATE() GROUP BY assigned_employee_id`
  );
  for (const row of overdue) {
    await notify(null, {
      employeeId: row.assigned_employee_id,
      title: 'Overdue Follow-up',
      body: `${row.c} follow-up(s) are overdue`,
      type: 'overdue_followup',
    });
  }
  return success(res, 'Reminders processed');
});
