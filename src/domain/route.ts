import type { ReferenceRoute } from "../types/route";
import type { RiderTrack } from "../types/gpx";

export function buildReferenceRouteFromRider(track: RiderTrack): ReferenceRoute {
  return {
    routeId: `${track.riderId}-route`,
    source: "single_rider",
    coordinates: track.points.map((p) => [p.lon, p.lat]),
    cumulativeDistanceM: track.points.map((_, idx) => idx)
  };
}
