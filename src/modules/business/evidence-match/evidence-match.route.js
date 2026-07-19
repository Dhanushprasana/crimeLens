'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('./evidence-match.controller');

// POST   /evidence-matches                     → create a new match
router.post('/',                                controller.create);

// GET    /evidence-matches                     → list all matches
router.get('/',                                 controller.getAll);

// GET    /evidence-matches/:id                 → get one match by ROWID
router.get('/:id',                              controller.getById);

// GET    /evidence-matches/source/:sourceId    → get all matches for a source evidence
router.get('/source/:sourceId',                 controller.getBySourceEvidence);

// PUT    /evidence-matches/:id                 → update a match
router.put('/:id',                              controller.update);

// DELETE /evidence-matches/:id                 → delete a match
router.delete('/:id',                           controller.remove);

module.exports = router;
