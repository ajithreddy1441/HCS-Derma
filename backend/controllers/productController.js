const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { success, fail } = require('../utils/response');
const { nextPublicId } = require('../utils/ids');
const { pagination } = require('../utils/scope');
const { changeStock, stockStatus } = require('../services/inventoryService');
const { logActivity } = require('../services/auditService');
const { createQr } = require('../services/qrService');

exports.categories = asyncHandler(async (_req, res) => {
  const items = await query('SELECT * FROM product_categories ORDER BY name');
  return success(res, 'OK', { items });
});

exports.createCategory = asyncHandler(async (req, res) => {
  if (!req.body.name) return fail(res, 'Name is required');
  await query('INSERT INTO product_categories (name) VALUES (?)', [req.body.name]);
  return success(res, 'Category created', {}, 201);
});

exports.list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const q = `%${req.query.q || ''}%`;
  const items = await query(
    `SELECT p.*, c.name AS category_name,
            CASE WHEN inv.available_quantity <= 0 THEN 'out_of_stock'
                 WHEN inv.available_quantity <= inv.low_stock_level THEN 'low_stock'
                 ELSE 'in_stock' END AS stock_status
     FROM products p
     LEFT JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN inventory inv ON inv.product_id = p.id
     WHERE p.name LIKE ? OR p.sku LIKE ? OR p.public_id LIKE ? OR p.barcode LIKE ?
     ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [q, q, q, q, limit, offset]
  );
  return success(res, 'OK', { items, page });
});

exports.get = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN product_categories c ON c.id=p.category_id WHERE p.id=? OR p.public_id=? OR p.sku=?`,
    [req.params.id, req.params.id, req.params.id]
  );
  if (!rows.length) return fail(res, 'Product not found', 404);
  const units = await query('SELECT * FROM product_units WHERE product_id=? ORDER BY id DESC LIMIT 200', [rows[0].id]);
  const qrs = await query('SELECT * FROM qr_codes WHERE product_id=? ORDER BY id DESC LIMIT 50', [rows[0].id]);
  return success(res, 'OK', { product: { ...rows[0], stock_status: stockStatus(rows[0].available_quantity, rows[0].low_stock_level) }, units, qrs });
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.name || !b.sku) return fail(res, 'Name and SKU are required');
  const exists = await query('SELECT id FROM products WHERE sku=?', [b.sku]);
  if (exists.length) return fail(res, 'Duplicate SKU');
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const created = await withTransaction(async (conn) => {
    const publicId = await nextPublicId(conn, 'PROD', 'PROD');
    const opening = Number(b.opening_stock || 0);
    const [ins] = await conn.query(
      `INSERT INTO products (public_id, name, sku, barcode, category_id, description, price, discount_price, tax,
        opening_stock, sold_quantity, available_quantity, low_stock_level, status, image_path, usage_period_days, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`,
      [
        publicId,
        b.name,
        b.sku,
        b.barcode || null,
        b.category_id || null,
        b.description || null,
        b.price || 0,
        b.discount_price || null,
        b.tax || 0,
        opening,
        opening,
        b.low_stock_level || 5,
        b.status || 'active',
        image,
        b.usage_period_days || 30,
        req.user.employee_id,
      ]
    );
    await conn.query(
      `INSERT INTO inventory (product_id, opening_stock, sold_quantity, available_quantity, low_stock_level)
       VALUES (?,?,0,?,?)`,
      [ins.insertId, opening, opening, b.low_stock_level || 5]
    );
    if (opening > 0) {
      await changeStock(conn, {
        productId: ins.insertId,
        delta: 0,
        reason: 'stock_added',
        employeeId: req.user.employee_id,
        notes: 'Opening stock',
      }).catch(() => {});
    }
    await logActivity(conn, {
      employeeId: req.user.employee_id,
      action: 'Product Created',
      module: 'products',
      recordId: publicId,
      description: b.name,
    });
    return { id: ins.insertId, public_id: publicId };
  });
  return success(res, 'Product created successfully', created, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM products WHERE id=? OR public_id=?', [req.params.id, req.params.id]);
  if (!rows.length) return fail(res, 'Product not found', 404);
  const p = rows[0];
  const b = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : p.image_path;
  await query(
    `UPDATE products SET name=?, barcode=?, category_id=?, description=?, price=?, discount_price=?, tax=?,
      low_stock_level=?, status=?, image_path=?, usage_period_days=? WHERE id=?`,
    [
      b.name ?? p.name,
      b.barcode ?? p.barcode,
      b.category_id ?? p.category_id,
      b.description ?? p.description,
      b.price ?? p.price,
      b.discount_price ?? p.discount_price,
      b.tax ?? p.tax,
      b.low_stock_level ?? p.low_stock_level,
      b.status ?? p.status,
      image,
      b.usage_period_days ?? p.usage_period_days,
      p.id,
    ]
  );
  await query('UPDATE inventory SET low_stock_level=? WHERE product_id=?', [b.low_stock_level ?? p.low_stock_level, p.id]);
  return success(res, 'Product updated');
});

exports.inventory = asyncHandler(async (_req, res) => {
  const items = await query(
    `SELECT p.name, p.public_id, p.sku, inv.*,
            CASE WHEN inv.available_quantity <= 0 THEN 'out_of_stock'
                 WHEN inv.available_quantity <= inv.low_stock_level THEN 'low_stock'
                 ELSE 'in_stock' END AS stock_status
     FROM inventory inv JOIN products p ON p.id = inv.product_id ORDER BY p.name`
  );
  return success(res, 'OK', { items });
});

exports.adjust = asyncHandler(async (req, res) => {
  const { product_id, quantity, reason, notes } = req.body;
  const qty = Number(quantity);
  if (!product_id || Number.isNaN(qty)) return fail(res, 'Product and quantity are required');
  const allowed = ['stock_added', 'manual_adjustment', 'damaged_product', 'stock_correction'];
  if (!allowed.includes(reason)) return fail(res, 'Invalid inventory reason');
  await withTransaction(async (conn) => {
    await changeStock(conn, {
      productId: product_id,
      delta: qty,
      reason,
      employeeId: req.user.employee_id,
      notes,
    });
  });
  return success(res, 'Inventory updated');
});

exports.history = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const items = await query(
    `SELECT t.*, p.name AS product_name, p.public_id AS product_code, p.sku,
            e.name AS employee_name, e.public_id AS employee_code,
            o.public_id AS order_code, r.public_id AS return_code
     FROM inventory_transactions t
     JOIN products p ON p.id = t.product_id
     LEFT JOIN employees e ON e.id = t.employee_id
     LEFT JOIN orders o ON o.id = t.order_id
     LEFT JOIN returns r ON r.id = t.return_id
     ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return success(res, 'OK', { items, page });
});

exports.generateUnits = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  const qty = Number(quantity || 0);
  if (!product_id || qty < 1) return fail(res, 'Product and quantity are required');
  const products = await query('SELECT * FROM products WHERE id=? OR public_id=?', [product_id, product_id]);
  if (!products.length) return fail(res, 'Product not found', 404);
  const p = products[0];
  const created = await withTransaction(async (conn) => {
    const units = [];
    for (let i = 0; i < qty; i += 1) {
      const unitId = await nextPublicId(conn, 'UNIT', 'UNIT');
      const [ins] = await conn.query(
        `INSERT INTO product_units (public_id, product_id, sku, status) VALUES (?,?,?,'available')`,
        [unitId, p.id, p.sku]
      );
      const qr = await createQr(conn, {
        type: 'PRODUCT_UNIT',
        productId: p.id,
        unitId: ins.insertId,
        employeeId: req.user.employee_id,
      });
      units.push({ unit_id: unitId, ...qr });
    }
    return units;
  });
  return success(res, 'Product units created', { items: created }, 201);
});
