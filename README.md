# gpxcompare

Segment-aligned, point-inspectable GPX comparison workbench.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL from Vite, upload up to 5 GPX files, and inspect parsed rider metadata/warnings.

## Test commands

```bash
npm test
npm run test:e2e
```

## Current scaffold status

- Core domain modules created for parsing, validation, alignment, and interpolation.
- App shell and UI panels are scaffolded.
- Unit tests and e2e smoke test are configured.
- CI and Pages workflows are included.

See `docs/TEST_PLAN.md` for a simple end-to-end testing checklist.
