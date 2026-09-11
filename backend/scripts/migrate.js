const { query, withTransaction } = require('../config/db');

async function run() {
  const stmts = [
    `ALTER TABLE qr_codes ADD COLUMN qr_number INT NULL`,
    `ALTER TABLE qr_codes ADD UNIQUE INDEX uq_qr_number (qr_number)`,
    `ALTER TABLE qr_codes ADD COLUMN packed_status ENUM('pending','packed','not_packed') NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE qr_codes ADD COLUMN scan_note TEXT NULL`,
    `ALTER TABLE qr_codes ADD COLUMN scanned_at DATETIME NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_name VARCHAR(150) NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_mobile VARCHAR(20) NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_email VARCHAR(150) NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_address TEXT NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_city VARCHAR(80) NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_state VARCHAR(80) NULL`,
    `ALTER TABLE orders ADD COLUMN shipping_pincode VARCHAR(12) NULL`,
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
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS scan_issues (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      qr_id BIGINT NOT NULL,
      qr_number INT NULL,
      order_id BIGINT NULL,
      product_id BIGINT NULL,
      issue_type VARCHAR(80) NOT NULL DEFAULT 'not_packed',
      note TEXT NULL,
      employee_id BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_si_created (created_at)
    ) ENGINE=InnoDB`,
  ];
  for (const sql of stmts) {
    try {
      await query(sql);
    } catch (err) {
      if (err.errno !== 1060 && err.errno !== 1061 && err.errno !== 1050) {
        console.warn('migrate:', err.message);
      }
    }
  }
  await query(`INSERT IGNORE INTO id_sequences (entity, last_number) VALUES ('QRNUM', 0)`);
  const missing = await query('SELECT id FROM qr_codes WHERE qr_number IS NULL ORDER BY id');
  for (const row of missing) {
    await withTransaction(async (conn) => {
      const { nextQrNumber } = require('../services/qrService');
      const n = await nextQrNumber(conn);
      await conn.query('UPDATE qr_codes SET qr_number=? WHERE id=?', [n, row.id]);
    });
  }
  const [maxRow] = await query('SELECT COALESCE(MAX(qr_number), 0) AS m FROM qr_codes');
  await query('UPDATE id_sequences SET last_number = GREATEST(last_number, ?) WHERE entity=\'QRNUM\'', [maxRow.m || 0]);
  try {
    await query(
      `UPDATE orders o
       JOIN customers c ON c.id = o.customer_id
       SET o.shipping_name = COALESCE(o.shipping_name, c.name),
           o.shipping_mobile = COALESCE(o.shipping_mobile, c.mobile),
           o.shipping_email = COALESCE(o.shipping_email, c.email),
           o.shipping_address = COALESCE(o.shipping_address, c.address),
           o.shipping_city = COALESCE(o.shipping_city, c.city),
           o.shipping_state = COALESCE(o.shipping_state, c.state),
           o.shipping_pincode = COALESCE(o.shipping_pincode, c.pincode)
       WHERE o.shipping_address IS NULL OR o.shipping_address = ''`
    );
  } catch (err) {
    console.warn('migrate snapshot:', err.message);
  }
}

module.exports = { run };
