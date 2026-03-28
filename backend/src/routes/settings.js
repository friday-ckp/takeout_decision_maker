const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const { getSettings, patchSettings } = require('../controllers/settingsController');

router.use(requireUserId);
router.get('/',   getSettings);
router.patch('/', patchSettings);

module.exports = router;
