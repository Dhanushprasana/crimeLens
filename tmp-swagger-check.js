const swaggerJSDoc = require("swagger-jsdoc");
const path = require("path");

const file = path.resolve("src/modules/seed-data/swagger/seed-data.swagger.js");
const spec = swaggerJSDoc({
  definition: { openapi: "3.0.0", info: { title: "x", version: "1" } },
  apis: [file],
});

console.log("paths:", Object.keys(spec.paths || {}));
console.log(JSON.stringify(spec.paths || {}, null, 2));
