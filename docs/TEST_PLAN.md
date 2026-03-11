# Simple test plan

## Goal

Verify the scaffolded product can parse GPX files, detect baseline data quality issues, and render core UI sections.

## One-time setup

1. `npm install`
2. `npm run dev`

## Manual tests (simple path)

1. Open the app in browser.
2. Confirm panels render:
   - Map
   - Upload GPX files
   - Riders
   - Reference Route
   - Playback
   - Charts
   - Comparison Table
   - Point Inspector
3. Upload one valid `.gpx` file.
4. Confirm rider card appears with:
   - File name
   - Point count
   - First timestamp
   - Validation warnings list
5. Upload more GPX files until 5 total.
6. Confirm app does not allow more than 5 files in one selection.
7. Click **Reset session** and confirm riders list is cleared.

## Automated tests

1. `npm test`
   - Verifies GPX parser keeps raw point indexes and timestamp parse behavior.
   - Verifies baseline validation warning behavior.
2. `npm run test:e2e`
   - Verifies upload panel is visible in the built app.

## Expected known limitations in this scaffold

- Leaflet map integration is a placeholder.
- Route snapping and consensus route algorithms are not implemented yet.
- Playback clock controls are scaffold-only.

## Next feature slices

1. Implement Leaflet map with raw ping dots toggle.
2. Add rider start/end point selection and nudge controls.
3. Implement reference route snapping in `src/workers/snapWorker.ts`.
4. Add route-distance and gap chart logic.
