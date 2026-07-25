
const fs = require("fs");
const path = require("path");

const FIR_PATH = path.join(__dirname, "src/modules/seed-data/data/crimie/FIRs.json");
const INCIDENT_PATH = path.join(__dirname, "src/modules/seed-data/data/crimie/crime_incident.json");

const firs = require(FIR_PATH);
const incidents = require(INCIDENT_PATH);

const allowedStations = [
  "H.S.R.Layout PS", "Madiwala PS", "Whitefield PS",
  "Hubballi SubUrban PS", "Dharwad Rural PS", "Ashoknagar PS",
  "Mangaluru North PS", "Mangaluru South PS", "Surathkal PS",
  "Mysore South PS", "Udayagiri PS"
];

let filteredIncidents = incidents.filter(inc => allowedStations.includes(inc.police_station));

const firMap = new Map();
firs.forEach(fir => firMap.set(fir.fir_number, fir));

const newFirs = [];
let firCounter = 100000;

filteredIncidents.forEach(inc => {
  if (!inc.fir_number) {
    inc.fir_number = `FIR-NEW-${firCounter++}`;
    inc.fir_police_station_name = inc.police_station;
    inc.fir_district_code = inc.crime_happened_at_district_code;
    
    newFirs.push({
      fir_number: inc.fir_number,
      complainant_name: "Generated Complainant",
      complainant_phone: "9999999999",
      incident_description: inc.description || "Generated FIR for incident",
      fir_status: "REGISTERED",
      assigned_officer_name: "Officer X",
      district_code: inc.crime_happened_at_district_code,
      police_station_name: inc.police_station
    });
  } else {
    const existingFir = firMap.get(inc.fir_number);
    if (existingFir) {
      newFirs.push(existingFir);
    } else {
      newFirs.push({
        fir_number: inc.fir_number,
        complainant_name: "Unknown",
        complainant_phone: "9999999999",
        incident_description: inc.description || "Recovered FIR for incident",
        fir_status: "REGISTERED",
        assigned_officer_name: "Officer X",
        district_code: inc.crime_happened_at_district_code,
        police_station_name: inc.police_station
      });
    }
  }
});

fs.writeFileSync(INCIDENT_PATH, JSON.stringify(filteredIncidents, null, 2));
fs.writeFileSync(FIR_PATH, JSON.stringify(newFirs, null, 2));
console.log(`Filtered incidents: ${filteredIncidents.length}, New FIRs: ${newFirs.length}`);
