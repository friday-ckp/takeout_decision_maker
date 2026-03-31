const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDailyConfig, patchDailyConfig } = require('../controllers/dailyConfigController');

router.use(requireAuth);
router.get('/', getDailyConfig);
router.patch('/', patchDailyConfig);

module.exports = router;
