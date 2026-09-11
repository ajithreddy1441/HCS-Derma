const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');

const confirmed = `order_status IN ('order_confirmed','processing','ready_to_dispatch','dispatched','in_transit','out_for_delivery','delivered')`;

exports.listTargets = asyncHandler(async (req, res) => {
  const items = await query(
    `SELECT t.*, e.name, e.public_id AS employee_code FROM employee_targets t JOIN employees e ON e.id=t.employee_id ORDER BY t.id DESC`
  );
  return success(res, 'OK', { items });
});

exports.createTarget = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.employee_id || !b.period_type || !b.period_start || !b.period_end) return fail(res, 'Missing target fields');
  await query(
    `INSERT INTO employee_targets (employee_id, period_type, period_start, period_end, sales_target, order_target,
      lead_conversion_target, followup_target, reorder_target, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      b.employee_id,
      b.period_type,
      b.period_start,
      b.period_end,
      b.sales_target || 0,
      b.order_target || 0,
      b.lead_conversion_target || 0,
      b.followup_target || 0,
      b.reorder_target || 0,
      req.user.employee_id,
    ]
  );
  return success(res, 'Target created', {}, 201);
});

exports.teamTargets = asyncHandler(async (_req, res) => {
  const teams = await query('SELECT * FROM team_targets ORDER BY id DESC');
  const out = [];
  for (const t of teams) {
    const members = await query(
      `SELECT e.id, e.name, e.public_id,
              COALESCE(SUM(CASE WHEN o.${confirmed.replace('order_status', 'order_status')} THEN o.total END),0) AS actual
       FROM team_target_members m
       JOIN employees e ON e.id=m.employee_id
       LEFT JOIN orders o ON o.telecaller_id=e.id AND o.order_date BETWEEN ? AND ?
       WHERE m.team_target_id=?
       GROUP BY e.id`,
      [t.period_start, t.period_end, t.id]
    );
    const actual = members.reduce((s, m) => s + Number(m.actual || 0), 0);
    const remaining = Number(t.sales_target) - actual;
    const pct = Number(t.sales_target) ? (actual / Number(t.sales_target)) * 100 : 0;
    const sorted = [...members].sort((a, b) => Number(b.actual) - Number(a.actual));
    out.push({
      ...t,
      actual,
      remaining,
      achievement_pct: Number(pct.toFixed(2)),
      members,
      best: sorted[0] || null,
      lowest: sorted[sorted.length - 1] || null,
    });
  }
  return success(res, 'OK', { items: out });
});

exports.createTeamTarget = asyncHandler(async (req, res) => {
  const b = req.body;
  await withTransaction(async (conn) => {
    const [ins] = await conn.query(
      `INSERT INTO team_targets (name, period_start, period_end, sales_target, created_by) VALUES (?,?,?,?,?)`,
      [b.name, b.period_start, b.period_end, b.sales_target || 0, req.user.employee_id]
    );
    for (const emp of b.employee_ids || []) {
      await conn.query('INSERT INTO team_target_members (team_target_id, employee_id) VALUES (?,?)', [ins.insertId, emp]);
    }
  });
  return success(res, 'Team target created', {}, 201);
});

exports.incentiveRules = asyncHandler(async (_req, res) => {
  const items = await query('SELECT * FROM incentive_rules ORDER BY min_pct');
  return success(res, 'OK', { items });
});

exports.saveIncentiveRules = asyncHandler(async (req, res) => {
  const rules = req.body.rules || [];
  await withTransaction(async (conn) => {
    await conn.query('DELETE FROM incentive_rules');
    for (const r of rules) {
      await conn.query(
        `INSERT INTO incentive_rules (min_pct, max_pct, label, incentive_amount, bonus_amount) VALUES (?,?,?,?,?)`,
        [r.min_pct, r.max_pct || null, r.label, r.incentive_amount || 0, r.bonus_amount || 0]
      );
    }
  });
  return success(res, 'Incentive rules saved');
});

exports.calculateIncentives = asyncHandler(async (req, res) => {
  const month = req.body.month || new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const rules = await query('SELECT * FROM incentive_rules ORDER BY min_pct');
  const emps = await query(
    `SELECT e.id, e.name,
            COALESCE(SUM(CASE WHEN o.${confirmed.replace('order_status', 'order_status')} THEN o.total END),0) AS actual,
            COALESCE((SELECT SUM(sales_target) FROM employee_targets t WHERE t.employee_id=e.id AND t.period_type='monthly' AND t.period_start<=? AND t.period_end>=?),0) AS target
     FROM employees e
     LEFT JOIN orders o ON o.telecaller_id=e.id AND DATE_FORMAT(o.order_date,'%Y-%m')=?
     GROUP BY e.id`,
    [start, start, month]
  );
  const saved = [];
  for (const e of emps) {
    const pct = Number(e.target) ? (Number(e.actual) / Number(e.target)) * 100 : 0;
    const rule = rules.find((r) => pct >= Number(r.min_pct) && (r.max_pct == null || pct <= Number(r.max_pct)));
    const incentive = rule ? Number(rule.incentive_amount) : 0;
    const bonus = rule ? Number(rule.bonus_amount) : 0;
    await query(
      `INSERT INTO employee_incentives (employee_id, month, achievement_pct, incentive, bonus)
       VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE achievement_pct=VALUES(achievement_pct), incentive=VALUES(incentive), bonus=VALUES(bonus)`,
      [e.id, month, pct.toFixed(2), incentive, bonus]
    );
    saved.push({ ...e, achievement_pct: Number(pct.toFixed(2)), incentive, bonus });
  }
  return success(res, 'Incentives calculated', { items: saved });
});

exports.listIncentives = asyncHandler(async (_req, res) => {
  const items = await query(
    `SELECT i.*, e.name, e.public_id FROM employee_incentives i JOIN employees e ON e.id=i.employee_id ORDER BY i.month DESC`
  );
  return success(res, 'OK', { items });
});

exports.listPayroll = asyncHandler(async (_req, res) => {
  const items = await query(
    `SELECT p.*, e.name, e.public_id AS employee_code, e.joining_date, r.name AS role_name
     FROM payroll p JOIN employees e ON e.id=p.employee_id JOIN roles r ON r.id=e.role_id ORDER BY p.id DESC`
  );
  return success(res, 'OK', { items });
});

exports.createPayroll = asyncHandler(async (req, res) => {
  const b = req.body;
  const emp = await query('SELECT * FROM employees WHERE id=? OR public_id=?', [b.employee_id, b.employee_id]);
  if (!emp.length) return fail(res, 'Employee not found', 404);
  const month = b.salary_month;
  const inc = await query('SELECT * FROM employee_incentives WHERE employee_id=? AND month=?', [emp[0].id, month]);
  const incentive = Number(b.incentive != null ? b.incentive : inc[0]?.incentive || 0);
  const bonus = Number(b.bonus != null ? b.bonus : inc[0]?.bonus || 0);
  const basic = Number(b.basic_salary || 0);
  const commission = Number(b.commission || 0);
  const deductions = Number(b.deductions || 0);
  const advance = Number(b.advance || 0);
  const net = basic + incentive + commission + bonus - deductions - advance;
  const created = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'PAYROLL', 'PAYR');
    const [ins] = await conn.query(
      `INSERT INTO payroll (public_id, employee_id, salary_month, basic_salary, incentive, commission, bonus, deductions, advance, net_salary, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,'pending')`,
      [publicId, emp[0].id, month, basic, incentive, commission, bonus, deductions, advance, net]
    );
    return { id: ins.insertId, public_id: publicId, net_salary: net };
  });
  return success(res, 'Payroll created', created, 201);
});

exports.updatePayroll = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM payroll WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Payroll not found', 404);
  const b = req.body;
  await query(
    `UPDATE payroll SET payment_status=?, payment_date=?, payment_reference=? WHERE id=?`,
    [b.payment_status || rows[0].payment_status, b.payment_date || rows[0].payment_date, b.payment_reference || rows[0].payment_reference, rows[0].id]
  );
  return success(res, 'Payroll updated');
});

exports.performance = asyncHandler(async (req, res) => {
  const df = req.query.from && req.query.to ? [req.query.from, req.query.to] : null;
  const items = await query(
    `SELECT e.id, e.name, e.public_id,
      (SELECT COUNT(*) FROM leads l WHERE l.assigned_employee_id=e.id ${df ? 'AND l.created_at BETWEEN ? AND ?' : ''}) AS leads,
      (SELECT COUNT(*) FROM followups f WHERE f.assigned_employee_id=e.id ${df ? 'AND f.created_at BETWEEN ? AND ?' : ''}) AS followups,
      (SELECT COUNT(*) FROM leads l WHERE l.assigned_employee_id=e.id AND l.status='converted' ${df ? 'AND l.updated_at BETWEEN ? AND ?' : ''}) AS converted,
      (SELECT COUNT(*) FROM orders o WHERE o.telecaller_id=e.id ${df ? 'AND o.order_date BETWEEN ? AND ?' : ''}) AS orders,
      (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.telecaller_id=e.id AND ${confirmed.replace('order_status', 'o.order_status')} ${df ? 'AND o.order_date BETWEEN ? AND ?' : ''}) AS sales,
      (SELECT COUNT(*) FROM orders o WHERE o.telecaller_id=e.id AND o.order_status='cancelled' ${df ? 'AND o.order_date BETWEEN ? AND ?' : ''}) AS cancelled,
      (SELECT COUNT(*) FROM orders o WHERE o.telecaller_id=e.id AND o.order_status='returned' ${df ? 'AND o.order_date BETWEEN ? AND ?' : ''}) AS returned_orders,
      (SELECT COUNT(*) FROM reorders r WHERE r.assigned_employee_id=e.id AND r.status='converted') AS reorders
     FROM employees e JOIN roles r ON r.id=e.role_id WHERE r.slug IN ('telecaller','admin')
     ${req.query.employee_id ? 'AND e.id=?' : ''}`,
    [
      ...(df ? [...df, ...df, ...df, ...df, ...df, ...df, ...df] : []),
      ...(req.query.employee_id ? [req.query.employee_id] : []),
    ]
  );
  const withAov = items.map((i) => ({
    ...i,
    aov: Number(i.orders) ? Number(i.sales) / Number(i.orders) : 0,
  }));
  return success(res, 'OK', { items: withAov });
});
