'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./criminal.controller');

router.post('/', controller.addCriminal);
router.get('/getAll', controller.getAllCriminals);
router.get('/:id', controller.getOneCriminal);
router.put('/:id', controller.updateCriminal);
router.delete('/:id', controller.deleteCriminal);

module.exports = router;
