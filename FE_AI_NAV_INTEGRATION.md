# AI Navigation Integration (FE)

This document describes how the frontend should consume the AI `navigation` hints returned by the CrimeLens backend and how to integrate them into the UI routing and filter state.

Location of backend changes
- Backend AI graph and tool wiring: `src/modules/ai/ai.graph.js`
- Tools: `src/modules/ai/tools/crime.tool.js`

Overview
- The AI endpoint (`POST /ai/chat`) returns a conventional API response via the existing `sendResponse` helper: `{ success: true, data }`.
- For business (tool) requests the backend responds with `data` shaped like:

  {
    type: "business",
    summary: "Short one-line summary",
    result: {
      // tool-specific payload (e.g. crimes, district details, profile...)
      ...,
      navigation: {
        route: "/entities/crimes",       // suggested route path
        filters: {                        // filters to apply in FE
          district: "Bangalore Urban",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          crimeType: "theft",
          criminalId: "ROWID-123",
          rootType: "criminal",
          rootId: "ROWID-123",
        }
      }
    }
  }

- Casual replies (non-tool) return `data` shaped like:
  { type: "casual", message: "..." }

Intent for the FE
- Use `data.summary` to present a human-friendly caption or subtitle.
- Use `data.result` as the authoritative tool result payload.
- If `data.result.navigation` exists, use it to navigate/open a view and populate filters, not to infer tool success.

Routing recommendations
1. Prefer client-side navigation (router push) using the `route` and `filters` values. The backend `route` is a canonical path in the app (see `ROUTES` in the FE route config). Example:

- If `route` === `/entities/crimes`: set the Crimes list view and apply filters.
- If `route` contains a dynamic segment (`/entities/criminals/:criminalId`) replace the segment with `filters.criminalId`.

2. Do not trust `route` blindly — validate it exists in the FE's `ROUTES` map before navigating.

Example navigation handler (Vue / React pseudocode)

```javascript
function applyAiNavigation(data, router, setFilters) {
  if (!data || data.type !== 'business' || !data.result) return;

  const nav = data.result.navigation;
  if (!nav || !nav.route) return; // nothing to do

  // Validate route against your ROUTES map (optional)
  if (!isKnownRoute(nav.route)) return;

  // Map filters into your UI filter shape
  const uiFilters = mapNavFiltersToUi(nav.filters || {});

  // If dynamic segment present, replace it
  let path = nav.route;
  if (path.includes(':criminalId') && uiFilters.criminalId) {
    path = path.replace(':criminalId', uiFilters.criminalId);
  }

  // Apply filters to state (so the view shows filtered results)
  setFilters(uiFilters);

  // Navigate (push state)
  router.push(path);
}
```

Filter mapping
- Backend filter keys used by the AI graph:
  - `district` — district name (string)
  - `startDate` / `endDate` — ISO date strings (YYYY-MM-DD)
  - `crimeType` / `categoryId` — crime category identifier or type
  - `criminalId`, `rootType`, `rootId` — IDs for entity views

- The FE should convert these into the app's internal filter format (e.g., ids vs labels). If only a name is provided (like `district`), the FE can resolve it to an id using existing district lookup APIs.

UI behavior
- When navigation is provided:
  - Show the `summary` string prominently (header/subtitle) on the destination view.
  - Apply filters immediately and refresh the list/grid view.
  - Provide a small banner or toast: "AI suggested view: <summary> — Click to apply" if you prefer explicit user consent before navigating.

- When no navigation is provided but `data.result` exists:
  - Show the tool result inline (e.g., show fetched crimes in a modal or a results card) without changing routes.

Error and auth handling
- The backend can return HTTP errors (401 Unauthorized, 400/500, 501 Not Implemented). The FE must surface errors consistently and not treat them as successful responses.
- If the response is 401, prompt the user to log in.
- If 501 (tool unimplemented), inform the user that the requested capability is not available yet.

Security & privacy
- The navigation hints do not replace permission checks. Always ensure the logged-in user has permission for the destination route before navigating.
- If `data.result` contains sensitive fields, obey current frontend permission checks and mask/remove fields that the user should not see.

Tests
- Unit test ideas:
  - Given a business response for `get_crimes_for_district_year_range`, assert that router.push was called with `/entities/crimes` and filters were set.
  - Given a business response for `get_criminal_by_id`, assert that dynamic route replacement occurs.
  - Given a casual response, assert no navigation occurs and the message is displayed.

Sample cURL to exercise the endpoint (dev):

```bash
curl -X POST http://localhost:PORT/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"message":"show me crimes in Bangalore Urban between 2024 and 2025"}'
```

Integration checklist for FE Copilot
- [ ] Import and parse backend AI responses consistently via existing `sendResponse` contract: `{ success: true, data }`.
- [ ] Implement `applyAiNavigation()` and `mapNavFiltersToUi()` helpers.
- [ ] Validate `route` against `ROUTES` before navigating.
- [ ] Apply filters to UI state before navigating (or show a confirmation UI).
- [ ] Add tests for the navigation behavior.

If you want, I can also:
- Provide a small React/Vue component example illustrating `applyAiNavigation()` integrated with your router and filter store.
- Remove unimplemented tools from backend exposure so the LLM doesn't propose them.

---

Generated by backend dev: `ai.graph` navigation integration.
