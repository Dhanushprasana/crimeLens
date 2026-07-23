"use strict";

const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CrimeLens BE Express API Documentation",
      version: "1.0.0",
      description:
        "API Documentation for the CrimeLens Backend Express application, running under Zoho Catalyst.",
    },
    tags: [
      {
        name: "Seed Data",
        description: "Bootstrap and seed-related endpoints",
      },
      { name: "User Invites", description: "Invite and onboarding endpoints" },
      { name: "Users", description: "User management endpoints" },
      { name: "Police Officers", description: "Police officer management" },
      { name: "Police Ranks", description: "Police rank management" },
      { name: "Police Stations", description: "Police station management" },
      { name: "Crimes", description: "Crime incident endpoints" },
      { name: "FIRs", description: "FIR endpoints" },
      { name: "Criminals", description: "Criminal records" },
      { name: "Geo Data", description: "Geospatial/district data" },
      { name: "Profiling", description: "Criminal profiling and network analysis" },
      { name: "Network Analysis", description: "Generic graph traversal engine for intelligence investigation networks" },
      { name: "Evidence Match", description: "Evidence match linking and management" },
      { name: "Suspects", description: "Suspect management" },
      { name: "Suspect Photos", description: "Photos linked to suspects" },
      { name: "Incident Officers", description: "Officer assignments to crime incidents" },
      { name: "Case Witnesses", description: "Witnesses linked to crime incidents" },
      { name: "Case Victims", description: "Victims linked to crime incidents" },
    ],
    servers: [
      {
        url: "/",
        description: "Default API path",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  // Paths to files containing OpenAPI annotations
  apis: [
    "./src/routes/*.js",
    "./src/modules/forecast/swagger/*.js",
    "./src/modules/scaffolding/**/swagger/*.js",
    "./src/modules/business/**/swagger/*.js",
    "./src/modules/seed-data/swagger/*.js",
    "./src/modules/storage/swagger/*.js",
    "./src/modules/network-analysis/swagger/*.js",
    "./src/modules/business/**/*.swagger.js",
    "./src/modules/auth/swagger/*.js",
  ],
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  const swaggerUiOptions = {
    swaggerOptions: { filter: true },
    explorer: true,
  };
  app.use(
    "/api",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
  );
  app.get("/api.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

module.exports = setupSwagger;
