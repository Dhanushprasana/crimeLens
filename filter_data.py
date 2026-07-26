
import json
import os
import copy

fir_path = os.path.join("src", "modules", "seed-data", "data", "crimie", "FIRs.json")
inc_path = os.path.join("src", "modules", "seed-data", "data", "crimie", "crime_incident.json")

print("Loading data...")
with open(fir_path, "r", encoding="utf-8") as f:
    firs = json.load(f)

with open(inc_path, "r", encoding="utf-8") as f:
    incidents = json.load(f)

allowed_stations = {
    "H.S.R.Layout PS", "Madiwala PS", "Whitefield PS",
    "Hubballi SubUrban PS", "Dharwad Rural PS", "Ashoknagar PS",
    "Mangaluru North PS", "Mangaluru South PS", "Surathkal PS",
    "Mysore South PS", "Udayagiri PS"
}

print("Filtering incidents...")
filtered_inc = [inc for inc in incidents if inc.get("police_station") in allowed_stations]

fir_map = {fir["fir_number"]: fir for fir in firs if "fir_number" in fir}
new_firs = []
fir_counter = 100000

for inc in filtered_inc:
    fir_num = inc.get("fir_number")
    if not fir_num:
        fir_num = f"FIR-NEW-{fir_counter}"
        fir_counter += 1
        inc["fir_number"] = fir_num
        inc["fir_police_station_name"] = inc.get("police_station")
        inc["fir_district_code"] = inc.get("crime_happened_at_district_code")
        
        new_firs.append({
            "fir_number": fir_num,
            "complainant_name": "Generated Complainant",
            "complainant_phone": "9999999999",
            "incident_description": inc.get("description", "Generated FIR for incident"),
            "fir_status": "REGISTERED",
            "assigned_officer_name": "Officer X",
            "district_code": inc.get("crime_happened_at_district_code"),
            "police_station_name": inc.get("police_station")
        })
    else:
        if fir_num in fir_map:
            new_firs.append(fir_map[fir_num])
        else:
            new_firs.append({
                "fir_number": fir_num,
                "complainant_name": "Unknown",
                "complainant_phone": "9999999999",
                "incident_description": inc.get("description", "Recovered FIR for incident"),
                "fir_status": "REGISTERED",
                "assigned_officer_name": "Officer X",
                "district_code": inc.get("crime_happened_at_district_code"),
                "police_station_name": inc.get("police_station")
            })

print(f"Filtered incidents: {len(filtered_inc)}, New FIRs: {len(new_firs)}")

print("Saving data...")
with open(inc_path, "w", encoding="utf-8") as f:
    json.dump(filtered_inc, f, indent=2)

with open(fir_path, "w", encoding="utf-8") as f:
    json.dump(new_firs, f, indent=2)

print("Done!")
