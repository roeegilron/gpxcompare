import type { PlaybackFrame } from "../types/playback";
import type { RiderTrack } from "../types/gpx";

export function interpolateTrackAtElapsedMs(
  track: RiderTrack,
  elapsedMs: number
): PlaybackFrame {
  const points = track.points.filter((p) => p.timeMs !== undefined);
  if (points.length === 0) {
    return {
      riderId: track.riderId,
      elapsedMs,
      isRawPingExact: false
    };
  }

  const first = points[0];
  if (!first) {
    return {
      riderId: track.riderId,
      elapsedMs,
      isRawPingExact: false
    };
  }

  const start = first.timeMs ?? 0;
  const target = start + elapsedMs;
  let nextIdx = points.findIndex((p) => (p.timeMs ?? 0) >= target);
  if (nextIdx === -1) {
    nextIdx = points.length - 1;
  }

  const next = points[nextIdx] ?? first;
  const prev = points[Math.max(0, nextIdx - 1)] ?? first;
  const prevMs = prev.timeMs ?? target;
  const nextMs = next.timeMs ?? target;

  if (target <= prevMs || nextMs === prevMs) {
    return {
      riderId: track.riderId,
      elapsedMs,
      rawPointIndexNearest: prev.pointIndex,
      interpolatedPosition: {
        lat: prev.lat,
        lon: prev.lon,
        routeDistanceM: 0
      },
      isRawPingExact: target === prevMs
    };
  }

  const ratio = Math.min(1, Math.max(0, (target - prevMs) / (nextMs - prevMs)));
  return {
    riderId: track.riderId,
    elapsedMs,
    rawPointIndexNearest: prev.pointIndex,
    interpolatedPosition: {
      lat: prev.lat + (next.lat - prev.lat) * ratio,
      lon: prev.lon + (next.lon - prev.lon) * ratio,
      routeDistanceM: 0
    },
    isRawPingExact: ratio === 0
  };
}
