const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getCandidates, getMinesweepCandidates } = require('../controllers/candidatesController');

router.use(requireAuth);
router.get('/',     getCandidates);
router.get('/mine', getMinesweepCandidates);

module.exports = router;
