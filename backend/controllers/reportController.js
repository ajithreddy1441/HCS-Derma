const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { dateFilter } = require('../utils/scope');
const ExcelJS = require('exceljs');

const confirmed = `o.order_status IN ('order_confirmed','processing','ready_to_dispatch','dispatched','in_transit','out_for_delivery','delivered')`;

function extraFilters(req) {
  const parts = [];
  const params = [];
  if (req.query.employee_id) {
    parts.push(' AND o.telecaller_id=?');
    params.push(req.query.employee_id);
  }
  if (req.query.customer_id) {
    parts.push(' AND o.customer_id=?');
    params.push(req.query.customer_id);
  }
  if (req.query.status) {
    parts.push(' AND o.order_status=?');
    params.push(req.query.status);
  }
  if (req.query.payment_status) {
    parts.push(' AND o.payment_status=?');
    params.push(req.query.payment_status);
  }
  return { sql: parts.join(''), params };
}

exports.run = asyncHandler(async (req, res) => {
  const type = req.params.type;
  const df = dateFilter(req.query, type === 'customers' || type === 'leads' ? 'created_at' : 'o.order_date');
  const f = extraFilters(req);
  let sql;
  if (type === 'sales' || type === 'orders') {
    sql = `SELECT o.*, c.name AS customer_name, e.name AS employee_name
           FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN employees e ON e.id=o.telecaller_id
           WHERE 1=1 ${type === 'sales' ? ` AND ${confirmed}` : ''} ${df.sql} ${f.sql} ORDER BY o.id DESC LIMIT 2000`;
  } else if (type === 'payments' || type === 'payment-mismatch') {
    const mismatch = type === 'payment-mismatch' ? " AND p.status='payment_mismatch'" : '';
    sql = `SELECT p.*, o.public_id AS order_code, c.name AS customer_name
           FROM payments p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=p.customer_id
           WHERE 1=1 ${mismatch} ${dateFilter(req.query, 'p.created_at').sql} ORDER BY p.id DESC LIMIT 2000`;
  } else if (type === 'customers') {
    sql = `SELECT * FROM customers WHERE 1=1 ${dateFilter(req.query, 'created_at').sql} ORDER BY id DESC LIMIT 2000`;
  } else if (type === 'leads') {
    sql = `SELECT * FROM leads WHERE 1=1 ${dateFilter(req.query, 'created_at').sql} ORDER BY id DESC LIMIT 2000`;
  } else if (type === 'followups') {
    sql = `SELECT * FROM followups WHERE 1=1 ${dateFilter(req.query, 'created_at').sql} ORDER BY id DESC LIMIT 2000`;
  } else if (type === 'inventory' || type === 'low-stock') {
    sql = `SELECT p.name, p.public_id, p.sku, inv.* FROM inventory inv JOIN products p ON p.id=inv.product_id
           ${type === 'low-stock' ? 'WHERE inv.available_quantity<=inv.low_stock_level' : ''} ORDER BY p.name`;
  } else if (type === 'delivery') {
    sql = `SELECT s.*, o.public_id AS order_code, c.name AS customer_name
           FROM shipments s JOIN orders o ON o.id=s.order_id JOIN customers c ON c.id=o.customer_id
           ORDER BY s.id DESC LIMIT 2000`;
  } else if (type === 'returns') {
    sql = `SELECT r.*, o.public_id AS order_code FROM returns r JOIN orders o ON o.id=r.order_id ORDER BY r.id DESC LIMIT 2000`;
  } else if (type === 'reorders') {
    sql = `SELECT * FROM reorders ORDER BY due_date LIMIT 2000`;
  } else if (type === 'employees') {
    sql = `SELECT e.*, r.name AS role_name FROM employees e JOIN roles r ON r.id=e.role_id`;
  } else if (type === 'targets' || type === 'performance') {
    sql = `SELECT e.name, e.public_id,
              COALESCE(SUM(CASE WHEN ${confirmed} THEN o.total END),0) AS sales,
              COUNT(o.id) AS orders
           FROM employees e LEFT JOIN orders o ON o.telecaller_id=e.id
           GROUP BY e.id`;
  } else if (type === 'payroll') {
    sql = `SELECT p.*, e.name, e.public_id FROM payroll p JOIN employees e ON e.id=p.employee_id ORDER BY p.id DESC`;
  } else {
    sql = `SELECT o.*, c.name AS customer_name FROM orders o JOIN customers c ON c.id=o.customer_id WHERE 1=1 ${df.sql} ${f.sql} LIMIT 2000`;
  }
  const params = type === 'sales' || type === 'orders' ? [...df.params, ...f.params] : dateFilter(req.query, 'created_at').params;
  const items = await query(sql, params);
  if (req.query.export === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}.csv`);
    if (!items.length) return res.send('');
    const headers = Object.keys(items[0]);
    const lines = [headers.join(','), ...items.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','))];
    return res.send(lines.join('\n'));
  }
  if (req.query.export === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    if (items.length) {
      ws.columns = Object.keys(items[0]).map((k) => ({ header: k, key: k, width: 18 }));
      items.forEach((i) => ws.addRow(i));
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}.xlsx`);
    await wb.xlsx.write(res);
    return res.end();
  }
  return success(res, 'OK', { items });
});
