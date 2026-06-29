'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./suspect.controller');

router.post('/', controller.addSuspect);
router.get('/getAll', controller.getAllSuspects);
router.get('/getOneSuspect/:id', controller.getOneSuspect);
router.put('/:id', controller.updateSuspect);
router.delete('/:id', controller.deleteSuspect);

module.exports = router;
