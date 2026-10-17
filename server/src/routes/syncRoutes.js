const express = require('express');
const router = express.Router();
const { syncBatch } = require('../controllers/syncController');

// Batch synchronization endpoint for offline replay
router.post('/batch', syncBatch);

module.exports = router;
