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
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}

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
