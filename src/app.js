"use strict";

const express = require("express");
const cors = require("cors");
const catalystClient = require("./catalyst/catalyst.client");
const loggerMiddleware = require("./middleware/logger.middleware");
const errorMiddleware = require("./middleware/error.middleware");
const routes = require("./routes");
const setupSwagger = require("./config/swagger");

const app = express();

// CORS configuration to support credentials (cookies/auth headers)
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://crimelens-upxftzmq.onslate.in",
  "https://crime-lens.onslate.in",
];

if (process.env.CALLBACK_URL) {
  allowedOrigins.push(process.env.CALLBACK_URL);
}

const corsOptions = {
  origin(origin, callback) {
    // Allow Postman/curl/server-to-server requests
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
  ],
};

// Handle preflight requests without using route patterns that path-to-regexp
// may reject. Invoke the cors middleware directly for OPTIONS requests.
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return cors(corsOptions)(req, res, next);
  }
  return next();
});

// Handle actual requests
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
app.use("/", routes);

// Error handler (must be last)
app.use(errorMiddleware);

module.exports = app;
