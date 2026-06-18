'use strict';

const express = require('express');
const catalystClient = require('./catalyst/catalyst.client');
const loggerMiddleware = require('./middleware/logger.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const routes = require('./routes');
const setupSwagger = require('./config/swagger');

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach Catalyst SDK to every request
app.use(catalystClient);

// Setup Swagger API docs UI
setupSwagger(app);

// Request logger
app.use(loggerMiddleware);

// API routes
app.use('/', routes);

// Error handler (must be last)
app.use(errorMiddleware);

module.exports = app;
