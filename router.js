const express = require("express");
const router = express.Router();

const pointsRouter = require('./routes/pointsRouter');
const tongueRouter = require('./routes/tongueRouter');

router.use('/api/points', pointsRouter);
router.use('/api/tongue', tongueRouter);

module.exports = router;