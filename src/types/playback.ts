export type PlaybackFrame = {
  riderId: string;
  elapsedMs: number;
  rawPointIndexNearest?: number;
  interpolatedPosition?: {
    lat: number;
    lon: number;
    routeDistanceM: number;
  };
  isRawPingExact: boolean;
};
