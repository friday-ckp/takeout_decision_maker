function success(res, data, message = 'ok', statusCode = 200) {
  return res.status(statusCode).json({ code: 0, message, data });
}

function fail(res, code, message, statusCode = 400) {
  return res.status(statusCode).json({ code, message, data: null });
}

module.exports = { success, fail };
