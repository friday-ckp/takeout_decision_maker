const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 40101,
      message: '未登录',
      data: null,
    });
  }

  const token = authHeader.slice(7); // remove 'Bearer '

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.userId = payload.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 40102,
        message: '登录已过期，请重新登录',
        data: null,
      });
    }
    return res.status(401).json({
      code: 40101,
      message: '未登录',
      data: null,
    });
  }
}

// ── optionalAuth ─────────────────────────────────────────────────────────
// 有 token → 解析并设置 req.userId；无 token 或 token 无效 → req.userId=null，继续
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.userId = null;
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.userId = payload.userId;
  } catch (_) {
    req.userId = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
