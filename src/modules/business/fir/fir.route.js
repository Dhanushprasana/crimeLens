'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./fir.controller');

router.post('/', controller.addFir);
router.get('/getAll', controller.getAllFir);
router.get('/getOneFir/:id', controller.getOneFir);
router.put('/:id', controller.updateFir);
router.delete('/:id', controller.deleteFir);

module.exports = router;
