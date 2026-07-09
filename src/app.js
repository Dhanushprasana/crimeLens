'use strict';

const express = require('express');
const cors = require('cors');
const catalystClient = require('./catalyst/catalyst.client');
const loggerMiddleware = require('./middleware/logger.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const routes = require('./routes');
const setupSwagger = require('./config/swagger');

const app = express();

// CORS configuration to support credentials (cookies/auth headers)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://crimelens-upxftzmq.onslate.in',
  'https://crime-lens.onslate.in',
];
if (process.env.CALLBACK_URL) {
  allowedOrigins.push(process.env.CALLBACK_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      return origin === allowed || origin.startsWith(allowed);
    });

    if (isAllowed || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Explicitly handle OPTIONS preflight for all routes BEFORE other middleware.
// This is required on platforms like Catalyst AppSail where the reverse proxy
// may not forward preflight responses correctly.
app.options('/*splat', cors(corsOptions));

app.use(cors(corsOptions));

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
