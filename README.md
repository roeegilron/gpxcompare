# gpxcompare

Segment-aligned, point-inspectable GPX comparison workbench for high-precision multi-rider run analysis.

This project is a browser-only tool (GitHub Pages deploy) for comparing GPX tracks by explicitly selected start/end points and a shared averaged reference route.

## What This Repo Does

- Upload and parse up to 5 GPX files in-browser.
- Visualize full tracks and raw GPS pings on an interactive map.
- Enforce a strict workflow:
  1. pick start for all included riders
  2. pick end for all included riders
  3. build consensus reference route
- Build a high-resolution (~0.5m station spacing) averaged route from trimmed rider segments.
- Compare riders against a selected base rider with:
  - gap chart (time gap vs route distance)
  - comparison table (elapsed, gap, speed delta, route distance)
- Allow rider rename/recolor and include/exclude toggles for comparison.

## How It Works (Pipeline)

1. GPX trackpoints are parsed with timestamps, coordinates, and point order.
2. User selects start and end points per included rider.
3. Trimmed rider segments are resampled by route progress and averaged into a consensus line.
4. Rider points are evaluated against the shared route axis.
5. Time-at-distance series are generated per rider.
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