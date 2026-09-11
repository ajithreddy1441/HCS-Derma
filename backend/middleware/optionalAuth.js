const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');

async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
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
    if (users.length && users[0].status === 'active') req.user = users[0];
  } catch {
    /* public scan still allowed */
  }
  next();
}

module.exports = { optionalAuth };
