"use strict";

const express = require("express");
const catalystClient = require("./catalyst/catalyst.client");
const loggerMiddleware = require("./middleware/logger.middleware");
const errorMiddleware = require("./middleware/error.middleware");
const routes = require("./routes");
const setupSwagger = require("./config/swagger");

const app = express();

/**
 * ⚡ IMPORTANT FOR CATALYST APPSAIL DEPLOYMENTS:
 * Platform gateway injects 'Access-Control-Allow-Origin' automatically.
 * Manual express CORS middleware is removed here to prevent duplicate header values.
 * 
 * For localhost development, add an optional header backup ONLY if Catalyst local CLI 
 * environment doesn't inject it automatically.
 */
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
    
    if (origin && localOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");
    }
<<<<<<< HEAD
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
=======
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
>>>>>>> 181b2d05ca761df4ad3e13ca5886d07c0c9d6f10

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
app.use("/", routes);

// Error handler (must be last)
app.use(errorMiddleware);

module.exports = app;
