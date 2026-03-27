function requireUserId(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(400).json({
      code: 40001,
      message: '缺少 X-User-Id',
      data: null,
    });
  }
  req.userId = parseInt(userId, 10);
  next();
}

module.exports = { requireUserId };
