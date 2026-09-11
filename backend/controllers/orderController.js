const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination, isAdmin, dateFilter } = require('../utils/scope');
const { logActivity } = require('../services/auditService');
const { changeStock } = require('../services/inventoryService');

function scope(req) {
  if (isAdmin(req.user) || req.user.role === 'accountant') return { sql: '', params: [] };
  return { sql: ' AND o.telecaller_id = ?', params: [req.user.employee_id] };
}

async function hydrate(orderId) {
  const orders = await query(
    `SELECT o.*, c.name AS customer_name, c.public_id AS customer_code, c.mobile, c.email AS customer_email, c.store_name,
            COALESCE(o.shipping_address, c.address) AS address,
            COALESCE(o.shipping_city, c.city) AS city,
            COALESCE(o.shipping_state, c.state) AS state,
            COALESCE(o.shipping_pincode, c.pincode) AS pincode,
            e.name AS telecaller_name, e.public_id AS employee_code
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN employees e ON e.id = o.telecaller_id
     WHERE o.id=?`,
    [orderId]
  );
  if (!orders.length) return null;
  const items = await query(
    `SELECT oi.*, p.name AS product_name, p.public_id AS product_code, p.image_path
     FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id=?`,
    [orderId]
  );
  const payments = await query('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC', [orderId]);
  const shipment = await query('SELECT * FROM shipments WHERE order_id=?', [orderId]);
  const tracking = shipment.length
    ? await query('SELECT * FROM tracking_history WHERE shipment_id=? ORDER BY id DESC', [shipment[0].id])
    : [];
  const activity = await query(
    `SELECT a.*, e.name AS employee_name, e.public_id AS employee_code
     FROM activity_logs a LEFT JOIN employees e ON e.id=a.employee_id
     WHERE (a.module IN ('orders','payments','shipments') AND a.record_id IN (?,?))
     ORDER BY a.id ASC`,
    [orders[0].public_id, String(orderId)]
  );
  const qrs = await query(
    'SELECT public_id, token, qr_number, qr_type, status, packed_status, scan_note FROM qr_codes WHERE order_id=? ORDER BY qr_number',
    [orderId]
  );
  return {
    order: orders[0],
    items,
    payments,
    shipment: shipment[0] || null,
    tracking,
    activity,
    qrs,
  };
}

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const sc = scope(req);
  const df = dateFilter(req.query, 'o.order_date');
  const q = `%${req.query.q || ''}%`;
  let extra = ' AND (o.public_id LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)';
  const params = [...sc.params, ...df.params, q, q, q];
  if (req.query.status) {
    extra += ' AND o.order_status=?';
    params.push(req.query.status);
  }
  const items = await query(
    `SELECT o.*, c.name AS customer_name, c.mobile, e.name AS telecaller_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN employees e ON e.id = o.telecaller_id
     WHERE 1=1 ${sc.sql} ${df.sql} ${extra}
     ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return success(res, 'OK', { items, page });
});

exports.get = asyncHandler(async (req, res) => {
  const found = await query('SELECT id FROM orders WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!found.length) return fail(res, 'Order not found', 404);
  const data = await hydrate(found[0].id);
  return success(res, 'OK', data);
});

exports.create = asyncHandler(async (req, res) => {
  const { customer_id, items, notes, is_reorder, parent_order_id } = req.body;
  if (!customer_id || !Array.isArray(items) || !items.length) return fail(res, 'Customer and products are required');
  const created = await withTransaction(async (conn) => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    const lines = [];
    for (const line of items) {
      const [prods] = await conn.query('SELECT * FROM products WHERE id=? OR public_id=? OR sku=?', [
        line.product_id,
        line.product_id,
        line.sku,
      ]);
      if (!prods.length) throw Object.assign(new Error('Product not found'), { status: 400 });
      const p = prods[0];
      const qty = Number(line.quantity || 0);
      if (qty < 1) throw Object.assign(new Error('Invalid quantity'), { status: 400 });
      const qrNumbers = (line.qr_numbers || []).map(Number).filter((n) => n > 0);
      if (qrNumbers.length !== qty) {
        throw Object.assign(new Error(`Select ${qty} QR number(s) for ${p.name}. Generate QR before creating the order.`), { status: 400 });
      }
      const unit = Number(line.unit_price != null ? line.unit_price : p.discount_price || p.price);
      const lineDisc = Number(line.discount || 0);
      const lineTax = Number(line.tax != null ? line.tax : p.tax || 0);
      const lineTotal = unit * qty - lineDisc + lineTax;
      subtotal += unit * qty;
      discount += lineDisc;
      tax += lineTax;
      lines.push({ product: p, qty, unit, lineDisc, lineTax, lineTotal, qrNumbers });
    }
    const total = subtotal - discount + tax;
    const [cust] = await conn.query('SELECT * FROM customers WHERE id=? OR public_id=?', [customer_id, customer_id]);
    if (!cust.length) throw Object.assign(new Error('Customer not found'), { status: 400 });
    const customer = cust[0];
    const { resolveShipTo } = require('../utils/shipAddress');
    const ship = resolveShipTo({}, customer);
    if (!ship.address || !ship.city || !ship.state || ship.pin.length !== 6) {
      throw Object.assign(new Error('Customer needs address, city, state and 6-digit pincode before creating an order'), { status: 400 });
    }
    const publicId = await nextPublicId(conn, 'ORD', 'ORD');
    const [ins] = await conn.query(
      `INSERT INTO orders (public_id, customer_id, telecaller_id, subtotal, discount, tax, total, payment_amount,
        payment_status, order_status, notes, is_reorder, parent_order_id, created_by,
        shipping_name, shipping_mobile, shipping_email, shipping_address, shipping_city, shipping_state, shipping_pincode)
       VALUES (?,?,?,?,?,?,?,0,'pending','payment_pending',?,?,?,?,?,?,?,?,?,?,?)`,
      [
        publicId,
        customer.id,
        req.user.employee_id,
        subtotal,
        discount,
        tax,
        total,
        notes || null,
        is_reorder ? 1 : 0,
        parent_order_id || null,
        req.user.employee_id,
        customer.name,
        customer.mobile,
        customer.email || null,
        ship.address,
        ship.city,
        ship.state,
        ship.pin,
      ]
    );
    for (const line of lines) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, sku, quantity, unit_price, discount, tax, total)
         VALUES (?,?,?,?,?,?,?,?)`,
        [ins.insertId, line.product.id, line.product.sku, line.qty, line.unit, line.lineDisc, line.lineTax, line.lineTotal]
      );
      for (const num of line.qrNumbers) {
        const [qr] = await conn.query(
          `SELECT id, product_id, product_unit_id FROM qr_codes WHERE qr_number=? AND status='ACTIVE' AND order_id IS NULL FOR UPDATE`,
          [num]
        );
        if (!qr.length) throw Object.assign(new Error(`QR number ${num} is not available`), { status: 400 });
        if (qr[0].product_id && Number(qr[0].product_id) !== Number(line.product.id)) {
          throw Object.assign(new Error(`QR ${num} belongs to a different product`), { status: 400 });
        }
        await conn.query('UPDATE qr_codes SET order_id=? WHERE id=?', [ins.insertId, qr[0].id]);
        if (qr[0].product_unit_id) {
          await conn.query(`UPDATE product_units SET order_id=?, status='reserved' WHERE id=?`, [ins.insertId, qr[0].product_unit_id]);
        }
      }
    }
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Order Created',
      module: 'orders',
      recordId: publicId,
      description: `Order ${publicId} created with QR ${lines.flatMap((l) => l.qrNumbers).join(', ')}`,
    });
    return { id: ins.insertId, public_id: publicId, total };
  });
  return success(res, 'Order created successfully', created, 201);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const found = await query('SELECT * FROM orders WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!found.length) return fail(res, 'Order not found', 404);
  const o = found[0];
  const status = req.body.status;
  const allowed = [
    'processing',
    'ready_to_dispatch',
    'dispatched',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'returned',
  ];
  if (!allowed.includes(status)) return fail(res, 'Invalid status');
  if (req.user.role === 'telecaller' && status === 'cancelled' && !['new', 'payment_pending', 'payment_rejected'].includes(o.order_status)) {
    return fail(res, 'Forbidden', 403);
  }
  await withTransaction(async (conn) => {
    await conn.query('UPDATE orders SET order_status=? WHERE id=?', [status, o.id]);
    const restoreStock = status === 'cancelled' && ['order_confirmed', 'processing', 'ready_to_dispatch'].includes(o.order_status) && o.payment_status === 'approved';
    if (restoreStock) {
      const [items] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      for (const item of items) {
        await changeStock(conn, {
          productId: item.product_id,
          delta: item.quantity,
          reason: 'order_cancelled',
          orderId: o.id,
          employeeId: req.user.employee_id,
        });
      }
    }
    if (status === 'delivered') {
      const [items] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [o.id]);
      for (const item of items) {
        const [prod] = await conn.query('SELECT usage_period_days FROM products WHERE id=?', [item.product_id]);
        const days = prod[0]?.usage_period_days || 30;
        const due = new Date();
        due.setDate(due.getDate() + days);
        const reo = await nextPublicId(conn, 'REO', 'REO');
        await conn.query(
          `INSERT INTO reorders (public_id, customer_id, previous_order_id, product_id, previous_quantity, due_date, status, assigned_employee_id)
           VALUES (?,?,?,?,?,?, 'due', ?)`,
          [reo, o.customer_id, o.id, item.product_id, item.quantity, due.toISOString().slice(0, 10), o.telecaller_id]
        );
      }
      if (o.telecaller_id) {
        const { notify } = require('../services/auditService');
        await notify(conn, {
          employeeId: o.telecaller_id,
          title: 'Reorder Follow-up Due',
          body: `Order ${o.public_id} delivered. Reorder follow-up scheduled.`,
          type: 'reorder_due',
          refModule: 'reorders',
          refId: o.id,
        });
      }
    }
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Order Updated',
      module: 'orders',
      recordId: o.public_id,
      description: `Status ${o.order_status} → ${status}`,
    });
  });
  return success(res, 'Order status updated');
});
