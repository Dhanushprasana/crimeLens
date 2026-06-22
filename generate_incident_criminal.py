import json
import os
import random

base_dir = r"c:\Users\dhanu\projects\crimelens-BE-express-manual\src\modules\seed-data\data"

incidents_path = os.path.join(base_dir, "crimie", "crime_incident.json")
with open(incidents_path, 'r', encoding='utf-8') as f:
    incidents = json.load(f)
crime_numbers = [inc["crime_number"] for inc in incidents if "crime_number" in inc]

criminals_path = os.path.join(base_dir, "criminal", "criminal.json")
with open(criminals_path, 'r', encoding='utf-8') as f:
    criminals = json.load(f)
criminal_numbers = [c["criminal_number"] for c in criminals if "criminal_number" in c]

# we want to assign multiple criminals to one crime sometimes
# and multiple crimes to one criminal

incident_criminals = []
for crime in crime_numbers:
    # 1 to 3 criminals per crime
    num_criminals = random.randint(1, 3)
    chosen_criminals = random.sample(criminal_numbers, num_criminals)
    for c in chosen_criminals:
        incident_criminals.append({
            "crime_number": crime,
            "criminal_number": c
        })

out_path = os.path.join(base_dir, "crimie", "incident_criminal.json")
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(incident_criminals, f, indent=2)

print(f"Generated {len(incident_criminals)} incident_criminal relations.")
