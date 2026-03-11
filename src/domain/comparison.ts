import { cumulativeDistanceM } from "./metrics";
import type { RiderTrack, RiderTrim } from "../types/gpx";

export type RiderComparisonSeries = {
  riderId: string;
  elapsedMsAtFraction: Array<number | undefined>;
  totalDistanceM: number;
  totalElapsedMs?: number;
};

export type ComparisonDataset = {
  stationFractions: number[];
  byRider: Record<string, RiderComparisonSeries>;
};

type Sample = {
  distanceM: number;
  elapsedMs: number;
};

function buildSamples(track: RiderTrack, trim: RiderTrim): Sample[] {
  const startIdx = Math.max(0, trim.startPointIndex);
  const endIdx = Math.max(startIdx, Math.min(trim.endPointIndex, track.points.length - 1));
  const points = track.points.slice(startIdx, endIdx + 1);
  const startTime = points[0]?.timeMs;
  if (!startTime || points.length < 2) {
    return [];
  }
  const distances = cumulativeDistanceM(points);
  return points
    .map((point, idx) => ({
      distanceM: distances[idx] ?? 0,
      elapsedMs: point.timeMs !== undefined ? point.timeMs - startTime : undefined
    }))
    .filter((item): item is Sample => item.elapsedMs !== undefined);
}

function elapsedAtFraction(samples: Sample[], fraction: number): number | undefined {
  if (samples.length === 0) {
    return undefined;
  }
  const total = samples[samples.length - 1]?.distanceM ?? 0;
  const target = Math.max(0, Math.min(1, fraction)) * total;
  const first = samples[0];
  if (!first) {
    return undefined;
  }
  if (target <= first.distanceM) {
    return first.elapsedMs;
  }
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    if (!prev || !next) {
      continue;
    }
    if (target > next.distanceM) {
      continue;
    }
    const span = next.distanceM - prev.distanceM;
    if (span <= 0) {
      return next.elapsedMs;
    }
    const ratio = (target - prev.distanceM) / span;
    return prev.elapsedMs + (next.elapsedMs - prev.elapsedMs) * ratio;
  }
  return samples[samples.length - 1]?.elapsedMs;
}

export function buildComparisonDataset(
  tracks: RiderTrack[],
  trims: Record<string, RiderTrim>,
  stationCount = 300
): ComparisonDataset {
  const count = Math.max(2, Math.min(2000, stationCount));
  const stationFractions = Array.from({ length: count }, (_, idx) => idx / (count - 1));
  const byRider: Record<string, RiderComparisonSeries> = {};

  tracks.forEach((track) => {
    const trim = trims[track.riderId];
    if (!trim) {
      return;
    }
    const samples = buildSamples(track, trim);
    const totalDistanceM = samples[samples.length - 1]?.distanceM ?? 0;
    const totalElapsedMs = samples[samples.length - 1]?.elapsedMs;
    byRider[track.riderId] = {
      riderId: track.riderId,
      elapsedMsAtFraction: stationFractions.map((fraction) => elapsedAtFraction(samples, fraction)),
      totalDistanceM,
      totalElapsedMs
    };
  });

  return { stationFractions, byRider };
}

export function leaderRiderId(dataset: ComparisonDataset, riderIds: string[]): string | undefined {
  const lastIdx = Math.max(0, dataset.stationFractions.length - 1);
  let winner: { riderId: string; elapsedMs: number } | undefined;
  riderIds.forEach((riderId) => {
    const elapsed = dataset.byRider[riderId]?.elapsedMsAtFraction[lastIdx];
    if (elapsed === undefined) {
      return;
    }
    if (!winner || elapsed < winner.elapsedMs) {
      winner = { riderId, elapsedMs: elapsed };
    }
  });
  return winner?.riderId;
}

export function gapSeriesMs(
  dataset: ComparisonDataset,
  riderId: string,
  compareToRiderId: string
): Array<number | undefined> {
  const rider = dataset.byRider[riderId];
  const base = dataset.byRider[compareToRiderId];
  if (!rider || !base) {
    return [];
  }
  return rider.elapsedMsAtFraction.map((elapsed, idx) => {
    const baseElapsed = base.elapsedMsAtFraction[idx];
    if (elapsed === undefined || baseElapsed === undefined) {
      return undefined;
    }
    return elapsed - baseElapsed;
  });
}
