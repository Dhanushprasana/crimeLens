'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('./evidence-analysis.controller');

// GET /evidence-analysis?paths=url1,url2,url3
router.get('/', controller.getCrimesByEvidencePaths);

module.exports = router;
