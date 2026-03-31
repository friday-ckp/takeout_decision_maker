const express = require('express');
const router = express.Router();

// health check
router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'healthy' } });
});

router.use('/restaurants',  require('./restaurants'));
router.use('/candidates',   require('./candidates'));
router.use('/daily-config', require('./dailyConfig'));
router.use('/history',      require('./history'));
router.use('/settings',     require('./settings'));
router.use('/sessions',     require('./sessions'));
router.use('/auth',         require('./auth'));

module.exports = router;
