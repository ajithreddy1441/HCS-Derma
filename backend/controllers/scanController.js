const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');

function normalizeScanValue(value) {
  let raw = String(value || '').trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const m = u.pathname.match(/\/scan\/([^/]+)/i);
      if (m) return decodeURIComponent(m[1]);
    }
  } catch {
    /* not a URL */
  }
  const nested = raw.match(/\/scan\/([^/?#]+)/i);
  if (nested) {
    try {
      return decodeURIComponent(nested[1]);
    } catch {
      return nested[1];
    }
  }
  return raw;
}

function orderId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function lookup(input) {
  const value = normalizeScanValue(input);
  if (!value) return null;

  const asOrder = value.toUpperCase();
  if (/^ORD/i.test(value)) {
    const order = await query('SELECT * FROM orders WHERE public_id=? OR public_id=?', [value, asOrder]);
    if (order.length) return { kind: 'order', row: order[0] };
  }

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

  const order = await query('SELECT * FROM orders WHERE public_id=? OR public_id=?', [value, asOrder]);
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
      if (orderId(unit?.order_id)) row.order_id = unit.order_id;
    }
    if (orderId(row.order_id)) {
      const o = await query('SELECT * FROM orders WHERE id=?', [row.order_id]);
      order = o[0];
    }
  } else if (kind === 'product') product = row;
  else if (kind === 'unit') {
    unit = row;
    const p = await query('SELECT * FROM products WHERE id=?', [row.product_id]);
    product = p[0];
    if (orderId(row.order_id)) {
      const o = await query('SELECT * FROM orders WHERE id=?', [row.order_id]);
      order = o[0];
    }
  } else if (kind === 'order') order = row;

  if (!order && product && internal) {
    const latest = await query(
      `SELECT o.* FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.product_id=?
       ORDER BY o.id DESC LIMIT 1`,
      [product.id]
    );
    order = latest[0] || null;
  }

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

async function ensureScanHistory() {
  await query(
    `CREATE TABLE IF NOT EXISTS scan_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      employee_id BIGINT NULL,
      lookup_value VARCHAR(255) NULL,
      kind VARCHAR(40) NULL,
      qr_id BIGINT NULL,
      qr_number INT NULL,
      product_id BIGINT NULL,
      product_name VARCHAR(200) NULL,
      product_sku VARCHAR(80) NULL,
      order_id BIGINT NULL,
      order_public_id VARCHAR(20) NULL,
      customer_name VARCHAR(150) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sh_created (created_at)
    ) ENGINE=InnoDB`
  );
}

async function recordScan(req, found, data) {
  try {
    await ensureScanHistory();
    await query(
      `INSERT INTO scan_history
        (employee_id, lookup_value, kind, qr_id, qr_number, product_id, product_name, product_sku, order_id, order_public_id, customer_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user?.employee_id || null,
        req.params.value || null,
        found.kind,
        found.kind === 'qr' ? found.row.id : null,
        data.qr_number || data.qr?.qr_number || null,
        found.row.product_id || null,
        data.product?.name || data.order?.items?.[0]?.product_name || null,
        data.product?.sku || data.order?.items?.[0]?.sku || null,
        found.kind === 'order' ? found.row.id : found.row.order_id || null,
        data.order?.public_id || null,
        data.customer?.name || null,
      ]
    );
  } catch (err) {
    console.error('scan history', err.message);
  }
}

async function markQrScanned(found, req) {
  if (found.kind !== 'qr' || !found.row?.id) return;
  try {
    await query('UPDATE qr_codes SET scanned_at=NOW(), scanned_by=COALESCE(?, scanned_by) WHERE id=?', [
      req.user?.employee_id || null,
      found.row.id,
    ]);
  } catch (err) {
    console.error('mark qr scanned', err.message);
  }
}

exports.history = asyncHandler(async (_req, res) => {
  await ensureScanHistory();
  const fromQr = await query(
    `SELECT CONCAT('qr-', q.id) AS id,
            q.token AS lookup_value,
            'qr' AS kind,
            q.id AS qr_id,
            q.qr_number,
            COALESCE(q.product_id, u.product_id) AS product_id,
            p.name AS product_name,
            COALESCE(p.sku, CAST(q.qr_number AS CHAR)) AS product_sku,
            COALESCE(q.order_id, u.order_id) AS order_id,
            o.public_id AS order_public_id,
            c.name AS customer_name,
            COALESCE(q.scanned_at, q.created_at) AS created_at,
            e.name AS employee_name
     FROM qr_codes q
     LEFT JOIN product_units u ON u.id = q.product_unit_id
     LEFT JOIN products p ON p.id = COALESCE(q.product_id, u.product_id)
     LEFT JOIN orders o ON o.id = COALESCE(q.order_id, u.order_id)
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN employees e ON e.id = q.scanned_by
     WHERE q.order_id IS NOT NULL OR u.order_id IS NOT NULL OR q.scanned_at IS NOT NULL
     ORDER BY COALESCE(q.scanned_at, q.created_at) DESC, q.id DESC
     LIMIT 80`
  );
  const fromLog = await query(
    `SELECT h.*, e.name AS employee_name
     FROM scan_history h
     LEFT JOIN employees e ON e.id = h.employee_id
     ORDER BY h.id DESC LIMIT 80`
  );
  const seen = new Set();
  const items = [];
  for (const row of [...fromLog, ...fromQr]) {
    const key = row.qr_number != null ? `n-${row.qr_number}` : `v-${row.lookup_value || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(row);
  }
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return success(res, 'OK', { items: items.slice(0, 80) });
});

exports.publicScan = asyncHandler(async (req, res) => {
  const found = await lookup(req.params.value);
  if (!found) return fail(res, 'Not found', 404);
  if (found.kind === 'qr' && found.row.status !== 'ACTIVE') return fail(res, 'QR is not active', 400);
  const data = await pack(found, false);
  await markQrScanned(found, req);
  await recordScan(req, found, data);
  return success(res, 'OK', data);
});

exports.internalScan = asyncHandler(async (req, res) => {
  const found = await lookup(req.params.value);
  if (!found) return fail(res, 'Not found', 404);
  const data = await pack(found, true);
  await markQrScanned(found, req);
  await recordScan(req, found, data);
  return success(res, 'OK', data);
});
