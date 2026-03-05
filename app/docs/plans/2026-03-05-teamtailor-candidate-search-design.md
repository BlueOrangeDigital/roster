# Team Tailor Candidate Search Design

**Date:** 2026-03-05
**Status:** Approved

## Overview

Replace the bulk "sync all candidates" flow with a targeted search-and-import UI. Users search Team Tailor by name/email, see up to 20 results, multi-select, and import only the candidates they need.

## UI & Interaction

- "Sync from Team Tailor" button renamed to **"Add from Team Tailor"**
- Clicking opens the existing expandable panel
- Search input at top (magnifying glass icon, placeholder "Search by name or email…")
- Debounced 300ms — fires query as user types ≥2 characters
- Inline spinner in the input while loading
- Results list: avatar/initials, full name, email, "Imported" badge if applicable, checkbox per row
- Sticky footer bar appears once ≥1 result is checked: "Import N selected" + "Clear selection"
- Empty state (no query): "Start typing to search Team Tailor candidates"
- No results state: "No candidates found for 'xyz'"

## API Changes

### New: `GET /api/teamtailor/search?q=<query>`
- Requires ≥2 char query
- Proxies to `GET /v1/candidates?filter[query]=<q>&page[size]=20` on Team Tailor
- Resolves `imported` flag server-side by checking existing Roster `teamTailorId` values
- Returns: `{ teamTailorId, firstName, lastName, email, pictureUrl, resumeUrl, linkedinUrl, tags, imported, rosterId }[]`

### Unchanged: `POST /api/teamtailor/import`
No changes needed.

### Deleted: `GET /api/teamtailor/sync`
No longer needed.

## Error Handling

- TT not configured → hide "Add from Team Tailor" button
- Query <2 chars → no request fired
- API error (403/500/network) → inline error: "Couldn't reach Team Tailor. Check your API key has Candidates scope."
- Already-imported candidates → show badge, still selectable for re-sync (import route handles upsert)
- Import failure → inline error, preserve selections for retry
