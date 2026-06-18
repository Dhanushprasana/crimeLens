'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./crime.controller');

router.post('/', controller.addCrime);
router.get('/getAll', controller.getAllCrimes);
router.get('/:id', controller.getOneCrime);
router.put('/:id', controller.updateCrime);
router.delete('/:id', controller.deleteCrime);

module.exports = router;
