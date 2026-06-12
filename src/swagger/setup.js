/**
 * Mount Swagger UI and raw OpenAPI JSON.
 * Disabled in test mode (NODE_ENV=test).
 */
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi');

const mountSwagger = (app) => {
  const spec = { ...openapiSpec };

  // By default the spec has NO `servers`, so Swagger UI calls the same origin
  // it's served from (no Servers dropdown). Optionally pin one explicit server
  // via SWAGGER_SERVER_URL.
  if (process.env.SWAGGER_SERVER_URL) {
    spec.servers = [{ url: process.env.SWAGGER_SERVER_URL, description: 'Configured server' }];
  }

  app.get('/api-docs.json', (req, res) => {
    res.json(spec);
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'HalalWalls API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );
};

module.exports = { mountSwagger, openapiSpec };
