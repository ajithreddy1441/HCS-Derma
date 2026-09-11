const STATE_MAP = {
  AP: 'Andhra Pradesh',
  TS: 'Telangana',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  KA: 'Karnataka',
  KL: 'Kerala',
  MH: 'Maharashtra',
  GJ: 'Gujarat',
  RJ: 'Rajasthan',
  MP: 'Madhya Pradesh',
  UP: 'Uttar Pradesh',
  DL: 'Delhi',
  HR: 'Haryana',
  PB: 'Punjab',
  WB: 'West Bengal',
  OR: 'Odisha',
  OD: 'Odisha',
  BR: 'Bihar',
  JH: 'Jharkhand',
  CG: 'Chhattisgarh',
  GA: 'Goa',
  AS: 'Assam',
};

function trim(v) {
  return v == null ? '' : String(v).trim();
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeState(state) {
  const t = trim(state);
  if (!t) return '';
  const mapped = STATE_MAP[t.toUpperCase()];
  if (mapped) return mapped;
  const lower = t.toLowerCase();
  const found = Object.values(STATE_MAP).find((s) => s.toLowerCase() === lower);
  return found || t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstLast(name) {
  const parts = trim(name || 'Customer').split(/\s+/);
  return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') || parts[0] || 'Customer' };
}

function parseBlob(blob) {
  const text = trim(blob);
  const pin = (text.match(/\b(\d{6})\b/) || [])[1] || '';
  const parts = text.split(/[,|\n]+/).map((s) => s.trim()).filter(Boolean);
  let state = '';
  let city = '';
  const street = [];
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i].replace(/\b\d{6}\b/g, '').trim();
    if (!p) continue;
    const asState = normalizeState(p);
    const isState = Boolean(STATE_MAP[p.toUpperCase()]) || Object.values(STATE_MAP).some((s) => s.toLowerCase() === p.toLowerCase());
    if (isState) {
      state = asState;
      continue;
    }
    street.push(p);
  }
  if (street.length) city = street[street.length - 1];
  const address = street.length > 1 ? street.slice(0, -1).join(', ') : street[0] || text.replace(/\b\d{6}\b/, '').trim();
  return { address, city, state, pin };
}

function splitLines(text, max = 80) {
  const s = trim(text);
  if (s.length <= max) return { line1: s || 'Address', line2: '' };
  const cut = s.lastIndexOf(' ', max);
  const at = cut > 40 ? cut : max;
  return { line1: s.slice(0, at).trim(), line2: s.slice(at).trim().slice(0, 110) };
}

function resolveShipTo(order = {}, customer = {}) {
  const blob = [order.shipping_address, customer.address, order.address].filter(Boolean).join(', ');
  const parsed = parseBlob(blob);
  const address = trim(customer.address) || trim(order.shipping_address) || parsed.address;
  let city = trim(customer.city) || trim(order.shipping_city) || parsed.city;
  const state = normalizeState(customer.state || order.shipping_state || parsed.state);
  if (state && city && normalizeState(city) === state) city = parsed.city && normalizeState(parsed.city) !== state ? parsed.city : city;
  let pin = digits(customer.pincode || order.shipping_pincode || parsed.pin);
  if (pin.length > 6) pin = pin.slice(-6);
  const name = trim(order.shipping_name) || trim(customer.name) || 'Customer';
  let phone = digits(order.shipping_mobile || customer.mobile);
  if (phone.length > 10) phone = phone.slice(-10);
  const email = trim(order.shipping_email) || trim(customer.email);
  const lines = splitLines(address, 80);
  return {
    address: lines.line1,
    address2: lines.line2 || trim(customer.store_name),
    city,
    state,
    pin,
    names: firstLast(name),
    phone,
    email,
    store: trim(customer.store_name),
  };
}

module.exports = { STATE_MAP, trim, digits, normalizeState, firstLast, parseBlob, resolveShipTo, splitLines };
