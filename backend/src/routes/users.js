const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getMe, patchMe } = require('../controllers/usersController');

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, patchMe);

module.exports = router;
