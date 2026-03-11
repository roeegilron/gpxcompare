import { cumulativeDistanceM } from "./metrics";
import type { RiderTrack, RiderTrim } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

type ConsensusInput = {
  track: RiderTrack;
  trim: RiderTrim;
};

type StationPoint = {
  lat: number;
  lon: number;
};

function trimTrackPoints(track: RiderTrack, trim: RiderTrim): StationPoint[] {
  const start = Math.max(0, Math.min(trim.startPointIndex, track.points.length - 1));
  const end = Math.max(start, Math.min(trim.endPointIndex, track.points.length - 1));
  return track.points.slice(start, end + 1).map((point) => ({ lat: point.lat, lon: point.lon }));
}

function stationAtDistance(points: StationPoint[], cumulative: number[], distanceM: number): StationPoint {
  const first = points[0];
  if (!first) {
    throw new Error("Cannot build station from empty point set");
  }
  if (points.length === 1) {
    return first;
  }
  const total = cumulative[cumulative.length - 1] ?? 0;
  const target = Math.max(0, Math.min(distanceM, total));

  let idx = cumulative.findIndex((value) => value >= target);
  if (idx <= 0) {
    idx = 1;
  }
  if (idx === -1) {
    const last = points[points.length - 1];
    return last ?? first;
  }
  const prevIdx = idx - 1;
  const prevPoint = points[prevIdx] ?? first;
  const nextPoint = points[idx] ?? prevPoint;
  const prevDist = cumulative[prevIdx] ?? 0;
  const nextDist = cumulative[idx] ?? prevDist;
  if (nextDist === prevDist) {
    return prevPoint;
  }
  const ratio = (target - prevDist) / (nextDist - prevDist);
  return {
    lat: prevPoint.lat + (nextPoint.lat - prevPoint.lat) * ratio,
    lon: prevPoint.lon + (nextPoint.lon - prevPoint.lon) * ratio
  };
}

export function buildConsensusRoute(inputs: ConsensusInput[], stationCount = 500): ReferenceRoute {
  if (inputs.length === 0) {
    throw new Error("No tracks available for consensus route");
  }

  const trimmed = inputs
    .map(({ track, trim }) => trimTrackPoints(track, trim))
    .filter((points) => points.length >= 2);
  if (trimmed.length === 0) {
    throw new Error("No trimmed tracks with enough points for consensus route");
  }

  const stationPoints = Math.max(2, stationCount);
  const sampledByTrack = trimmed.map((points) => {
    const synthetic = points.map((point, idx) => ({
      riderId: "consensus",
      pointIndex: idx,
      lat: point.lat,
      lon: point.lon
    }));
    const cumulative = cumulativeDistanceM(synthetic);
    const totalDistance = cumulative[cumulative.length - 1] ?? 0;
    return { points, cumulative, totalDistance };
  });

  const coordinates: [number, number][] = [];
  for (let i = 0; i < stationPoints; i += 1) {
    const ratio = i / (stationPoints - 1);
    const stations = sampledByTrack.map(({ points, cumulative, totalDistance }) =>
      stationAtDistance(points, cumulative, ratio * totalDistance)
    );
    const avgLat = stations.reduce((sum, item) => sum + item.lat, 0) / stations.length;
    const avgLon = stations.reduce((sum, item) => sum + item.lon, 0) / stations.length;
    coordinates.push([avgLon, avgLat]);
  }

  const coordAsRaw = coordinates.map(([lon, lat], idx) => ({
    riderId: "consensus",
    pointIndex: idx,
    lat,
    lon
  }));

  return {
    routeId: "consensus-route",
    source: "consensus_average",
    coordinates,
    cumulativeDistanceM: cumulativeDistanceM(coordAsRaw)
  };
}
