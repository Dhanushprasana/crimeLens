# Karnataka District Spatial Data Documentation

## Overview
This documentation covers the spatial dataset of Karnataka districts, specifically formatted for rendering via Leaflet on the frontend and for backend storage.

## Files
1. `karnataka-districts.geojson`: Valid GeoJSON containing the boundaries of all 31 districts.
2. `district-boundaries-sample-response.json`: Mock API response simulating the backend endpoint that the frontend will consume.
3. `districts_metadata.csv`: Contains metadata such as district IDs, center coordinates (centroids), geometry types, and coordinate counts.
4. `districts_seed.json`: JSON file for database seed containing stringified geometry for insertion into spatial databases like PostGIS.

## API Contract

### Request
`GET /api/v1/spatial/districts`

### Response (Application/JSON)
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "totalCount": 31,
    "state": "Karnataka",
    "generatedAt": "2024-03-..."
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "districtId": "mysuru",
        "districtName": "Mysuru"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [...]
      }
    }
  ]
}
```

## Storage (Backend)
- Store `district_id` as a unique identifier (slug or UUID).
- Geometry can be stored as a `Geometry(MultiPolygon, 4326)` using PostGIS, or parsed from the GeoJSON representation.
- Ensure the seed file (`districts_seed.json`) is used when initializing the database to populate all district boundaries.

## Rendering (Frontend)
- Utilize the `karnataka-districts.geojson` for static testing or fallbacks.
- The `district-boundaries-sample-response.json` structure should be expected from network calls to the actual API endpoint.
- All coordinates follow the standard GeoJSON specification of `[longitude, latitude]`.

