function success(res, message, data = {}, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

module.exports = { success, fail };
