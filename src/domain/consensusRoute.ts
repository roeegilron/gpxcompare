import type { RiderTrack } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

export function buildConsensusRoute(tracks: RiderTrack[]): ReferenceRoute {
  const firstTrack = tracks[0];
  if (!firstTrack) {
    throw new Error("No tracks available for consensus route");
  }
  // Placeholder strategy for MVP scaffold: use first track as provisional master.
  return {
    routeId: "consensus-route",
    source: "consensus_average",
    coordinates: firstTrack.points.map((p) => [p.lon, p.lat]),
    cumulativeDistanceM: firstTrack.points.map((_, idx) => idx)
  };
}
