export type ReferenceRoute = {
  routeId: string;
  source: "uploaded_route" | "single_rider" | "consensus_average";
  coordinates: [number, number][];
  cumulativeDistanceM: number[];
};
