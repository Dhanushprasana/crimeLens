const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'src', 'modules', 'seed-data', 'data');

// Data sources
const crimeIncidentPath = path.join(basePath, 'crimie', 'crime_incident.json');
const policeOfficerPath = path.join(basePath, 'police-officer', 'police_officer.json');

// Outputs
const suspectPath = path.join(basePath, 'suspect', 'suspect.json');
const victimPath = path.join(basePath, 'victim', 'victim.json');
const witnessPath = path.join(basePath, 'witness', 'witness.json');
const incidentOfficerPath = path.join(basePath, 'incident-officer', 'incident_officer.json');

// Helpers for generation
const firstNames = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Siddharth", "Rohan", "Rahul", "Karan", "Ravi", "Suresh", "Ramesh", "Kavita", "Priya", "Anjali", "Sneha", "Pooja", "Neha", "Meena", "Sita", "Geeta", "Ram", "Shyam", "Vikram", "Ajay", "Vijay"];
const lastNames = ["Kumar", "Singh", "Sharma", "Yadav", "Gupta", "Patel", "Reddy", "Nair", "Iyer", "Pillai", "Das", "Bose", "Chakraborty", "Menon", "Rajan", "Deshmukh", "Joshi", "Kulkarni", "Chauhan", "Rajput"];
const genders = ["M", "F"];
const occupations = ["Software Engineer", "Teacher", "Businessman", "Shopkeeper", "Farmer", "Student", "Unemployed", "Driver", "Doctor", "Banker"];
const injuryTypes = ["None", "Minor Bruises", "Fracture", "Severe", "Critical", "Laceration"];
const witnessTypes = ["EYEWITNESS", "CHARACTER", "EXPERT", "POLICE"];
const statuses = ["ACTIVE", "INACTIVE", "ARRESTED", "ABSCONDING"];
const districts = ["KA-21", "KA-26", "KA-05", "KA-28", "KA-09", "KA-23", "KA-22", "KA-24"]; 

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${randomChoice(firstNames)} ${randomChoice(lastNames)}`;
}

function randomNumberStr(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

async function generateData() {
  console.log("Loading source data...");
  const crimeIncidents = JSON.parse(fs.readFileSync(crimeIncidentPath, 'utf8'));
  const policeOfficers = JSON.parse(fs.readFileSync(policeOfficerPath, 'utf8'));
  
  console.log(`Loaded ${crimeIncidents.length} crime incidents and ${policeOfficers.length} police officers.`);
  
  const limit = Math.min(crimeIncidents.length, 10000);
  const incidentsSubset = crimeIncidents.slice(0, limit);
  
  const suspects = [];
  const victims = [];
  const witnesses = [];
  const incidentOfficers = [];
  
  console.log("Generating Suspects...");
  for (let i = 0; i < 5000; i++) {
    suspects.push({
      suspect_number: `SUS-${String(i+1).padStart(6, '0')}`,
      full_name: randomName(),
      gender: randomChoice(genders),
      date_of_birth: randomDate(new Date(1960, 0, 1), new Date(2005, 0, 1)),
      nationality: "Indian",
      status: randomChoice(statuses),
      address: `Random Address ${i}, Bangalore`,
      district_code: randomChoice(districts)
    });
  }

  console.log("Generating Victims, Witnesses, and Incident Officers...");
  for (let i = 0; i < incidentsSubset.length; i++) {
    const incident = incidentsSubset[i];
    const crimeNo = incident.crime_number || incident.crimeNo;
    if (!crimeNo) continue;
    
    // 1 to 2 victims
    const numVictims = Math.floor(Math.random() * 2) + 1;
    for (let v = 0; v < numVictims; v++) {
      victims.push({
        crime_number: crimeNo,
        full_name: randomName(),
        gender: randomChoice(genders),
        mobile_number: "9" + randomNumberStr(9),
        email: `victim${victims.length}@example.com`,
        address: `Victim Address ${victims.length}, Karnataka`,
        occupation: randomChoice(occupations),
        injury_type: randomChoice(injuryTypes),
        medical_report_number: Math.random() > 0.5 ? `MED-${randomNumberStr(6)}` : null,
        alive: Math.random() > 0.05
      });
    }

    // 0 to 2 witnesses
    const numWitnesses = Math.floor(Math.random() * 3);
    for (let w = 0; w < numWitnesses; w++) {
      witnesses.push({
        crime_number: crimeNo,
        full_name: randomName(),
        gender: randomChoice(genders),
        age: Math.floor(Math.random() * 50) + 18,
        mobile_number: "8" + randomNumberStr(9),
        email: `witness${witnesses.length}@example.com`,
        address: `Witness Address ${witnesses.length}, Karnataka`,
        occupation: randomChoice(occupations),
        witness_type: randomChoice(witnessTypes),
        statement: `I witnessed the incident regarding ${crimeNo}.`
      });
    }

    // Assign 1 officer
    const officer = randomChoice(policeOfficers);
    if (officer && officer.badge_number) {
      incidentOfficers.push({
        crime_number: crimeNo,
        badge_number: officer.badge_number
      });
    }
  }

  console.log(`Saving ${suspects.length} suspects, ${victims.length} victims, ${witnesses.length} witnesses, ${incidentOfficers.length} incident officers...`);
  fs.writeFileSync(suspectPath, JSON.stringify(suspects, null, 2), 'utf8');
  fs.writeFileSync(victimPath, JSON.stringify(victims, null, 2), 'utf8');
  fs.writeFileSync(witnessPath, JSON.stringify(witnesses, null, 2), 'utf8');
  fs.writeFileSync(incidentOfficerPath, JSON.stringify(incidentOfficers, null, 2), 'utf8');
  
  console.log("Done!");
}

generateData().catch(console.error);
