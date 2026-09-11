const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { fail } = require('../utils/response');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Unauthorized', 401);
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const users = await query(
      `SELECT u.id, u.employee_id, u.username, u.email, u.status, u.role_id,
              r.slug AS role, e.public_id AS employee_code, e.name AS employee_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN employees e ON e.id = u.employee_id
       WHERE u.id = ? LIMIT 1`,
      [payload.userId]
    );
    if (!users.length || users[0].status !== 'active') return fail(res, 'Unauthorized', 401);
    const perms = await query(
      `SELECT p.slug FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [users[0].role_id]
    );
    req.user = { ...users[0], permissions: perms.map((p) => p.slug) };
    next();
  } catch {
    return fail(res, 'Unauthorized', 401);
  }
}

function authorize(...slugs) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Unauthorized', 401);
    if (req.user.role === 'admin') return next();
    const ok = slugs.some((s) => req.user.permissions.includes(s));
    if (!ok) return fail(res, 'Forbidden', 403);
    next();
  };
}

function rolesOnly(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Unauthorized', 401);
    if (!roles.includes(req.user.role)) return fail(res, 'Forbidden', 403);
    next();
  };
}

module.exports = { authenticate, authorize, rolesOnly };
