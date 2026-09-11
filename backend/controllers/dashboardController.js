const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { isAdmin } = require('../utils/scope');

const confirmed = `order_status IN ('order_confirmed','processing','ready_to_dispatch','dispatched','in_transit','out_for_delivery','delivered')`;

exports.admin = asyncHandler(async (_req, res) => {
  const [c] = await query(`SELECT
    (SELECT COUNT(*) FROM leads WHERE DATE(created_at)=CURDATE()) AS new_leads,
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at)=CURDATE()) AS new_customers,
    (SELECT COUNT(*) FROM orders WHERE DATE(order_date)=CURDATE()) AS new_orders,
    (SELECT COUNT(*) FROM payments WHERE status IN ('pending','under_verification')) AS pending_payments,
    (SELECT COUNT(*) FROM payments WHERE status='approved') AS approved_payments,
    (SELECT COUNT(*) FROM payments WHERE status='rejected') AS rejected_payments,
    (SELECT COUNT(*) FROM payments WHERE status='payment_mismatch') AS payment_mismatch,
    (SELECT COUNT(*) FROM orders WHERE order_status='processing') AS processing_orders,
    (SELECT COUNT(*) FROM orders WHERE order_status='dispatched') AS dispatched_orders,
    (SELECT COUNT(*) FROM orders WHERE order_status='in_transit') AS in_transit,
    (SELECT COUNT(*) FROM orders WHERE order_status='delivered') AS delivered_orders,
    (SELECT COUNT(*) FROM orders WHERE order_status='cancelled') AS cancelled_orders,
    (SELECT COUNT(*) FROM orders WHERE order_status='returned') AS returned_orders,
    (SELECT COUNT(*) FROM followups WHERE followup_date=CURDATE() AND status='pending') AS todays_followups,
    (SELECT COUNT(*) FROM followups WHERE followup_date<CURDATE() AND status='pending') AS overdue_followups,
    (SELECT COUNT(*) FROM reorders WHERE status='due') AS reorder_followups,
    (SELECT COUNT(*) FROM inventory WHERE available_quantity>0 AND available_quantity<=low_stock_level) AS low_stock,
    (SELECT COUNT(*) FROM inventory WHERE available_quantity<=0) AS out_of_stock
  `);
  const sales = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN DATE(order_date)=CURDATE() THEN total END),0) AS today,
      COALESCE(SUM(CASE WHEN YEARWEEK(order_date,1)=YEARWEEK(CURDATE(),1) THEN total END),0) AS week,
      COALESCE(SUM(CASE WHEN YEAR(order_date)=YEAR(CURDATE()) AND MONTH(order_date)=MONTH(CURDATE()) THEN total END),0) AS month,
      COALESCE(SUM(CASE WHEN YEAR(order_date)=YEAR(CURDATE()) THEN total END),0) AS year,
      COALESCE(SUM(total),0) AS total,
      COUNT(*) AS orders,
      COALESCE(AVG(total),0) AS aov
     FROM orders WHERE ${confirmed}`
  );
  const daily = await query(
    `SELECT DATE(order_date) AS d, SUM(total) AS sales, COUNT(*) AS orders
     FROM orders WHERE ${confirmed} AND order_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
     GROUP BY DATE(order_date) ORDER BY d`
  );
  const monthly = await query(
    `SELECT DATE_FORMAT(order_date,'%Y-%m') AS m, SUM(total) AS sales
     FROM orders WHERE ${confirmed} AND order_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(order_date,'%Y-%m') ORDER BY m`
  );
  const orderStatus = await query(`SELECT order_status AS name, COUNT(*) AS value FROM orders GROUP BY order_status`);
  const paymentStatus = await query(`SELECT status AS name, COUNT(*) AS value FROM payments GROUP BY status`);
  const topProducts = await query(
    `SELECT p.name, SUM(oi.quantity) AS qty, SUM(oi.total) AS sales
     FROM order_items oi JOIN products p ON p.id=oi.product_id
     JOIN orders o ON o.id=oi.order_id WHERE ${confirmed}
     GROUP BY p.id ORDER BY sales DESC LIMIT 8`
  );
  const growth = await query(
    `SELECT DATE_FORMAT(created_at,'%Y-%m') AS m, COUNT(*) AS customers
     FROM customers GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY m DESC LIMIT 12`
  );
  const performance = await query(
    `SELECT e.name, COALESCE(SUM(o.total),0) AS sales, COUNT(o.id) AS orders
     FROM employees e
     LEFT JOIN orders o ON o.telecaller_id=e.id AND ${confirmed.replace(/order_status/g, 'o.order_status')}
     JOIN roles r ON r.id=e.role_id WHERE r.slug='telecaller'
     GROUP BY e.id ORDER BY sales DESC LIMIT 10`
  );
  const inventory = await query(
    `SELECT CASE WHEN available_quantity<=0 THEN 'Out of stock'
                 WHEN available_quantity<=low_stock_level THEN 'Low stock'
                 ELSE 'In stock' END AS name, COUNT(*) AS value
     FROM inventory GROUP BY name`
  );
  const overdueList = await query(
    `SELECT f.public_id, f.followup_date, f.reason, COALESCE(c.name, l.customer_name) AS party_name,
            COALESCE(c.mobile, l.mobile) AS mobile, e.name AS telecaller_name, e.public_id AS employee_code
     FROM followups f
     LEFT JOIN customers c ON c.id=f.customer_id
     LEFT JOIN leads l ON l.id=f.lead_id
     LEFT JOIN employees e ON e.id=f.assigned_employee_id
     WHERE f.status='pending' AND f.followup_date < CURDATE()
     ORDER BY f.followup_date LIMIT 30`
  );
  return success(res, 'OK', {
    cards: c,
    sales: sales[0],
    overdue: overdueList,
    charts: { daily, monthly, orderStatus, paymentStatus, topProducts, growth, performance, inventory },
  });
});

exports.telecaller = asyncHandler(async (req, res) => {
  const id = req.user.employee_id;
  const [c] = await query(
    `SELECT
      (SELECT COUNT(*) FROM followups WHERE assigned_employee_id=? AND followup_date=CURDATE() AND status='pending') AS todays_followups,
      (SELECT COUNT(*) FROM followups WHERE assigned_employee_id=? AND followup_date<CURDATE() AND status='pending') AS overdue_followups,
      (SELECT COUNT(*) FROM followups WHERE assigned_employee_id=? AND followup_date>CURDATE() AND status='pending') AS upcoming_followups,
      (SELECT COUNT(*) FROM leads WHERE assigned_employee_id=? AND status='new') AS new_leads,
      (SELECT COUNT(*) FROM customers WHERE assigned_employee_id=?) AS my_customers,
      (SELECT COUNT(*) FROM orders WHERE telecaller_id=?) AS my_orders,
      (SELECT COUNT(*) FROM orders WHERE telecaller_id=? AND payment_status IN ('pending','under_verification')) AS payment_pending,
      (SELECT COUNT(*) FROM orders WHERE telecaller_id=? AND payment_status='approved') AS payment_approved,
      (SELECT COUNT(*) FROM orders WHERE telecaller_id=? AND ${confirmed}) AS approved_orders,
      (SELECT COUNT(*) FROM reorders WHERE assigned_employee_id=? AND status='due') AS reorder_customers
    `,
    [id, id, id, id, id, id, id, id, id, id]
  );
  const overdue = await query(
    `SELECT f.*, COALESCE(c.name, l.customer_name) AS party_name, COALESCE(c.mobile, l.mobile) AS mobile
     FROM followups f
     LEFT JOIN customers c ON c.id=f.customer_id
     LEFT JOIN leads l ON l.id=f.lead_id
     WHERE f.assigned_employee_id=? AND f.status='pending' AND f.followup_date < CURDATE()
     ORDER BY f.followup_date`,
    [id]
  );
  return success(res, 'OK', { cards: c, overdue });
});

exports.accountant = asyncHandler(async (_req, res) => {
  const [c] = await query(`SELECT
    (SELECT COUNT(*) FROM payments WHERE DATE(created_at)=CURDATE()) AS todays_payments,
    (SELECT COUNT(*) FROM payments WHERE status IN ('pending','under_verification')) AS pending_verification,
    (SELECT COUNT(*) FROM payments WHERE status='approved') AS approved_payments,
    (SELECT COUNT(*) FROM payments WHERE status='rejected') AS rejected_payments,
    (SELECT COUNT(*) FROM payments WHERE status='payment_mismatch') AS payment_mismatch,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='approved') AS total_collection,
    (SELECT COUNT(*) FROM orders WHERE ${confirmed}) AS confirmed_orders,
    (SELECT COUNT(*) FROM orders WHERE order_status='cancelled') AS cancelled_orders,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='refunded') AS refunds
  `);
  const modes = await query(
    `SELECT payment_mode AS name, COALESCE(SUM(amount),0) AS value FROM payments WHERE status='approved' GROUP BY payment_mode`
  );
  const issues = await query(
    `SELECT s.*, p.name AS product_name, o.public_id AS order_code
     FROM scan_issues s
     LEFT JOIN products p ON p.id=s.product_id
     LEFT JOIN orders o ON o.id=s.order_id
     ORDER BY s.id DESC LIMIT 20`
  ).catch(() => []);
  return success(res, 'OK', { cards: c, modes, scan_issues: issues });
});

exports.myTarget = asyncHandler(async (req, res) => {
  const id = isAdmin(req.user) && req.query.employee_id ? req.query.employee_id : req.user.employee_id;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const targets = await query(
    `SELECT * FROM employee_targets WHERE employee_id=? AND period_start<=? AND period_end>=? ORDER BY period_type`,
    [id, today, today]
  );
  const [actuals] = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN DATE(order_date)=CURDATE() THEN total END),0) AS sales_today,
      COALESCE(SUM(CASE WHEN order_date>=? THEN total END),0) AS sales_month,
      SUM(DATE(order_date)=CURDATE()) AS orders_today,
      SUM(order_date>=?) AS orders_month
     FROM orders WHERE telecaller_id=? AND ${confirmed}`,
    [monthStart, monthStart, id]
  );
  const [fu] = await query(
    `SELECT SUM(status!='pending' AND DATE(updated_at)=CURDATE()) AS followups_today FROM followups WHERE assigned_employee_id=?`,
    [id]
  );
  const [reo] = await query(
    `SELECT SUM(status='converted') AS reorders FROM reorders WHERE assigned_employee_id=? AND DATE(created_at)>=?`,
    [id, monthStart]
  );
  return success(res, 'OK', { targets, actuals, followups: fu, reorders: reo });
});
