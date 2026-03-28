const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const c = require('../controllers/sessionsController');

// 创建会话（需要用户身份）
router.post('/', requireUserId, c.createSession);

// 获取会话状态（无需身份）
router.get('/:token/state', c.getSessionState);

// 加入会话（无需身份，创建临时用户）
router.post('/:token/join', c.joinSession);

// 以下需要会话发起人身份
router.post('/:token/start',   requireUserId, c.startSession);
router.post('/:token/confirm', c.confirmSession);
router.post('/:token/replay',  requireUserId, c.replaySession);

module.exports = router;
