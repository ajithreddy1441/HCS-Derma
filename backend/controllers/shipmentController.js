const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const shiprocket = require('../services/shiprocketService');

exports.list = asyncHandler(async (_req, res) => {
  const items = await query(
    `SELECT s.*, o.public_id AS order_code, c.name AS customer_name
     FROM shipments s
     JOIN orders o ON o.id = s.order_id
     JOIN customers c ON c.id = o.customer_id
     ORDER BY s.id DESC`
  );
  return success(res, 'OK', { items });
});

exports.get = asyncHandler(async (req, res) => {
  const items = await query(
    `SELECT s.*, o.public_id AS order_code FROM shipments s JOIN orders o ON o.id=s.order_id
     WHERE s.id=? OR o.public_id=? OR s.awb_number=?`,
    [req.params.id, req.params.id, req.params.id]
  );
  if (!items.length) return fail(res, 'Shipment not found', 404);
  const history = await query('SELECT * FROM tracking_history WHERE shipment_id=? ORDER BY id', [items[0].id]);
  return success(res, 'OK', { shipment: items[0], history });
});

exports.create = asyncHandler(async (req, res) => {
  const orders = await query('SELECT * FROM orders WHERE id=? OR public_id=?', [req.body.order_id, req.body.order_id]);
  if (!orders.length) return fail(res, 'Order not found', 404);
  const order = orders[0];
  if (!['order_confirmed', 'processing', 'ready_to_dispatch'].includes(order.order_status) && order.payment_status !== 'approved') {
    return fail(res, 'Shipment can be created only after payment approval / confirmation');
  }
  const { syncOrderToShiprocket } = require('../services/shipmentSync');
  const created = await syncOrderToShiprocket(order.id, {
    employeeId: req.user.employee_id,
    force: Boolean(req.body.force),
  });
  if (created.skipped) return fail(res, 'Duplicate shipment is not allowed for this order', 400);
  return success(res, created.mock ? 'Shipment saved locally (add Shiprocket credentials in Settings)' : 'Order sent to Shiprocket', created, 201);
});

exports.track = asyncHandler(async (req, res) => {
  const items = await query(
    `SELECT s.* FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=? OR o.public_id=? OR s.awb_number=?`,
    [req.params.id, req.params.id, req.params.id]
  );
  if (!items.length) return fail(res, 'Shipment not found', 404);
  const s = items[0];
  let remote = null;
  if (s.awb_number) remote = await shiprocket.trackAwb(s.awb_number);
  return success(res, 'OK', { shipment: s, remote });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const items = await query('SELECT * FROM shipments WHERE id=?', [req.params.id]);
  if (!items.length) return fail(res, 'Shipment not found', 404);
  const status = req.body.tracking_status;
  await withTransaction(async (conn) => {
    await conn.query('UPDATE shipments SET tracking_status=?, awb_number=COALESCE(?, awb_number), courier_partner=COALESCE(?, courier_partner) WHERE id=?', [
      status,
      req.body.awb_number || null,
      req.body.courier_partner || null,
      items[0].id,
    ]);
    await conn.query('INSERT INTO tracking_history (shipment_id, status, message) VALUES (?,?,?)', [
      items[0].id,
      status,
      req.body.message || status,
    ]);
    const map = {
      dispatched: 'dispatched',
      in_transit: 'in_transit',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      returned: 'returned',
      rto: 'returned',
    };
    if (map[status]) await conn.query('UPDATE orders SET order_status=? WHERE id=?', [map[status], items[0].order_id]);
  });
  return success(res, 'Tracking updated');
});
