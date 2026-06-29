'use strict';

const express = require('express');
const router = express.Router();

const controller =
  require('./criminal-profiling.controller');

router.post(
  '/:criminalId/generate',
  controller.generateProfile
);

router.get(
  '/:criminalId/risk-factors',
  controller.getRiskFactors
);

router.get(
  '/:criminalId',
  controller.getProfile
);

module.exports = router;