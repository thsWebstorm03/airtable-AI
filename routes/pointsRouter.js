const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const newAlgoController = require('../controllers/newAlgoController');

router.get('/getPoints', pointsController.getPoints);
// router.get('/tracker', newAlgoController.calculate);

module.exports = router;