const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const c = require('../controllers/sessionsController');

// 创建会话（需要用户身份）
router.post('/', requireAuth, c.createSession);

// 获取会话状态（无需身份）
router.get('/:token/state', c.getSessionState);

// 加入会话（可选身份：已登录用户自动加入，匿名用户创建临时账户）
router.post('/:token/join', optionalAuth, c.joinSession);

// 以下需要会话发起人身份
router.post('/:token/start',   requireAuth, c.startSession);
router.post('/:token/confirm', c.confirmSession);
router.post('/:token/replay',  requireAuth, c.replaySession);

module.exports = router;
