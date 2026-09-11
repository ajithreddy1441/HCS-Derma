const { query } = require('../config/db');

async function logActivity(connOrNull, { employeeId, action, module, recordId, description }) {
  const sql = `INSERT INTO activity_logs (employee_id, action, module, record_id, description) VALUES (?,?,?,?,?)`;
  const params = [employeeId || null, action, module, recordId ? String(recordId) : null, description || null];
  if (connOrNull) await connOrNull.query(sql, params);
  else await query(sql, params);
}

async function logAudit(connOrNull, { employeeId, module, recordId, field, oldValue, newValue, action }) {
  const sql = `INSERT INTO audit_logs (employee_id, module, record_id, field_changed, old_value, new_value, action)
               VALUES (?,?,?,?,?,?,?)`;
  const params = [
    employeeId || null,
    module,
    String(recordId),
    field,
    oldValue == null ? null : String(oldValue),
    newValue == null ? null : String(newValue),
    action,
  ];
  if (connOrNull) await connOrNull.query(sql, params);
  else await query(sql, params);
}

async function notify(connOrNull, { employeeId, title, body, type, refModule, refId }) {
  const sql = `INSERT INTO notifications (employee_id, title, body, type, ref_module, ref_id) VALUES (?,?,?,?,?,?)`;
  const params = [employeeId || null, title, body, type, refModule || null, refId || null];
  if (connOrNull) await connOrNull.query(sql, params);
  else await query(sql, params);
}

async function notifyRole(conn, roleSlug, payload) {
  const [rows] = await conn.query(
    `SELECT e.id FROM employees e JOIN roles r ON r.id = e.role_id WHERE r.slug = ? AND e.status='active'`,
    [roleSlug]
  );
  for (const row of rows) {
    await notify(conn, { ...payload, employeeId: row.id });
  }
}

module.exports = { logActivity, logAudit, notify, notifyRole };
