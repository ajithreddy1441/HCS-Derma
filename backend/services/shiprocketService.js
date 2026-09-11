const env = require('../config/env');
const { query } = require('../config/db');
const { digits, normalizeState, resolveShipTo } = require('../utils/shipAddress');

let cachedToken = null;
let tokenExp = 0;
let tokenFor = '';

async function loadSettingsMap() {
  try {
    const rows = await query('SELECT setting_key, setting_value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  } catch {
    return {};
  }
}

async function loadCredentials() {
  const map = await loadSettingsMap();
  return {
    email: map.shiprocket_email || env.shiprocket.email,
    password: map.shiprocket_password || env.shiprocket.password,
    pickup: map.shiprocket_pickup && !/^(primary|home)$/i.test(map.shiprocket_pickup)
      ? map.shiprocket_pickup
      : env.shiprocket.pickup || 'work',
    companyName: map.company_name || 'HCS DERMA',
    companyPhone: map.company_phone || '',
    pickupAddress: map.shiprocket_pickup_address || '',
    pickupCity: map.shiprocket_pickup_city || '',
    pickupState: map.shiprocket_pickup_state || '',
    pickupPin: map.shiprocket_pickup_pin || '',
    pickupPhone: map.shiprocket_pickup_phone || map.company_phone || '',
  };
}

async function getToken() {
  const { email, password } = await loadCredentials();
  if (!email || !password) return null;
  const key = `${email}:${password}`;
  if (cachedToken && Date.now() < tokenExp && tokenFor === key) return cachedToken;
  const res = await fetch(`${env.shiprocket.baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.token) {
    throw Object.assign(new Error(data.message || 'Shiprocket login failed. Check email and password in Settings.'), {
      status: 502,
    });
  }
  cachedToken = data.token;
  tokenFor = key;
  tokenExp = Date.now() + 9 * 24 * 3600 * 1000;
  return cachedToken;
}

async function api(path, method, body) {
  const token = await getToken();
  if (!token) {
    return { mock: true, message: 'Shiprocket credentials not configured' };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25000);
  let res;
  try {
    res = await fetch(`${env.shiprocket.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw Object.assign(new Error('Shiprocket did not respond in time. Try again.'), { status: 504 });
    }
    throw Object.assign(new Error('Could not reach Shiprocket. Check internet and try again.'), { status: 502 });
  }
  clearTimeout(timer);
  const data = await res.json().catch(() => ({}));
  return data;
}

function formatSrMessage(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(formatSrMessage).filter(Boolean).join(' ');
  if (typeof message === 'object') {
    return Object.entries(message)
      .map(([k, v]) => `${k}: ${formatSrMessage(v)}`)
      .join('; ');
  }
  return String(message);
}

function collectPickupRecords(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((item) => collectPickupRecords(item, out));
    return out;
  }
  if (typeof node === 'object') {
    const name = node.pickup_location || node.pickup_location_name;
    if (name && typeof name === 'string') out.push(node);
    Object.values(node).forEach((v) => {
      if (v && typeof v === 'object') collectPickupRecords(v, out);
    });
  }
  return out;
}

function pickupNames(listed) {
  return [...new Set(collectPickupRecords(listed).map((a) => a.pickup_location || a.pickup_location_name).filter(Boolean))];
}

function pickPickupName(listed, preferred) {
  const records = collectPickupRecords(listed);
  const names = pickupNames(listed);
  const want = String(preferred || 'work').trim();
  const exact = names.find((n) => n.toLowerCase() === want.toLowerCase());
  if (exact) return exact;
  const primary = records.find((r) => r.primary || r.is_primary || r.status === 2 || String(r.pickup_location).toLowerCase() === 'work');
  if (primary?.pickup_location) return primary.pickup_location;
    if (names.length) return names[0];
  if (/^(primary|home)$/i.test(want)) return 'work';
  return want || 'work';
}

function orderDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function addPickupLocation(w) {
  return api('/settings/company/addpickup', 'POST', {
    pickup_location: w.nickname,
    name: w.name,
    email: w.email,
    phone: Number(w.phone),
    address: String(w.address || '').slice(0, 80),
    address_2: String(w.address2 || '').slice(0, 80),
    city: w.city,
    state: normalizeState(w.state),
    country: 'India',
    pin_code: Number(w.pin),
    lat: 16.8606,
    long: 81.9295,
  });
}

function pickupOk(added) {
  if (!added || added.mock) return false;
  const msg = formatSrMessage(added.message);
  if (/already exist/i.test(msg)) return true;
  return Boolean(
    added.success === true ||
      added.success === 1 ||
      added.status === 1 ||
      added.pickup_id ||
      added.id ||
      added.address_id ||
      added.data?.id ||
      added.data?.pickup_id
  );
}

async function ensurePickup(_ship) {
  const creds = await loadCredentials();
  const listed = await api('/settings/company/pickup', 'GET');
  return pickPickupName(listed, creds.pickup || 'work');
}

function extractLocationNames(obj) {
  const names = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.length && node.every((x) => typeof x === 'string')) {
        node.forEach((s) => {
          if (s.length >= 2 && s.length <= 36) names.push(s.trim());
        });
        return;
      }
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    const v = node.pickup_location || node.pickup_location_name;
    if (typeof v === 'string' && v.length >= 2 && v.length <= 36 && !v.includes('\n')) names.push(v.trim());
    Object.values(node).forEach((child) => {
      if (child && typeof child === 'object') walk(child);
    });
  };
  walk(obj);
  return [...new Set(names)];
}

function isCreated(result) {
  return Boolean(result && (result.order_id || result.shipment_id || result.status_code === 1 || result.status === 1));
}

async function createShipment(order, customer, items) {
  const ship = resolveShipTo(order || {}, customer || {});
  if (!ship.address || !ship.city || !ship.state || ship.pin.length !== 6 || ship.phone.length !== 10) {
    throw Object.assign(
      new Error(
        `Delivery address is incomplete for Shiprocket. Using: address="${ship.address || ''}", city="${ship.city || ''}", state="${ship.state || ''}", pincode="${ship.pin || ''}", mobile="${ship.phone || ''}". Fill these on the customer, then Confirm.`
      ),
      { status: 400 }
    );
  }
  const listed = await api('/settings/company/pickup', 'GET');
  const creds = await loadCredentials();
  const tryNames = [
    ...new Set(
      ['work', creds.pickup, pickPickupName(listed, 'work'), ...extractLocationNames(listed)].filter(Boolean)
    ),
  ];
  const payload = {
    order_id: String(order.public_id),
    order_date: orderDate(order.order_date || order.created_at),
    billing_customer_name: ship.names.first,
    billing_last_name: ship.names.last,
    billing_address: ship.address,
    billing_address_2: ship.address2 || ship.store || '',
    billing_city: ship.city,
    billing_pincode: Number(ship.pin),
    billing_state: ship.state,
    billing_country: 'India',
    billing_email: ship.email || `${ship.phone}@customer.hcsderma.com`,
    billing_phone: Number(ship.phone),
    shipping_is_billing: true,
    shipping_customer_name: ship.names.first,
    shipping_last_name: ship.names.last,
    shipping_address: ship.address,
    shipping_address_2: ship.address2 || ship.store || '',
    shipping_city: ship.city,
    shipping_pincode: Number(ship.pin),
    shipping_state: ship.state,
    shipping_country: 'India',
    shipping_email: ship.email || `${ship.phone}@customer.hcsderma.com`,
    shipping_phone: Number(ship.phone),
    order_items: items.map((i) => ({
      name: i.product_name || i.sku,
      sku: String(i.sku || 'SKU'),
      units: Number(i.quantity) || 1,
      selling_price: Number(i.unit_price) || 0,
    })),
    payment_method: Number(order.payment_amount) > 0 || order.payment_status === 'approved' ? 'Prepaid' : 'COD',
    sub_total: Number(order.total) || 0,
    length: 10,
    breadth: 10,
    height: 10,
    weight: Math.max(0.5, items.reduce((w, i) => w + Number(i.quantity || 1) * 0.5, 0)),
  };

  let result = {};
  const tried = [];
  for (let i = 0; i < tryNames.length; i += 1) {
    const name = tryNames[i];
    if (!name || tried.includes(name)) continue;
    tried.push(name);
    result = await api('/orders/create/adhoc', 'POST', { ...payload, pickup_location: name });
    if (result.mock) return { ...result, payload: { ...payload, pickup_location: name } };
    if (isCreated(result)) return result;
    extractLocationNames(result).forEach((n) => {
      if (n && !tryNames.includes(n)) tryNames.push(n);
    });
  }

  const msg = formatSrMessage(result.message) || 'Shiprocket rejected the order';
  throw Object.assign(
    new Error(
      /wrong pickup location|billing\/shipping address first/i.test(msg)
        ? `Shiprocket did not accept pickup. Tried: ${tried.join(', ') || '(none)'}. Add/confirm nickname "work" in Pickup Addresses, then retry.`
        : msg
    ),
    { status: 502, details: result }
  );
}

async function trackAwb(awb) {
  return api(`/courier/track/awb/${awb}`, 'GET');
}

async function isConfigured() {
  const { email, password } = await loadCredentials();
  return Boolean(email && password);
}

module.exports = { createShipment, trackAwb, getToken, isConfigured, loadCredentials };
