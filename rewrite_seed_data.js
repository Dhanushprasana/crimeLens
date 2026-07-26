const fs = require("fs");
const path = require("path");

const root = __dirname;
const allowed = [
  {
    code: "KA-14",
    name: "Dharwad",
    stations: ["Dharwad Sub Urban PS", "Dharwad Town PS", "Vidyagiri PS"],
  },
  {
    code: "KA-10",
    name: "Chikmagalur",
    stations: ["Chikkamagalur Women PS", "Yagati PS", "Kadur PS"],
  },
  {
    code: "KA-23",
    name: "Mysore",
    stations: ["Narasimharaja PS", "V.V. Puram PS", "Vijayanagar PS"],
  },
  {
    code: "KA-11",
    name: "Mandya",
    stations: ["Halagur PS", "K.M. Doddi PS", "Besagaraghalli PS"],
  },
];

function rewriteRow(row, index) {
  const plan = allowed[index % allowed.length];
  const station = plan.stations[index % plan.stations.length];
  const updates = {
    district_code: plan.code,
    fir_district_code: plan.code,
    crime_happened_at_district_code: plan.code,
    districtCode: plan.code,
    district_code_of_criminal: plan.code,
    district_name: plan.name,
    districtName: plan.name,
    crime_happened_at_district_name: plan.name,
    police_station_name: station,
    police_station: station,
    station_name: station,
    fir_police_station_name: station,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (
      row &&
      typeof row === "object" &&
      Object.prototype.hasOwnProperty.call(row, key)
    ) {
      row[key] = value;
    }
  }
  return row;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function rewriteFile(relativePath) {
  const filePath = path.join(root, relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  const rewritten = data.map((row, index) => rewriteRow(row, index));
  writeJson(filePath, rewritten);
  return rewritten;
}

function createChunks(baseName, rows) {
  const chunkSize = Math.ceil(rows.length / 10);
  const dir = path.join(root, "src/modules/seed-data/data/crimie");
  for (let i = 0; i < 10; i += 1) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, rows.length);
    const chunk = rows.slice(start, end);
    const outPath = path.join(dir, `${baseName}-${i + 1}.json`);
    writeJson(outPath, chunk);
  }
}

const firs = rewriteFile("src/modules/seed-data/data/crimie/FIRs.json");
const incidents = rewriteFile(
  "src/modules/seed-data/data/crimie/crime_incident.json",
);
rewriteFile("src/modules/seed-data/data/police-officer/police_officer.json");
createChunks("FIRs", firs);
createChunks("crime_incident", incidents);

console.log(
  JSON.stringify(
    {
      firs: firs.length,
      incidents: incidents.length,
      policeOfficers: 200,
      firChunks: 10,
      incidentChunks: 10,
    },
    null,
    2,
  ),
);
