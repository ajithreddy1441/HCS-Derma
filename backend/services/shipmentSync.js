const { query, withTransaction } = require('../config/db');
const shiprocket = require('./shiprocketService');
const { logActivity } = require('./auditService');

function srValue(sr, ...keys) {
  for (const k of keys) {
    if (sr[k] != null && sr[k] !== '') return sr[k];
  }
  return null;
}

function isMockRow(row) {
  if (!row) return false;
  return String(row.shiprocket_order_id || '').startsWith('MOCK-') || row.shipment_status === 'mock';
}

async function syncOrderToShiprocket(orderId, { employeeId, force } = {}) {
  const existing = await query('SELECT * FROM shipments WHERE order_id=?', [orderId]);
  if (existing.length && !isMockRow(existing[0]) && !force) {
    return { skipped: true, reason: 'already_exists' };
  }

  const orders = await query('SELECT * FROM orders WHERE id=?', [orderId]);
  if (!orders.length) throw Object.assign(new Error('Order not found'), { status: 404 });
  const order = orders[0];
  const [customer] = await query('SELECT * FROM customers WHERE id=?', [order.customer_id]);
  const items = await query(
    `SELECT oi.*, p.name AS product_name FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?`,
    [order.id]
  );
  const sr = await shiprocket.createShipment(order, customer, items);
  if (sr.mock) {
    throw Object.assign(new Error('Shiprocket is not configured. Restart the API after saving credentials.'), { status: 400 });
  }
  const shiprocketOrderId = String(srValue(sr, 'order_id', 'order_id_str') || '');
  const shipmentId = srValue(sr, 'shipment_id');
  const awb = srValue(sr, 'awb_code', 'awb');
  const courier = srValue(sr, 'courier_name');
  const charge = srValue(sr, 'freight_charges');
  const message = `Order ${order.public_id} sent to Shiprocket`;

  const id = await withTransaction(async (conn) => {
    const [dup] = await conn.query('SELECT * FROM shipments WHERE order_id=? FOR UPDATE', [order.id]);
    if (dup.length) {
      await conn.query(
        `UPDATE shipments SET shiprocket_order_id=?, shipment_id=?, awb_number=COALESCE(?, awb_number),
          courier_partner=COALESCE(?, courier_partner), shipping_charge=COALESCE(?, shipping_charge),
          pickup_status=?, shipment_status=?, tracking_status='processing' WHERE id=?`,
        [
          shiprocketOrderId,
          shipmentId,
          awb,
          courier,
          charge,
          sr.pickup_status || 'pending',
          sr.status || 'created',
          dup[0].id,
        ]
      );
      await conn.query(`INSERT INTO tracking_history (shipment_id, status, message) VALUES (?,?,?)`, [
        dup[0].id,
        'processing',
        message,
      ]);
      await conn.query(`UPDATE orders SET order_status='ready_to_dispatch' WHERE id=?`, [order.id]);
      await logActivity(conn, {
        employeeId: employeeId || null,
        action: 'Shipment Created',
        module: 'shipments',
        recordId: order.public_id,
        description: 'Order pushed to Shiprocket',
      });
      return dup[0].id;
    }
    const [ins] = await conn.query(
      `INSERT INTO shipments (order_id, shiprocket_order_id, shipment_id, awb_number, courier_partner, shipping_charge,
        pickup_status, shipment_status, tracking_status)
       VALUES (?,?,?,?,?,?,?,?, 'processing')`,
      [
        order.id,
        shiprocketOrderId,
        shipmentId,
        awb,
        courier,
        charge,
        sr.pickup_status || 'pending',
        sr.status || 'created',
      ]
    );
    await conn.query(`INSERT INTO tracking_history (shipment_id, status, message) VALUES (?,?,?)`, [
      ins.insertId,
      'processing',
      message,
    ]);
    await conn.query(`UPDATE orders SET order_status='ready_to_dispatch' WHERE id=?`, [order.id]);
    await logActivity(conn, {
      employeeId: employeeId || null,
      action: 'Shipment Created',
      module: 'shipments',
      recordId: order.public_id,
      description: 'Order pushed to Shiprocket automatically',
    });
    return ins.insertId;
  });

  return { id, shiprocket: sr, mock: false };
}

module.exports = { syncOrderToShiprocket };
