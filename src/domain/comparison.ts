import { lineString, nearestPointOnLine, point } from "@turf/turf";
import type { RiderTrack, RiderTrim } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

export type RiderComparisonSeries = {
  riderId: string;
  distancesM: number[];
  elapsedMsAtDistance: Array<number | undefined>;
};

export type ComparisonDataset = {
  stationDistancesM: number[];
  byRider: Record<string, RiderComparisonSeries>;
};

type SnappedSample = {
  routeDistanceM: number;
  elapsedMs: number;
};

function toSnappedSamples(track: RiderTrack, trim: RiderTrim, route: ReferenceRoute): SnappedSample[] {
  const startIdx = Math.max(0, trim.startPointIndex);
  const endIdx = Math.max(startIdx, trim.endPointIndex);
  const start = track.points[startIdx];
  if (!start?.timeMs) {
    return [];
  }
  const routeLine = lineString(route.coordinates);

  const samples: SnappedSample[] = [];
  let prevDistance = 0;
  for (let i = startIdx; i <= endIdx; i += 1) {
    const p = track.points[i];
    if (!p?.timeMs) {
      continue;
    }
    const snapped = nearestPointOnLine(routeLine, point([p.lon, p.lat]), { units: "meters" });
    const locationRaw = snapped.properties.location;
    if (typeof locationRaw !== "number") {
      continue;
    }
    // Enforce monotonic progression along the route to stabilize inversion.
    const routeDistanceM = Math.max(prevDistance, locationRaw);
    prevDistance = routeDistanceM;
    samples.push({
      routeDistanceM,
      elapsedMs: p.timeMs - start.timeMs
    });
  }
  return samples;
}

function elapsedAtDistance(samples: SnappedSample[], distanceM: number): number | undefined {
  if (samples.length === 0) {
    return undefined;
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) {
    return undefined;
  }
  if (distanceM <= first.routeDistanceM) {
    return first.elapsedMs;
  }
  if (distanceM > last.routeDistanceM) {
    return undefined;
  }

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    if (!prev || !next) {
      continue;
    }
    if (distanceM > next.routeDistanceM) {
      continue;
    }
    const span = next.routeDistanceM - prev.routeDistanceM;
    if (span <= 0) {
      return next.elapsedMs;
    }
    const ratio = (distanceM - prev.routeDistanceM) / span;
    return prev.elapsedMs + (next.elapsedMs - prev.elapsedMs) * ratio;
  }
  return undefined;
}

export function buildComparisonDataset(
  tracks: RiderTrack[],
  trims: Record<string, RiderTrim>,
  route: ReferenceRoute
): ComparisonDataset {
  const stationDistancesM = route.cumulativeDistanceM;
  const byRider: Record<string, RiderComparisonSeries> = {};

  tracks.forEach((track) => {
    const trim = trims[track.riderId];
    if (!trim) {
      return;
    }
    const snapped = toSnappedSamples(track, trim, route);
    byRider[track.riderId] = {
      riderId: track.riderId,
      distancesM: stationDistancesM,
      elapsedMsAtDistance: stationDistancesM.map((distanceM) => elapsedAtDistance(snapped, distanceM))
    };
  });

  return { stationDistancesM, byRider };
}

export function leaderRiderId(
  dataset: ComparisonDataset,
  riderIds: string[]
): string | undefined {
  const lastDistanceIdx = Math.max(0, dataset.stationDistancesM.length - 1);
  let winner: { riderId: string; elapsedMs: number } | undefined;
  riderIds.forEach((riderId) => {
    const elapsed = dataset.byRider[riderId]?.elapsedMsAtDistance[lastDistanceIdx];
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
  return rider.elapsedMsAtDistance.map((elapsed, idx) => {
    const baseElapsed = base.elapsedMsAtDistance[idx];
    if (elapsed === undefined || baseElapsed === undefined) {
      return undefined;
    }
    return elapsed - baseElapsed;
  });
}
