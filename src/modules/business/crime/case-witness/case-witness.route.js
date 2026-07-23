'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./case-witness.controller');

router.post('/', controller.addWitness);
router.get('/byIncident/:incidentId', controller.getWitnessesByIncident);
router.get('/:id', controller.getOneWitness);
router.put('/:id', controller.updateWitness);
router.delete('/:id', controller.deleteWitness);

module.exports = router;
