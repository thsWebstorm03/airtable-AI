const express = require("express");
const router = express.Router();

const pointsRouter = require('./routes/pointsRouter');
const tongueRouter = require('./routes/tongueRouter');

router.get('/', (req, res) => {
   return res.send("Hello world");
})
router.use('/api/points', pointsRouter);
router.use('/api/tongue', tongueRouter);

module.exports = router;