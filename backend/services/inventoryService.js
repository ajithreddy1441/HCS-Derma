const { nextPublicId } = require('../utils/ids');

async function changeStock(conn, { productId, delta, reason, orderId, returnId, employeeId, notes }) {
  const [rows] = await conn.query(
    'SELECT available_quantity, sold_quantity FROM inventory WHERE product_id = ? FOR UPDATE',
    [productId]
  );
  if (!rows.length) throw Object.assign(new Error('Inventory not found'), { status: 400 });
  const prev = rows[0].available_quantity;
  const next = prev + delta;
  if (next < 0) throw Object.assign(new Error('Negative stock is not allowed'), { status: 400 });
  const soldDelta = reason === 'order_confirmed' ? Math.abs(delta) : reason === 'order_cancelled' || reason === 'return_approved' ? -Math.abs(delta) : 0;
  const newSold = Math.max(0, rows[0].sold_quantity + soldDelta);
  await conn.query(
    `UPDATE inventory SET available_quantity = ?, sold_quantity = ? WHERE product_id = ?`,
    [next, newSold, productId]
  );
  await conn.query(
    `UPDATE products SET available_quantity = ?, sold_quantity = ? WHERE id = ?`,
    [next, newSold, productId]
  );
  const publicId = await nextPublicId(conn, 'INVTX', 'INVTX');
  await conn.query(
    `INSERT INTO inventory_transactions
     (public_id, product_id, previous_quantity, quantity_changed, new_quantity, reason, order_id, return_id, employee_id, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [publicId, productId, prev, delta, next, reason, orderId || null, returnId || null, employeeId || null, notes || null]
  );
  return { previous: prev, next, publicId };
}

function stockStatus(available, low) {
  if (available <= 0) return 'out_of_stock';
  if (available <= low) return 'low_stock';
  return 'in_stock';
}

module.exports = { changeStock, stockStatus };
