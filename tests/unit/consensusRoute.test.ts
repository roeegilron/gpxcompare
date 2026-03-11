import { describe, expect, test } from "vitest";
import { buildConsensusRoute } from "../../src/domain/consensusRoute";
import type { RiderTrack } from "../../src/types/gpx";

function makeTrack(riderId: string, latOffset = 0): RiderTrack {
  return {
    riderId,
    fileName: `${riderId}.gpx`,
    points: [
      { riderId, pointIndex: 0, lat: 40 + latOffset, lon: -105 },
      { riderId, pointIndex: 1, lat: 40.001 + latOffset, lon: -105.001 },
      { riderId, pointIndex: 2, lat: 40.002 + latOffset, lon: -105.002 }
    ]
  };
}

describe("buildConsensusRoute", () => {
  test("averages trimmed tracks into a route", () => {
    const a = makeTrack("a", 0);
    const b = makeTrack("b", 0.0002);
    const route = buildConsensusRoute(
      [
        { track: a, trim: { riderId: "a", startPointIndex: 0, endPointIndex: 2 } },
        { track: b, trim: { riderId: "b", startPointIndex: 0, endPointIndex: 2 } }
      ],
      20
    );

    expect(route.coordinates.length).toBeGreaterThan(2);
    expect(route.source).toBe("consensus_average");
    const first = route.coordinates[0];
    expect(first?.[1]).toBeCloseTo(40.0001, 5);
  });
});
