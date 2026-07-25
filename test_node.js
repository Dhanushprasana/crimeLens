
console.log("Starting...");
try {
  const inc = require("./src/modules/seed-data/data/crimie/crime_incident.json");
  console.log("Incidents loaded:", inc.length);
} catch (e) {
  console.error(e);
}
