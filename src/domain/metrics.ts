import type { RawPoint } from "../types/gpx";

const EARTH_RADIUS_M = 6_371_000;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceM(a: RawPoint, b: RawPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
}

export function cumulativeDistanceM(points: RawPoint[]): number[] {
  if (points.length === 0) {
    return [];
  }
  const output = [0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) {
      continue;
    }
    const last = output[i - 1] ?? 0;
    output.push(last + haversineDistanceM(prev, curr));
  }
  return output;
}
