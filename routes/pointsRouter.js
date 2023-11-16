const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');

router.get('/getPoints', pointsController.getPoints);

module.exports = router;