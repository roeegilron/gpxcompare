import { cumulativeDistanceM } from "./metrics";
import type { DerivedPoint, RiderTrack } from "../types/gpx";

export function buildDerivedPoints(track: RiderTrack): DerivedPoint[] {
  const cumulative = cumulativeDistanceM(track.points);
  const startMs = track.points[0]?.timeMs;

  return track.points.map((raw, index) => ({
    riderId: track.riderId,
    pointIndex: raw.pointIndex,
    raw,
    cumulativeDistanceM: cumulative[index] ?? 0,
    elapsedFromFileStartMs:
      raw.timeMs !== undefined && startMs !== undefined ? raw.timeMs - startMs : undefined,
    isInsideChosenSegment: true
  }));
}
