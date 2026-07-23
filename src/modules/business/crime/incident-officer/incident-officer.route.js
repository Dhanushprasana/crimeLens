'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./incident-officer.controller');

router.post('/', controller.assignOfficer);
router.get('/byIncident/:incidentId', controller.getOfficersByIncident);
router.get('/byOfficer/:officerId', controller.getIncidentsByOfficer);
router.delete('/:id', controller.removeOfficer);

module.exports = router;
