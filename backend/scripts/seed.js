const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const PERMS = [
  ['employees.view', 'View employees', 'employees'],
  ['employees.manage', 'Manage employees', 'employees'],
  ['customers.view', 'View customers', 'customers'],
  ['customers.create', 'Create customers', 'customers'],
  ['customers.edit', 'Edit customers', 'customers'],
  ['leads.view', 'View leads', 'leads'],
  ['leads.create', 'Create leads', 'leads'],
  ['leads.edit', 'Edit leads', 'leads'],
  ['followups.view', 'View follow-ups', 'followups'],
  ['followups.create', 'Create follow-ups', 'followups'],
  ['followups.edit', 'Complete follow-ups', 'followups'],
  ['products.view', 'View products', 'products'],
  ['products.manage', 'Manage products', 'products'],
  ['inventory.view', 'View inventory', 'inventory'],
  ['inventory.adjust', 'Adjust inventory', 'inventory'],
  ['orders.view', 'View orders', 'orders'],
  ['orders.create', 'Create orders', 'orders'],
  ['orders.edit', 'Edit orders', 'orders'],
  ['payments.view', 'View payments', 'payments'],
  ['payments.upload', 'Upload payments', 'payments'],
  ['payments.approve', 'Approve payments', 'payments'],
  ['qr.manage', 'QR codes', 'qr'],
  ['shipments.view', 'View shipments', 'shipments'],
  ['shipments.manage', 'Manage shipments', 'shipments'],
  ['returns.view', 'View returns', 'returns'],
  ['returns.create', 'Create returns', 'returns'],
  ['returns.manage', 'Approve returns', 'returns'],
  ['reorders.view', 'View reorders', 'reorders'],
  ['targets.manage', 'Manage targets', 'hr'],
  ['incentives.manage', 'Manage incentives', 'hr'],
  ['payroll.manage', 'Manage payroll', 'hr'],
  ['reports.view', 'View reports', 'reports'],
  ['activity.view', 'View activity', 'logs'],
  ['audit.view', 'View audit', 'logs'],
  ['settings.manage', 'Manage settings', 'settings'],
];

const TELE = [
  'customers.view', 'customers.create', 'customers.edit',
  'leads.view', 'leads.create', 'leads.edit',
  'followups.view', 'followups.create', 'followups.edit',
  'products.view', 'orders.view', 'orders.create', 'orders.edit',
  'payments.view', 'payments.upload', 'reorders.view', 'activity.view',
];

const ACCT = [
  'customers.view', 'orders.view', 'payments.view', 'payments.approve',
  'products.view', 'inventory.view', 'reports.view', 'activity.view',
  'returns.view',
];

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`INSERT IGNORE INTO roles (slug, name, description) VALUES
      ('admin','Admin','Full access'),
      ('telecaller','Telecaller','Leads, customers, orders'),
      ('accountant','Accountant','Payments and finance')`);

    for (const [slug, name, module] of PERMS) {
      await conn.query('INSERT IGNORE INTO permissions (slug, name, module) VALUES (?,?,?)', [slug, name, module]);
    }

    const [roles] = await conn.query('SELECT * FROM roles');
    const role = Object.fromEntries(roles.map((r) => [r.slug, r.id]));
    const [perms] = await conn.query('SELECT * FROM permissions');
    const pid = Object.fromEntries(perms.map((p) => [p.slug, p.id]));

    async function grant(roleId, slugs) {
      for (const s of slugs) {
        if (!pid[s]) continue;
        await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)', [roleId, pid[s]]);
      }
    }
    await grant(role.admin, PERMS.map((p) => p[0]));
    await grant(role.telecaller, TELE);
    await grant(role.accountant, ACCT);

    const [seq] = await conn.query("SELECT last_number FROM id_sequences WHERE entity='EMP'");
    if (!seq[0].last_number) {
      await conn.query("UPDATE id_sequences SET last_number=3 WHERE entity='EMP'");
      const hash = await bcrypt.hash('Admin@123', 10);
      const teleHash = await bcrypt.hash('Tele@123', 10);
      const accHash = await bcrypt.hash('Acct@123', 10);
      await conn.query(
        `INSERT INTO employees (public_id, name, mobile, email, role_id, joining_date, status)
         VALUES ('EMP000001','System Admin','9999990001','admin@nexus.local',?,'2024-01-01','active'),
                ('EMP000002','Priya Telecaller','9999990002','tele@nexus.local',?,'2024-02-01','active'),
                ('EMP000003','Rahul Accountant','9999990003','accounts@nexus.local',?,'2024-03-01','active')`,
        [role.admin, role.telecaller, role.accountant]
      );
      const [emps] = await conn.query('SELECT id, public_id FROM employees');
      const byCode = Object.fromEntries(emps.map((e) => [e.public_id, e.id]));
      await conn.query(
        `INSERT INTO users (employee_id, username, email, password_hash, role_id, status) VALUES
         (?, 'admin', 'admin@nexus.local', ?, ?, 'active'),
         (?, 'telecaller', 'tele@nexus.local', ?, ?, 'active'),
         (?, 'accountant', 'accounts@nexus.local', ?, ?, 'active')`,
        [
          byCode.EMP000001, hash, role.admin,
          byCode.EMP000002, teleHash, role.telecaller,
          byCode.EMP000003, accHash, role.accountant,
        ]
      );
    }

    await conn.query(`INSERT IGNORE INTO product_categories (name) VALUES ('Machines'),('Spares'),('Consumables')`);
    await conn.query(`INSERT IGNORE INTO incentive_rules (min_pct, max_pct, label, incentive_amount, bonus_amount) VALUES
      (0, 69.99, 'Below 70%', 0, 0),
      (70, 89.99, 'Rule A', 5000, 0),
      (90, 99.99, 'Rule B', 12000, 2000),
      (100, NULL, 'Rule C', 20000, 8000)`);
    await conn.query(`INSERT INTO settings (setting_key, setting_value) VALUES
      ('company_name','HCS DERMA'),
      ('company_phone','1800-000-000'),
      ('public_scan_url','/scan')
      ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`);

    await conn.commit();
    console.log('Seed complete.');
    console.log('Login: admin / Admin@123 | telecaller / Tele@123 | accountant / Acct@123');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    process.exitCode = 1;
  } finally {
    conn.release();
    process.exit();
  }
}

seed();
