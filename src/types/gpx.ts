export type RawPoint = {
  riderId: string;
  pointIndex: number;
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  timeMs?: number;
  sourceSegmentIndex?: number;
  sourceTrackIndex?: number;
};

export type DerivedPoint = {
  riderId: string;
  pointIndex: number;
  raw: RawPoint;
  cumulativeDistanceM: number;
  elapsedFromFileStartMs?: number;
  snappedRouteDistanceM?: number;
  lateralErrorM?: number;
  isInsideChosenSegment: boolean;
};

export type RiderTrim = {
  riderId: string;
  startPointIndex: number;
  endPointIndex: number;
  normalizedStartTimeMs?: number;
};

export type RiderTrack = {
  riderId: string;
  fileName: string;
  points: RawPoint[];
};

export type ValidationWarning = {
  code:
    | "NO_TIMESTAMPS"
    | "TIMESTAMP_REVERSAL"
    | "DUPLICATE_TIMESTAMPS"
    | "LOW_POINT_COUNT"
    | "GPS_JUMP";
  message: string;
};
