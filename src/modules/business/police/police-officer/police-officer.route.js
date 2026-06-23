'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./police-officer.controller');

router.post('/', controller.createOfficer);
router.get('/getAll', controller.getAllOfficers);
router.get('/getOneOfficer/:id', controller.getOneOfficer);
router.put('/:id', controller.updateOfficer);
router.delete('/:id', controller.softDeleteOfficer);

// Ranks
router.post('/ranks', controller.createRank);
router.get('/ranks', controller.getAllRanks);
router.delete('/ranks/:id', controller.deleteRank);

module.exports = router;
