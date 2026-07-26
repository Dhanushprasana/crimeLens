import json
from pathlib import Path

root = Path(__file__).resolve().parent
allowed = [
    {
        'code': 'KA-14',
        'name': 'Dharwad',
        'stations': ['Dharwad Sub Urban PS', 'Dharwad Town PS', 'Vidyagiri PS'],
    },
    {
        'code': 'KA-10',
        'name': 'Chikmagalur',
        'stations': ['Chikkamagalur Women PS', 'Yagati PS', 'Kadur PS'],
    },
    {
        'code': 'KA-23',
        'name': 'Mysore',
        'stations': ['Narasimharaja PS', 'V.V. Puram PS', 'Vijayanagar PS'],
    },
    {
        'code': 'KA-11',
        'name': 'Mandya',
        'stations': ['Halagur PS', 'K.M. Doddi PS', 'Besagaraghalli PS'],
    },
]


def rewrite_row(row, index):
    plan = allowed[index % len(allowed)]
    station = plan['stations'][index % len(plan['stations'])]
    updates = {
        'district_code': plan['code'],
        'fir_district_code': plan['code'],
        'crime_happened_at_district_code': plan['code'],
        'districtCode': plan['code'],
        'district_code_of_criminal': plan['code'],
        'district_name': plan['name'],
        'districtName': plan['name'],
        'crime_happened_at_district_name': plan['name'],
        'police_station_name': station,
        'police_station': station,
        'station_name': station,
        'fir_police_station_name': station,
    }
    for key, value in updates.items():
        if key in row:
            row[key] = value
    return row


def rewrite_file(relative_path):
    path = root / relative_path
    data = json.loads(path.read_text(encoding='utf-8'))
    rewritten = [rewrite_row(row, index) for index, row in enumerate(data)]
    path.write_text(json.dumps(rewritten, indent=2) + '\n', encoding='utf-8')
    return rewritten


def make_chunks(base_name, rows):
    chunk_size = max(1, (len(rows) + 9) // 10)
    out_dir = root / 'src/modules/seed-data/data/crimie'
    for i in range(10):
        start = i * chunk_size
        end = min(start + chunk_size, len(rows))
        chunk = rows[start:end]
        out_path = out_dir / f'{base_name}-{i + 1}.json'
        out_path.write_text(json.dumps(chunk, indent=2) + '\n', encoding='utf-8')


firs = rewrite_file('src/modules/seed-data/data/crimie/FIRs.json')
incidents = rewrite_file('src/modules/seed-data/data/crimie/crime_incident.json')
rewrite_file('src/modules/seed-data/data/police-officer/police_officer.json')
make_chunks('FIRs', firs)
make_chunks('crime_incident', incidents)

print('rewritten', len(firs), len(incidents))
print('sample', firs[0]['district_code'], firs[0].get('police_station_name'))
