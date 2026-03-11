# gpxcompare

Segment-aligned, point-inspectable GPX comparison workbench for high-precision multi-rider run analysis.

This project is a browser-only tool (GitHub Pages deploy) for comparing GPX tracks using box-selected start/end zones, draggable S/E pins, and a shared averaged reference route.

## What This Repo Does

- Upload and parse up to 5 GPX files in-browser.
- Visualize full tracks and raw GPS pings on an interactive map.
- Enforce a strict workflow:
  1. draw start box and place/move S pin
  2. draw end box and place/move E pin
  3. build consensus reference route
- Build timing comparison by trimming each rider to nearest start/end pin matches.
- Compare riders against a selected base rider with:
  - gap chart (time gap vs route distance)
  - comparison table (elapsed, gap, speed delta, route distance)
- Allow rider rename/recolor and include/exclude toggles for comparison.
- Include `Zoom to compare route` and `Lock zoom` controls for focused analysis.
- Include per-rider `Zoom Start` / `Zoom End` and ±1/±5 trim nudges for precise boundary tuning.
- Show live segment time per rider while adjusting trim points.

## How It Works (Pipeline)

1. GPX trackpoints are parsed with timestamps, coordinates, and point order.
2. User draws start and end boxes to estimate pin locations from points crossing each box.
3. User can drag S/E pins to refine exact anchor locations.
4. Per-rider trim points are auto-assigned by nearest match to S/E pins.
5. Time-at-progress series are generated for each trimmed segment.
6. Gaps are computed relative to a chosen base rider (default leader at build time).

## Detailed Usage Guide

- In-app link: `Upload GPX files -> How to use (detailed guide)`
- Static guide page: `./how-to-use.html`

## Quick Start

```bash
npm install
npm run dev
```

Open the Vite URL and follow the workflow in the guide.

## Test Commands

```bash
npm test
npm run test:e2e
```

## Deploy

- Deploys to GitHub Pages through Actions on push to `main`.
- Site URL: `https://roeegilron.github.io/gpxcompare/`
- If you need to re-run deploy, trigger the `Deploy Pages` workflow in GitHub Actions.

## Notes

- `docs/TEST_PLAN.md` contains manual + automated testing checklist.
- `test_data/` holds local sample GPX files for repeatable tests.