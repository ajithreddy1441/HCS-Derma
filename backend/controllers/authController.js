const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/db');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const AppError = require('../utils/AppError');
const { logActivity } = require('../services/auditService');

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return fail(res, 'Username and password are required');
  const users = await query(
    `SELECT u.*, r.slug AS role FROM users u JOIN roles r ON r.id = u.role_id
     WHERE (u.username = ? OR u.email = ?) LIMIT 1`,
    [username, username]
  );
  if (!users.length) return fail(res, 'Invalid credentials', 401);
  const user = users[0];
  if (user.status !== 'active') return fail(res, 'Account is inactive', 403);
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return fail(res, 'Invalid credentials', 401);
  await query('UPDATE users SET last_login_at = NOW() WHERE id=?', [user.id]);
  const token = jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  await logActivity(null, {
    employeeId: user.employee_id,
    action: 'Login',
    module: 'auth',
    recordId: user.id,
    description: 'User logged in',
  });
  return success(res, 'Logged in', { token, role: user.role });
});

exports.logout = asyncHandler(async (req, res) => {
  await logActivity(null, {
    employeeId: req.user.employee_id,
    action: 'Logout',
    module: 'auth',
    recordId: req.user.id,
    description: 'User logged out',
  });
  return success(res, 'Logged out');
});

exports.me = asyncHandler(async (req, res) => {
  return success(res, 'OK', { user: req.user });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const users = await query('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
  if (users.length) {
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000);
    await query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,?)', [users[0].id, token, expires]);
    return success(res, 'If the account exists, a reset token was created', { token, note: 'In production send this by email' });
  }
  return success(res, 'If the account exists, a reset token was created');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return fail(res, 'Token and password are required');
  const rows = await query(
    'SELECT * FROM password_resets WHERE token=? AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
    [token]
  );
  if (!rows.length) throw new AppError('Invalid or expired token', 400);
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash=? WHERE id=?', [hash, rows[0].user_id]);
  await query('UPDATE password_resets SET used_at=NOW() WHERE id=?', [rows[0].id]);
  return success(res, 'Password updated');
});
