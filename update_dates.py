
import json
import os
import random
from datetime import datetime, timedelta

inc_path = os.path.join("src", "modules", "seed-data", "data", "crimie", "crime_incident.json")

print("Loading data...")
with open(inc_path, "r", encoding="utf-8") as f:
    incidents = json.load(f)

start_date = datetime(2026, 1, 1)
end_date = datetime(2026, 7, 25)
delta_days = (end_date - start_date).days

print("Updating dates...")
for inc in incidents:
    random_days = random.randint(0, delta_days)
    random_date = start_date + timedelta(days=random_days)
    
    inc["incident_registered_date"] = random_date.strftime("%Y-%m-%d")
    
    occurred_days_before = random.randint(0, 5)
    occurred_date = random_date - timedelta(days=occurred_days_before)
    random_hour = random.randint(0, 23)
    random_minute = random.randint(0, 59)
    random_second = random.randint(0, 59)
    occurred_dt = occurred_date.replace(hour=random_hour, minute=random_minute, second=random_second)
    inc["crime_occured_date_time"] = occurred_dt.strftime("%Y-%m-%d %H:%M:%S")

print("Saving data...")
with open(inc_path, "w", encoding="utf-8") as f:
    json.dump(incidents, f, indent=2)

print("Done!")
