const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const { getDailyConfig, patchDailyConfig } = require('../controllers/dailyConfigController');

router.use(requireUserId);
router.get('/', getDailyConfig);
router.patch('/', patchDailyConfig);

module.exports = router;
