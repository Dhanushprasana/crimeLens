const fs = require('fs');
const filepath = 'src/modules/seed-data/data/police-officer/police_officer.json';
const data = fs.readFileSync(filepath, 'utf8');
console.log('Read ' + data.length + ' bytes');
const officers = JSON.parse(data);
const validStations = [
  'H.S.R.Layout PS', 'Madiwala PS', 'Whitefield PS',
  'Hubballi SubUrban PS', 'Dharwad Rural PS', 'Ashoknagar PS',
  'Mangaluru North PS', 'Mangaluru South PS', 'Surathkal PS',
  'Mysore South PS', 'Udayagiri PS'
];
officers.forEach((o, i) => { o.station_name = validStations[i % validStations.length]; });
fs.writeFileSync(filepath, JSON.stringify(officers, null, 2));
console.log('Updated ' + officers.length + ' officers.');
