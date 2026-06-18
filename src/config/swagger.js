'use strict';

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CrimeLens BE Express API Documentation',
      version: '1.0.0',
      description: 'API Documentation for the CrimeLens Backend Express application, running under Zoho Catalyst.',
    },
    servers: [
      {
        url: '/',
        description: 'Default API path',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // Paths to files containing OpenAPI annotations
  apis: [
    './src/routes/*.js',
    './src/modules/scaffolding/**/swagger/*.js',
    './src/modules/business/**/swagger/*.js'
  ],
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

module.exports = setupSwagger;
