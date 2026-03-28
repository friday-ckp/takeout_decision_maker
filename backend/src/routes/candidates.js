const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const { getCandidates, getMinesweepCandidates } = require('../controllers/candidatesController');

router.use(requireUserId);
router.get('/',     getCandidates);
router.get('/mine', getMinesweepCandidates);

module.exports = router;
