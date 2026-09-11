const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination } = require('../utils/scope');
const { logActivity, logAudit } = require('../services/auditService');

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const q = `%${req.query.q || ''}%`;
  const rows = await query(
    `SELECT e.*, r.name AS role_name, r.slug AS role, u.username, u.email AS login_email
     FROM employees e
     JOIN roles r ON r.id = e.role_id
     LEFT JOIN users u ON u.employee_id = e.id
     WHERE e.name LIKE ? OR e.public_id LIKE ? OR e.mobile LIKE ? OR e.email LIKE ?
     ORDER BY e.id DESC LIMIT ? OFFSET ?`,
    [q, q, q, q, limit, offset]
  );
  const total = await query(
    `SELECT COUNT(*) AS c FROM employees e WHERE e.name LIKE ? OR e.public_id LIKE ? OR e.mobile LIKE ?`,
    [q, q, q]
  );
  return success(res, 'OK', { items: rows, page, total: total[0].c });
});

exports.get = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT e.*, r.name AS role_name, r.slug AS role, u.username
     FROM employees e JOIN roles r ON r.id = e.role_id
     LEFT JOIN users u ON u.employee_id = e.id WHERE e.id=? OR e.public_id=?`,
    [req.params.id, req.params.id]
  );
  if (!rows.length) return fail(res, 'Employee not found', 404);
  return success(res, 'OK', rows[0]);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, mobile, email, role, username, password, joining_date } = req.body;
  if (!name || !mobile || !email || !role || !username || !password) {
    return fail(res, 'Missing required employee fields');
  }
  const created = await withTransaction(async (conn) => {
    const [roles] = await conn.query('SELECT id FROM roles WHERE slug=?', [role]);
    if (!roles.length) throw Object.assign(new Error('Invalid role'), { status: 400 });
    const publicId = await nextPublicId(conn, 'EMP', 'EMP');
    const [ins] = await conn.query(
      `INSERT INTO employees (public_id, name, mobile, email, role_id, joining_date, status, created_by)
       VALUES (?,?,?,?,?,?, 'active', ?)`,
      [publicId, name, mobile, email, roles[0].id, joining_date || null, req.user.employee_id]
    );
    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO users (employee_id, username, email, password_hash, role_id, status)
       VALUES (?,?,?,?,?, 'active')`,
      [ins.insertId, username, email, hash, roles[0].id]
    );
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Employee Created',
      module: 'employees',
      recordId: publicId,
      description: name,
    });
    return { id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Employee created successfully', created, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const emp = await query('SELECT * FROM employees WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!emp.length) return fail(res, 'Employee not found', 404);
  const current = emp[0];
  const { name, mobile, email, role, joining_date, status } = req.body;
  await withTransaction(async (conn) => {
    let roleId = current.role_id;
    if (role) {
      const [roles] = await conn.query('SELECT id FROM roles WHERE slug=?', [role]);
      if (!roles.length) throw Object.assign(new Error('Invalid role'), { status: 400 });
      roleId = roles[0].id;
    }
    await conn.query(
      `UPDATE employees SET name=?, mobile=?, email=?, role_id=?, joining_date=?, status=? WHERE id=?`,
      [name ?? current.name, mobile ?? current.mobile, email ?? current.email, roleId, joining_date ?? current.joining_date, status ?? current.status, current.id]
    );
    await conn.query('UPDATE users SET role_id=?, email=?, status=? WHERE employee_id=?', [
      roleId,
      email ?? current.email,
      status ?? current.status,
      current.id,
    ]);
    const fields = ['name', 'mobile', 'email', 'status'];
    for (const f of fields) {
      if (req.body[f] != null && String(req.body[f]) !== String(current[f])) {
        await logAudit(conn, {
          employeeId: req.user.employee_id,
          module: 'employees',
          recordId: current.public_id,
          field: f,
          oldValue: current[f],
          newValue: req.body[f],
          action: 'update',
        });
      }
    }
  });
  return success(res, 'Employee updated');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const emp = await query('SELECT * FROM employees WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!emp.length) return fail(res, 'Employee not found', 404);
  const password = req.body.password || 'Reset@123';
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash=? WHERE employee_id=?', [hash, emp[0].id]);
  return success(res, 'Password reset', { temporaryPassword: password });
});

exports.roles = asyncHandler(async (_req, res) => {
  const roles = await query('SELECT * FROM roles');
  const perms = await query('SELECT * FROM permissions ORDER BY module, slug');
  const map = await query('SELECT * FROM role_permissions');
  return success(res, 'OK', { roles, permissions: perms, role_permissions: map });
});

exports.setPermissions = asyncHandler(async (req, res) => {
  const { roleId, permissionIds } = req.body;
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM role_permissions WHERE role_id=?', [roleId]);
    for (const pid of permissionIds || []) {
      await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)', [roleId, pid]);
    }
  });
  return success(res, 'Permissions updated');
});
