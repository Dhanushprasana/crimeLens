import json
import pathlib

root = pathlib.Path('src/modules/seed-data/data/crimie')
for source_name, prefix in [('FIRs.json', 'FIRs'), ('crime_incident.json', 'crime_incident')]:
    source_path = root / source_name
    with source_path.open(encoding='utf-8') as f:
        items = json.load(f)
    if not isinstance(items, list):
        raise SystemExit(f'{source_name} is not a list')
    chunk_size = max(1, (len(items) + 9) // 10)
    for i in range(10):
        start = i * chunk_size
        end = min(start + chunk_size, len(items))
        chunk = items[start:end]
        target_path = root / f'{prefix}-{i + 1}.json'
        with target_path.open('w', encoding='utf-8') as f:
            json.dump(chunk, f, indent=2)
        print(target_path.name, len(chunk))
