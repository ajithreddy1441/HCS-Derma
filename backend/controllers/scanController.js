const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');

async function lookup(value) {
  const token = await query('SELECT * FROM qr_codes WHERE token=?', [value]);
  if (token.length) return { kind: 'qr', row: token[0] };

  if (/^\d+$/.test(String(value))) {
    const byNum = await query('SELECT * FROM qr_codes WHERE qr_number=?', [Number(value)]);
    if (byNum.length) return { kind: 'qr', row: byNum[0] };
  }

  const barcode = await query('SELECT * FROM products WHERE barcode=?', [value]);
  if (barcode.length) return { kind: 'product', row: barcode[0] };

  const sku = await query('SELECT * FROM products WHERE sku=?', [value]);
  if (sku.length) return { kind: 'product', row: sku[0] };

  const pid = await query('SELECT * FROM products WHERE public_id=?', [value]);
  if (pid.length) return { kind: 'product', row: pid[0] };

  const unit = await query('SELECT * FROM product_units WHERE public_id=?', [value]);
  if (unit.length) return { kind: 'unit', row: unit[0] };

  const order = await query('SELECT * FROM orders WHERE public_id=?', [value]);
  if (order.length) return { kind: 'order', row: order[0] };

  return null;
}

async function pack({ kind, row }, internal) {
  let product = null;
  let unit = null;
  let order = null;
  let customer = null;
  let payment = null;
  let shipment = null;

  if (kind === 'qr') {
    if (row.product_id) {
      const p = await query('SELECT * FROM products WHERE id=?', [row.product_id]);
      product = p[0];
    }
    if (row.product_unit_id) {
      const u = await query('SELECT * FROM product_units WHERE id=?', [row.product_unit_id]);
      unit = u[0];
      if (!product && unit) {
        const p = await query('SELECT * FROM products WHERE id=?', [unit.product_id]);
        product = p[0];
      }
      if (unit?.order_id) row.order_id = unit.order_id;
    }
    if (row.order_id) {
      const o = await query('SELECT * FROM orders WHERE id=?', [row.order_id]);
      order = o[0];
    }
  } else if (kind === 'product') product = row;
  else if (kind === 'unit') {
    unit = row;
    const p = await query('SELECT * FROM products WHERE id=?', [row.product_id]);
    product = p[0];
    if (row.order_id) {
      const o = await query('SELECT * FROM orders WHERE id=?', [row.order_id]);
      order = o[0];
    }
  } else if (kind === 'order') order = row;

  let items = [];
  if (order) {
    const c = await query('SELECT * FROM customers WHERE id=?', [order.customer_id]);
    customer = c[0];
    const pays = await query('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC LIMIT 1', [order.id]);
    payment = pays[0] || null;
    const ships = await query('SELECT * FROM shipments WHERE order_id=?', [order.id]);
    shipment = ships[0] || null;
    items = await query(
      `SELECT oi.sku, oi.quantity, oi.unit_price, oi.total, p.name AS product_name, p.image_path, p.public_id AS product_code
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id=?`,
      [order.id]
    );
  }

  const qty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const shipping = order
    ? {
        name: order.shipping_name || customer?.name || null,
        mobile: order.shipping_mobile || customer?.mobile || null,
        email: order.shipping_email || customer?.email || null,
        address: order.shipping_address || customer?.address || null,
        city: order.shipping_city || customer?.city || null,
        state: order.shipping_state || customer?.state || null,
        pincode: order.shipping_pincode || customer?.pincode || null,
      }
    : null;

  const publicPayload = {
    product: product
      ? {
          name: product.name,
          public_id: product.public_id,
          sku: product.sku,
          image_path: product.image_path,
          available_quantity: product.available_quantity,
        }
      : null,
    unit: unit ? { public_id: unit.public_id, status: unit.status } : null,
    qr_number: kind === 'qr' ? row.qr_number : null,
    packed_status: kind === 'qr' ? row.packed_status : null,
    order: order
      ? {
          public_id: order.public_id,
          order_date: order.order_date,
          quantity: qty,
          order_status: order.order_status,
          payment_status: order.payment_status,
          total: order.total,
          items: items.map((it) => ({
            product_name: it.product_name,
            product_code: it.product_code,
            sku: it.sku,
            quantity: it.quantity,
            total: it.total,
            image_path: it.image_path,
          })),
        }
      : null,
    customer: customer
      ? {
          name: customer.name,
          public_id: customer.public_id,
          mobile: customer.mobile,
          email: customer.email,
          city: customer.city,
          state: customer.state,
          address: customer.address,
        }
      : null,
    shipping,
    delivery: shipment
      ? {
          tracking_status: shipment.tracking_status,
          awb_number: shipment.awb_number,
          courier_partner: shipment.courier_partner,
          expected_delivery_date: shipment.expected_delivery_date,
        }
      : null,
  };

  if (!internal) return publicPayload;

  return {
    ...publicPayload,
    customer: publicPayload.customer,
    payment: payment
      ? {
          public_id: payment.public_id,
          amount: payment.amount,
          status: payment.status,
          utr: payment.utr,
          screenshot_path: payment.screenshot_path,
        }
      : null,
    shipment,
    qr: kind === 'qr' ? { id: row.id, qr_number: row.qr_number, packed_status: row.packed_status, scan_note: row.scan_note } : null,
    raw: { kind },
  };
}

exports.reportIssue = asyncHandler(async (req, res) => {
  const { qr_number, token, note, issue_type } = req.body;
  const issue = issue_type || 'not_packed';
  const rows = token
    ? await query('SELECT * FROM qr_codes WHERE token=?', [token])
    : await query('SELECT * FROM qr_codes WHERE qr_number=?', [qr_number]);
  if (!rows.length) return fail(res, 'QR not found', 404);
  const qr = rows[0];
  await query(
    `UPDATE qr_codes SET packed_status='not_packed', scan_note=?, scanned_at=NOW(), scanned_by=? WHERE id=?`,
    [note || 'Product scanned but not packed', req.user.employee_id, qr.id]
  );
  await query(
    `INSERT INTO scan_issues (qr_id, qr_number, order_id, product_id, issue_type, note, employee_id)
     VALUES (?,?,?,?,?,?,?)`,
    [qr.id, qr.qr_number, qr.order_id, qr.product_id, issue, note || 'Product scanned but not packed', req.user.employee_id]
  );
  const { notifyRole } = require('../services/auditService');
  const { withTransaction } = require('../config/db');
  await withTransaction(async (conn) => {
    await notifyRole(conn, 'accountant', {
      title: 'QR scan issue — not packed',
      body: `QR ${qr.qr_number || qr.public_id}: ${note || 'Product scanned but not packed'}`,
      type: 'scan_not_packed',
      refModule: 'qr',
      refId: qr.id,
    });
    await notifyRole(conn, 'admin', {
      title: 'QR scan issue — not packed',
      body: `QR ${qr.qr_number || qr.public_id}: ${note || 'Product scanned but not packed'}`,
      type: 'scan_not_packed',
      refModule: 'qr',
      refId: qr.id,
    });
  });
  return success(res, 'Issue noted for accountant');
});

exports.issues = asyncHandler(async (_req, res) => {
  const items = await query(
    `SELECT s.*, p.name AS product_name, o.public_id AS order_code, e.name AS employee_name
     FROM scan_issues s
     LEFT JOIN products p ON p.id = s.product_id
     LEFT JOIN orders o ON o.id = s.order_id
     LEFT JOIN employees e ON e.id = s.employee_id
     ORDER BY s.id DESC LIMIT 100`
  );
  return success(res, 'OK', { items });
});

exports.publicScan = asyncHandler(async (req, res) => {
  const found = await lookup(req.params.value);
  if (!found) return fail(res, 'Not found', 404);
  if (found.kind === 'qr' && found.row.status !== 'ACTIVE') return fail(res, 'QR is not active', 400);
  const data = await pack(found, false);
  return success(res, 'OK', data);
});

exports.internalScan = asyncHandler(async (req, res) => {
  const found = await lookup(req.params.value);
  if (!found) return fail(res, 'Not found', 404);
  const data = await pack(found, true);
  return success(res, 'OK', data);
});
