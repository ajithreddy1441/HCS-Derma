const { nextPublicId } = require('../utils/ids');
const { changeStock } = require('./inventoryService');
const { logActivity, logAudit, notify, notifyRole } = require('./auditService');

function classifyAmount(amount, orderTotal) {
  const a = Number(amount);
  const t = Number(orderTotal);
  const diff = Number((a - t).toFixed(2));
  if (Math.abs(diff) < 0.01) return { status: 'under_verification', mismatch: 0 };
  return { status: 'payment_mismatch', mismatch: diff };
}

async function approvePayment(conn, { paymentId, actor, notes }) {
  const [pays] = await conn.query(
    `SELECT p.*, o.total, o.order_status, o.public_id AS order_code, o.telecaller_id, o.customer_id
     FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ? FOR UPDATE`,
    [paymentId]
  );
  if (!pays.length) throw Object.assign(new Error('Payment not found'), { status: 404 });
  const pay = pays[0];
  if (pay.status === 'approved') throw Object.assign(new Error('Payment already approved'), { status: 400 });
  if (actor.role === 'telecaller') throw Object.assign(new Error('Telecallers cannot approve payments'), { status: 403 });

  if (Number(pay.amount) !== Number(pay.total) && pay.status === 'payment_mismatch' && actor.role !== 'admin') {
    throw Object.assign(new Error('Payment mismatch requires admin review'), { status: 403 });
  }

  await conn.query(`UPDATE payments SET status='approved' WHERE id=?`, [paymentId]);
  await conn.query(
    `UPDATE orders SET payment_status='approved', payment_amount=?, order_status='order_confirmed' WHERE id=?`,
    [pay.amount, pay.order_id]
  );
  await conn.query(
    `INSERT INTO payment_approvals (payment_id, action, actor_id, notes) VALUES (?,?,?,?)`,
    [paymentId, 'approve', actor.employee_id, notes || null]
  );

  const [items] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [pay.order_id]);
  for (const item of items) {
    await changeStock(conn, {
      productId: item.product_id,
      delta: -item.quantity,
      reason: 'order_confirmed',
      orderId: pay.order_id,
      employeeId: actor.employee_id,
    });
    for (let i = 0; i < item.quantity; i += 1) {
      const [avail] = await conn.query(
        `SELECT id FROM product_units WHERE product_id=? AND status='available' LIMIT 1 FOR UPDATE`,
        [item.product_id]
      );
      if (avail.length) {
        await conn.query(`UPDATE product_units SET status='sold', order_id=? WHERE id=?`, [pay.order_id, avail[0].id]);
        await conn.query(`UPDATE qr_codes SET order_id=? WHERE product_unit_id=? AND order_id IS NULL`, [pay.order_id, avail[0].id]);
      }
    }
  }

  const invId = await nextPublicId(conn, 'INV', 'INV');
  await conn.query('INSERT INTO invoices (public_id, order_id) VALUES (?,?)', [invId, pay.order_id]);
  await conn.query(`UPDATE orders SET order_status='processing' WHERE id=?`, [pay.order_id]);

  await logActivity(conn, {
    employeeId: actor.employee_id,
    action: 'Payment Approved',
    module: 'payments',
    recordId: pay.public_id,
    description: `Payment ${pay.public_id} approved for ${pay.order_code}`,
  });
  await logAudit(conn, {
    employeeId: actor.employee_id,
    module: 'payments',
    recordId: pay.public_id,
    field: 'status',
    oldValue: pay.status,
    newValue: 'approved',
    action: 'approve',
  });
  if (pay.telecaller_id) {
    await notify(conn, {
      employeeId: pay.telecaller_id,
      title: 'Payment Approved',
      body: `Payment ${pay.public_id} approved. Order ${pay.order_code} confirmed.`,
      type: 'payment_approved',
      refModule: 'orders',
      refId: pay.order_id,
    });
  }
  return pay;
}

async function rejectPayment(conn, { paymentId, actor, reason, notes }) {
  if (actor.role === 'telecaller') throw Object.assign(new Error('Telecallers cannot reject payments'), { status: 403 });
  const [pays] = await conn.query('SELECT * FROM payments WHERE id=? FOR UPDATE', [paymentId]);
  if (!pays.length) throw Object.assign(new Error('Payment not found'), { status: 404 });
  const pay = pays[0];
  if (pay.status === 'approved') throw Object.assign(new Error('Approved payments cannot be modified'), { status: 400 });
  await conn.query(
    `UPDATE payments SET status='rejected', rejection_reason=?, rejection_notes=? WHERE id=?`,
    [reason || 'other', notes || null, paymentId]
  );
  await conn.query(
    `UPDATE orders SET payment_status='rejected', order_status='payment_rejected' WHERE id=?`,
    [pay.order_id]
  );
  await conn.query(
    `INSERT INTO payment_approvals (payment_id, action, actor_id, notes) VALUES (?,?,?,?)`,
    [paymentId, 'reject', actor.employee_id, notes || reason]
  );
  await logActivity(conn, {
    employeeId: actor.employee_id,
    action: 'Payment Rejected',
    module: 'payments',
    recordId: pay.public_id,
    description: reason,
  });
  const [ord] = await conn.query('SELECT telecaller_id, public_id FROM orders WHERE id=?', [pay.order_id]);
  if (ord[0]?.telecaller_id) {
    await notify(conn, {
      employeeId: ord[0].telecaller_id,
      title: 'Payment Rejected',
      body: `Payment ${pay.public_id} rejected: ${reason}`,
      type: 'payment_rejected',
      refModule: 'payments',
      refId: pay.id,
    });
  }
}

module.exports = { classifyAmount, approvePayment, rejectPayment, notifyRole };
