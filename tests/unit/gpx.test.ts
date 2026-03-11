import { describe, expect, test } from "vitest";
import { parseGpxXmlString } from "../../src/domain/gpx";
import { validateTrack } from "../../src/domain/validation";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><name>demo</name><trkseg>
    <trkpt lat="1" lon="2"><time>2026-03-10T10:00:00Z</time></trkpt>
    <trkpt lat="1.0001" lon="2.0002"><time>2026-03-10T10:00:01Z</time></trkpt>
    <trkpt lat="1.0002" lon="2.0003"><time>2026-03-10T10:00:02Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

describe("parseGpxXmlString", () => {
  test("parses all raw points with original indexes", () => {
    const track = parseGpxXmlString(SAMPLE_GPX, "rider-1", "sample.gpx");
    const first = track.points[0];
    const second = track.points[1];
    const third = track.points[2];

    expect(track.points).toHaveLength(3);
    expect(first?.pointIndex).toBe(0);
    expect(third?.pointIndex).toBe(2);
    expect(second?.timeMs).toBeGreaterThan(first?.timeMs ?? 0);
  });

  test("validates timestamps and low point count warnings", () => {
    const track = parseGpxXmlString(SAMPLE_GPX, "rider-1", "sample.gpx");
    const warnings = validateTrack(track);
    expect(warnings.some((w) => w.code === "LOW_POINT_COUNT")).toBe(true);
    expect(warnings.some((w) => w.code === "TIMESTAMP_REVERSAL")).toBe(false);
  });
});
