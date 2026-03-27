const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const { createHistory } = require('../controllers/historyController');

router.use(requireUserId);
router.post('/', createHistory);

module.exports = router;
