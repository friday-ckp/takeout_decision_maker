const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const { getCandidates } = require('../controllers/candidatesController');

router.use(requireUserId);
router.get('/', getCandidates);

module.exports = router;
