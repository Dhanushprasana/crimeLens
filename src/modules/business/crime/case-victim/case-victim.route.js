'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./case-victim.controller');

router.post('/', controller.addVictim);
router.get('/byIncident/:incidentId', controller.getVictimsByIncident);
router.get('/:id', controller.getOneVictim);
router.put('/:id', controller.updateVictim);
router.delete('/:id', controller.deleteVictim);

module.exports = router;
