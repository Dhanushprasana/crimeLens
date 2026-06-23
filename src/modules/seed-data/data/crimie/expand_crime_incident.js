// Generates expanded crime_incident JSON up to target size with unique crime_number and fir_number
"use strict";
const fs = require("fs");
const path = require("path");

const infile = path.join(__dirname, "crime_incident.json");
const outfile = path.join(__dirname, "crime_incident.expanded.json");
const TARGET = 80000;

function pad(n, width = 6) {
  return String(n).padStart(width, "0");
}
function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}
function randomDate(start, end) {
  const d = new Date(+start + Math.random() * (end - start));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

if (!fs.existsSync(infile)) {
  console.error("Input file not found:", infile);
  process.exit(1);
}

const text = fs.readFileSync(infile, "utf8");
let data;
try {
  data = JSON.parse(text);
} catch (err) {
  console.error("Failed to parse input JSON:", err.message || err);
  process.exit(1);
}

const existingCount = data.length;
console.log("Existing records:", existingCount);

// Build sets and counters to avoid duplicates
const crimeSet = new Set();
const firSet = new Set();
let maxCrimeNum = 0;
let maxFirNum = 0;

for (const r of data) {
  if (r && r.crime_number) {
    crimeSet.add(r.crime_number);
    const m = (r.crime_number.match(/(\d+)$/) || [])[0];
    if (m) maxCrimeNum = Math.max(maxCrimeNum, Number(m));
  }
  if (r && r.fir_number) {
    firSet.add(r.fir_number);
    const fm = (r.fir_number.match(/(\d+)$/) || [])[0];
    if (fm) maxFirNum = Math.max(maxFirNum, Number(fm));
  }
}

let nextCrime = maxCrimeNum + 1;
let nextFir = maxFirNum + 1;

const minDate = new Date("2018-01-01T00:00:00Z");
const maxDate = new Date();

// Clone and mutate samples until we hit target
while (data.length < TARGET) {
  const sample = data[Math.floor(Math.random() * existingCount)];
  const clone = JSON.parse(JSON.stringify(sample));

  // unique identifiers
  let cn = `CASE-${pad(nextCrime)}`;
  while (crimeSet.has(cn)) {
    nextCrime++;
    cn = `CASE-${pad(nextCrime)}`;
  }
  nextCrime++;
  crimeSet.add(cn);
  clone.crime_number = cn;

  let fn = `FIR-${pad(nextFir)}`;
  while (firSet.has(fn)) {
    nextFir++;
    fn = `FIR-${pad(nextFir)}`;
  }
  nextFir++;
  firSet.add(fn);
  clone.fir_number = fn;

  // randomise date/time
  clone.crime_occured_date_time = randomDate(minDate, maxDate);

  // jitter location slightly to avoid exact duplicates
  if (typeof clone.crime_location_latitude === "number") {
    clone.crime_location_latitude = +(
      clone.crime_location_latitude + randBetween(-0.02, 0.02)
    ).toFixed(6);
  }
  if (typeof clone.crime_location_longitude === "number") {
    clone.crime_location_longitude = +(
      clone.crime_location_longitude + randBetween(-0.02, 0.02)
    ).toFixed(6);
  }

  // ensure no accidental exact duplicate object
  // (crime_number uniqueness already ensures this)
  data.push(clone);

  if (data.length % 5000 === 0) {
    console.log("Generated", data.length, "records");
  }
}

// Write to outfile (non-destructive)
fs.writeFileSync(outfile, JSON.stringify(data, null, 2), "utf8");
console.log("Wrote", data.length, "records to", outfile);

// Quick validation
if (data.length !== TARGET) {
  console.error("Unexpected record count after generation:", data.length);
  process.exit(2);
}

// Verify crime_number uniqueness
const seen = new Set();
for (const r of data) {
  if (seen.has(r.crime_number)) {
    console.error("Duplicate crime_number found:", r.crime_number);
    process.exit(3);
  }
  seen.add(r.crime_number);
}
console.log("Validation passed: all crime_number values are unique");
process.exit(0);
