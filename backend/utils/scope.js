function isAdmin(user) {
  return user.role === 'admin';
}

function ownOnly(user, employeeId) {
  if (isAdmin(user) || user.role === 'accountant') return true;
  return Number(employeeId) === Number(user.employee_id);
}

function dateFilter(query, column = 'created_at') {
  const { from, to, range } = query;
  const now = new Date();
  let start;
  let end;
  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (range === 'yesterday') {
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start = new Date(end);
    start.setDate(start.getDate() - 1);
  } else if (range === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (range === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (range === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  }
  if (from) start = new Date(from);
  if (to) {
    end = new Date(to);
    end.setDate(end.getDate() + 1);
  }
  if (!start && !end) return { sql: '', params: [] };
  if (start && end) return { sql: ` AND ${column} >= ? AND ${column} < ?`, params: [start, end] };
  if (start) return { sql: ` AND ${column} >= ?`, params: [start] };
  return { sql: ` AND ${column} < ?`, params: [end] };
}

function pagination(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { isAdmin, ownOnly, dateFilter, pagination };
