const express = require('express');
const router = express.Router();
const { suggestMerge } = require('../controllers/aiController');

// AI-powered merge suggestion
router.post('/suggest-merge', suggestMerge);

module.exports = router;
