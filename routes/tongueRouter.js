const express = require('express');
const router = express.Router();
const tongueController = require('../controllers/tongueController');

router.get('/getTop4TongueConditions', tongueController.getTop4TongueConditions);

module.exports = router;