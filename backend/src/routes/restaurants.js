const express = require('express');
const router = express.Router();
const { requireUserId } = require('../middleware/auth');
const { listRestaurants, createRestaurant } = require('../controllers/restaurantsController');

router.use(requireUserId);

router.get('/', listRestaurants);
router.post('/', createRestaurant);

module.exports = router;
