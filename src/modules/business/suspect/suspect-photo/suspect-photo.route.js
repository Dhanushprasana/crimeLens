'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./suspect-photo.controller');

router.post('/', controller.addSuspectPhoto);
router.get('/bySuspect/:suspectId', controller.getPhotosBySuspect);
router.delete('/:id', controller.deleteSuspectPhoto);

module.exports = router;
