const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createHistory, listHistory } = require('../controllers/historyController');

router.use(requireAuth);
router.get('/',  listHistory);
router.post('/', createHistory);

module.exports = router;
