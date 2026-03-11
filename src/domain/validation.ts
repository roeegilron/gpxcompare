import { haversineDistanceM } from "./metrics";
import type { RiderTrack, ValidationWarning } from "../types/gpx";

const LOW_POINT_THRESHOLD = 20;
const GPS_JUMP_M = 75;
const GPS_JUMP_WINDOW_MS = 1000;

export function validateTrack(track: RiderTrack): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const times = track.points.map((p) => p.timeMs).filter((v): v is number => v !== undefined);

  if (times.length === 0) {
    warnings.push({
      code: "NO_TIMESTAMPS",
      message: "Track has no timestamps; playback will be limited."
    });
  } else {
    for (let i = 1; i < times.length; i += 1) {
      const prev = times[i - 1];
      const curr = times[i];
      if (prev === undefined || curr === undefined) {
        continue;
      }
      if (curr < prev) {
        warnings.push({
          code: "TIMESTAMP_REVERSAL",
          message: "Track contains timestamp reversals."
        });
        break;
      }
      if (curr === prev) {
        warnings.push({
          code: "DUPLICATE_TIMESTAMPS",
          message: "Track contains duplicate timestamps."
        });
        break;
      }
    }
  }

  if (track.points.length < LOW_POINT_THRESHOLD) {
    warnings.push({
      code: "LOW_POINT_COUNT",
      message: `Track has only ${track.points.length} points.`
    });
  }

  for (let i = 1; i < track.points.length; i += 1) {
    const prev = track.points[i - 1];
    const curr = track.points[i];
    if (!prev || !curr) {
      continue;
    }
    const dist = haversineDistanceM(prev, curr);
    const dt = (curr.timeMs ?? 0) - (prev.timeMs ?? 0);
    if (dist > GPS_JUMP_M && (dt <= GPS_JUMP_WINDOW_MS || dt === 0)) {
      warnings.push({
        code: "GPS_JUMP",
        message: "Track has probable GPS outliers (large jump in short time)."
      });
      break;
    }
  }

  return warnings;
}
