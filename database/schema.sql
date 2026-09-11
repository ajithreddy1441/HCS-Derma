-- HCS DERMA CRM — MySQL schema (InnoDB, FK, indexes)
-- Import this file WHILE the target database is already selected in phpMyAdmin.
-- Do not CREATE DATABASE here: Hostinger shared users cannot create databases from SQL.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS payroll;
DROP TABLE IF EXISTS employee_incentives;
DROP TABLE IF EXISTS incentive_rules;
DROP TABLE IF EXISTS team_target_members;
DROP TABLE IF EXISTS team_targets;
DROP TABLE IF EXISTS employee_targets;
DROP TABLE IF EXISTS reorders;
DROP TABLE IF EXISTS return_items;
DROP TABLE IF EXISTS returns;
DROP TABLE IF EXISTS tracking_history;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS payment_approvals;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS qr_codes;
DROP TABLE IF EXISTS product_units;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS customer_notes;
DROP TABLE IF EXISTS lead_followups;
DROP TABLE IF EXISTS followups;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS id_sequences;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  module VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE employees (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  role_id INT NOT NULL,
  joining_date DATE NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT NULL,
  INDEX idx_emp_role (role_id),
  INDEX idx_emp_status (status),
  CONSTRAINT fk_emp_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role_id),
  CONSTRAINT fk_users_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  store_name VARCHAR(150) NULL,
  mobile VARCHAR(20) NOT NULL,
  alternate_mobile VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address TEXT NULL,
  city VARCHAR(80) NULL,
  state VARCHAR(80) NULL,
  pincode VARCHAR(12) NULL,
  assigned_employee_id BIGINT NULL,
  status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  converted_from_lead_id BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cust_mobile (mobile),
  INDEX idx_cust_assigned (assigned_employee_id),
  INDEX idx_cust_name (name),
  CONSTRAINT fk_cust_emp FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE leads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  interested_product VARCHAR(200) NULL,
  source VARCHAR(100) NULL,
  reason_not_purchasing TEXT NULL,
  assigned_employee_id BIGINT NULL,
  notes TEXT NULL,
  next_followup_date DATE NULL,
  next_followup_time TIME NULL,
  status ENUM('new','interested','follow_up_required','converted','not_interested','no_response','future_requirement','lost') NOT NULL DEFAULT 'new',
  converted_customer_id BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lead_mobile (mobile),
  INDEX idx_lead_status (status),
  INDEX idx_lead_assigned (assigned_employee_id),
  CONSTRAINT fk_lead_emp FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_lead_cust FOREIGN KEY (converted_customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE customers
  ADD CONSTRAINT fk_cust_lead FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE TABLE followups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  lead_id BIGINT NULL,
  customer_id BIGINT NULL,
  assigned_employee_id BIGINT NULL,
  followup_date DATE NOT NULL,
  followup_time TIME NULL,
  reason VARCHAR(255) NULL,
  previous_conversation TEXT NULL,
  notes TEXT NULL,
  next_action VARCHAR(255) NULL,
  next_followup_date DATE NULL,
  next_followup_time TIME NULL,
  status ENUM('pending','completed','interested','not_interested','no_response','call_later','converted') NOT NULL DEFAULT 'pending',
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fu_date (followup_date, status),
  INDEX idx_fu_emp (assigned_employee_id),
  CONSTRAINT fk_fu_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_fu_cust FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fu_emp FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE lead_followups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  followup_id BIGINT NOT NULL,
  UNIQUE KEY uq_lead_fu (lead_id, followup_id),
  CONSTRAINT fk_lf_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lf_fu FOREIGN KEY (followup_id) REFERENCES followups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE customer_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NULL,
  lead_id BIGINT NULL,
  note TEXT NOT NULL,
  employee_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notes_cust (customer_id),
  CONSTRAINT fk_notes_cust FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE product_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  barcode VARCHAR(80) NULL UNIQUE,
  category_id INT NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_price DECIMAL(12,2) NULL,
  tax DECIMAL(8,2) NOT NULL DEFAULT 0,
  opening_stock INT NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT NOT NULL DEFAULT 0,
  low_stock_level INT NOT NULL DEFAULT 5,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  image_path VARCHAR(255) NULL,
  usage_period_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT NULL,
  INDEX idx_prod_cat (category_id),
  INDEX idx_prod_name (name),
  CONSTRAINT fk_prod_cat FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE product_units (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  product_id BIGINT NOT NULL,
  sku VARCHAR(80) NOT NULL,
  order_id BIGINT NULL,
  status ENUM('available','reserved','sold','returned','damaged') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_unit_prod (product_id),
  INDEX idx_unit_order (order_id),
  CONSTRAINT fk_unit_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE qr_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  token VARCHAR(64) NOT NULL UNIQUE,
  qr_number INT NULL UNIQUE,
  qr_type ENUM('PRODUCT','PRODUCT_UNIT','ORDER') NOT NULL,
  product_id BIGINT NULL,
  product_unit_id BIGINT NULL,
  order_id BIGINT NULL,
  status ENUM('ACTIVE','INACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  packed_status ENUM('pending','packed','not_packed') NOT NULL DEFAULT 'pending',
  scan_note TEXT NULL,
  scanned_at DATETIME NULL,
  scanned_by BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qr_type (qr_type),
  CONSTRAINT fk_qr_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_qr_unit FOREIGN KEY (product_unit_id) REFERENCES product_units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE,
  opening_stock INT NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT NOT NULL DEFAULT 0,
  low_stock_level INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL,
  telecaller_id BIGINT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('pending','under_verification','approved','rejected','partial_payment','payment_mismatch','refunded') NOT NULL DEFAULT 'pending',
  order_status ENUM(
    'new','payment_pending','payment_verification','payment_approved','payment_rejected',
    'order_confirmed','processing','ready_to_dispatch','dispatched','in_transit',
    'out_for_delivery','delivered','cancelled','returned'
  ) NOT NULL DEFAULT 'new',
  invoice_path VARCHAR(255) NULL,
  notes TEXT NULL,
  is_reorder TINYINT(1) NOT NULL DEFAULT 0,
  parent_order_id BIGINT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ord_cust (customer_id),
  INDEX idx_ord_status (order_status),
  INDEX idx_ord_pay (payment_status),
  INDEX idx_ord_tel (telecaller_id),
  INDEX idx_ord_date (order_date),
  CONSTRAINT fk_ord_cust FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_ord_tel FOREIGN KEY (telecaller_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_ord_parent FOREIGN KEY (parent_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  sku VARCHAR(80) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_oi_ord FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_prod FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

ALTER TABLE product_units
  ADD CONSTRAINT fk_unit_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE qr_codes
  ADD CONSTRAINT fk_qr_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE inventory_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  product_id BIGINT NOT NULL,
  previous_quantity INT NOT NULL,
  quantity_changed INT NOT NULL,
  new_quantity INT NOT NULL,
  reason ENUM('stock_added','order_confirmed','order_cancelled','return_approved','manual_adjustment','damaged_product','stock_correction') NOT NULL,
  order_id BIGINT NULL,
  return_id BIGINT NULL,
  employee_id BIGINT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_it_prod (product_id),
  INDEX idx_it_date (created_at),
  CONSTRAINT fk_it_prod FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_it_ord FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_it_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  order_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode ENUM('upi','bank_transfer','cash','card','other') NOT NULL,
  utr VARCHAR(80) NULL,
  payment_datetime DATETIME NOT NULL,
  screenshot_path VARCHAR(255) NULL,
  uploaded_by BIGINT NULL,
  status ENUM('pending','under_verification','approved','rejected','partial_payment','payment_mismatch','refunded') NOT NULL DEFAULT 'pending',
  mismatch_difference DECIMAL(12,2) NULL,
  rejection_reason VARCHAR(80) NULL,
  rejection_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pay_order (order_id),
  INDEX idx_pay_utr (utr),
  INDEX idx_pay_status (status),
  CONSTRAINT fk_pay_ord FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_pay_cust FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_pay_emp FOREIGN KEY (uploaded_by) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payment_approvals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT NOT NULL,
  action ENUM('view','verify','approve','reject','request_verification') NOT NULL,
  actor_id BIGINT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pa_pay (payment_id),
  CONSTRAINT fk_pa_pay FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_actor FOREIGN KEY (actor_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  order_id BIGINT NOT NULL UNIQUE,
  file_path VARCHAR(255) NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invc_ord FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;

CREATE TABLE shipments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE,
  shiprocket_order_id VARCHAR(80) NULL,
  shipment_id VARCHAR(80) NULL,
  awb_number VARCHAR(80) NULL,
  courier_partner VARCHAR(120) NULL,
  shipping_charge DECIMAL(12,2) NULL,
  pickup_status VARCHAR(80) NULL,
  shipment_status VARCHAR(80) NULL,
  tracking_status ENUM('processing','ready_to_dispatch','dispatched','in_transit','out_for_delivery','delivered','delivery_failed','returned','rto') NOT NULL DEFAULT 'processing',
  expected_delivery_date DATE NULL,
  delivered_date DATETIME NULL,
  rto_status VARCHAR(80) NULL,
  return_status VARCHAR(80) NULL,
  label_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ship_awb (awb_number),
  CONSTRAINT fk_ship_ord FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;

CREATE TABLE tracking_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT NOT NULL,
  status VARCHAR(80) NOT NULL,
  message VARCHAR(255) NULL,
  location VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_th_ship FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  order_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  reason ENUM('customer_request','damaged_product','wrong_product','missing_product','delivery_issue','product_issue','courier_return','rto','other') NOT NULL,
  requested_by BIGINT NULL,
  status ENUM(
    'return_requested','under_review','approved','rejected','pickup_scheduled','in_transit',
    'received','quality_check','approved_for_inventory','rejected_for_inventory',
    'refund_processing','replacement_processing','completed'
  ) NOT NULL DEFAULT 'return_requested',
  return_awb VARCHAR(80) NULL,
  received_date DATETIME NULL,
  admin_remarks TEXT NULL,
  approval_date DATETIME NULL,
  approved_by BIGINT NULL,
  image_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ret_ord (order_id),
  CONSTRAINT fk_ret_ord FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_ret_cust FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT fk_it_ret FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE SET NULL;

CREATE TABLE return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  sku VARCHAR(80) NOT NULL,
  quantity INT NOT NULL,
  CONSTRAINT fk_ri_ret FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_ri_prod FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE reorders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL,
  previous_order_id BIGINT NOT NULL,
  product_id BIGINT NULL,
  previous_quantity INT NULL,
  due_date DATE NOT NULL,
  status ENUM('due','followed_up','converted','skipped') NOT NULL DEFAULT 'due',
  new_order_id BIGINT NULL,
  assigned_employee_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reo_due (due_date, status),
  CONSTRAINT fk_reo_cust FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_reo_ord FOREIGN KEY (previous_order_id) REFERENCES orders(id),
  CONSTRAINT fk_reo_new FOREIGN KEY (new_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE employee_targets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  period_type ENUM('daily','weekly','monthly') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sales_target DECIMAL(12,2) NOT NULL DEFAULT 0,
  order_target INT NOT NULL DEFAULT 0,
  lead_conversion_target INT NOT NULL DEFAULT 0,
  followup_target INT NOT NULL DEFAULT 0,
  reorder_target INT NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_et_emp (employee_id, period_type, period_start),
  CONSTRAINT fk_et_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE team_targets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sales_target DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE team_target_members (
  team_target_id BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  PRIMARY KEY (team_target_id, employee_id),
  CONSTRAINT fk_ttm_tt FOREIGN KEY (team_target_id) REFERENCES team_targets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ttm_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE incentive_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  min_pct DECIMAL(6,2) NOT NULL,
  max_pct DECIMAL(6,2) NULL,
  label VARCHAR(80) NOT NULL,
  incentive_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE employee_incentives (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  month CHAR(7) NOT NULL,
  achievement_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  incentive DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inc_emp_month (employee_id, month),
  CONSTRAINT fk_inc_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payroll (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(20) NOT NULL UNIQUE,
  employee_id BIGINT NOT NULL,
  salary_month CHAR(7) NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  incentive DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('pending','processing','paid') NOT NULL DEFAULT 'pending',
  payment_date DATE NULL,
  payment_reference VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pay_emp_month (employee_id, salary_month),
  CONSTRAINT fk_pr_emp FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NULL,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(80) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  ref_module VARCHAR(80) NULL,
  ref_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_emp (employee_id, is_read),
  CONSTRAINT fk_notif_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NULL,
  action VARCHAR(80) NOT NULL,
  module VARCHAR(80) NOT NULL,
  record_id VARCHAR(40) NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_act_mod (module, created_at),
  CONSTRAINT fk_act_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT NULL,
  module VARCHAR(80) NOT NULL,
  record_id VARCHAR(40) NOT NULL,
  field_changed VARCHAR(80) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  action VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aud_rec (module, record_id),
  CONSTRAINT fk_aud_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(80) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE id_sequences (
  entity VARCHAR(50) PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO id_sequences (entity, last_number) VALUES
('EMP',0),('CUS',0),('LEAD',0),('PROD',0),('ORD',0),
('PAY',0),('RET',0),('UNIT',0),('QR',0),('QRNUM',0),('FU',0),
('INVTX',0),('PAYROLL',0),('INV',0),('REO',0);

SET FOREIGN_KEY_CHECKS = 1;
