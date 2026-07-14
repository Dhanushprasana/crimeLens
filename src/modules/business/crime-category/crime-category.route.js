'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./crime-category.controller');

router.post('/', controller.addCrimeCategory);
router.get('/', controller.getAllCrimeCategories);
router.get('/:id', controller.getOneCrimeCategory);
router.put('/:id', controller.updateCrimeCategory);
router.delete('/:id', controller.deleteCrimeCategory);

module.exports = router;
