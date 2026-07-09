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

// Manual CORS middleware — sets headers directly on the response object.
// This is necessary because Catalyst AppSail's reverse proxy may intercept
// OPTIONS preflight requests before they reach Express, stripping CORS headers.
// By writing headers manually and terminating OPTIONS here, we ensure the
// browser always receives a valid preflight response.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed = origin && allowedOrigins.some(allowed => {
    return origin === allowed || origin.startsWith(allowed);
  });

  if (isAllowed || process.env.NODE_ENV !== 'production') {
    // Echo back the exact origin — required when credentials: true
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With');

  // Terminate preflight immediately — don't let it reach other middleware
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

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
