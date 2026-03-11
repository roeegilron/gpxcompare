import { createStore } from "zustand/vanilla";
import type { RiderTrack, RiderTrim, ValidationWarning } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

export type SelectedPoint = {
  riderId: string;
  pointIndex: number;
};

export type AppState = {
  tracks: RiderTrack[];
  warnings: Record<string, ValidationWarning[]>;
  trims: Record<string, RiderTrim>;
  selectedPoint?: SelectedPoint;
  referenceRoute?: ReferenceRoute;
  addTrack: (track: RiderTrack, warnings: ValidationWarning[]) => void;
  setTrimStart: (riderId: string, pointIndex: number) => void;
  setTrimEnd: (riderId: string, pointIndex: number) => void;
  nudgeTrimStart: (riderId: string, delta: number) => void;
  nudgeTrimEnd: (riderId: string, delta: number) => void;
  setSelectedPoint: (selected?: SelectedPoint) => void;
  setReferenceRoute: (route?: ReferenceRoute) => void;
  reset: () => void;
};

export const appStore = createStore<AppState>((set) => ({
  tracks: [],
  warnings: {},
  trims: {},
  selectedPoint: undefined,
  referenceRoute: undefined,
  addTrack: (track, warnings) =>
    set((state) => ({
      tracks: [...state.tracks, track],
      warnings: { ...state.warnings, [track.riderId]: warnings },
      trims: {
        ...state.trims,
        [track.riderId]: {
          riderId: track.riderId,
          startPointIndex: 0,
          endPointIndex: Math.max(0, track.points.length - 1),
          normalizedStartTimeMs: track.points[0]?.timeMs
        }
      }
    })),
  setTrimStart: (riderId, pointIndex) =>
    set((state) => {
      const track = state.tracks.find((item) => item.riderId === riderId);
      if (!track) {
        return state;
      }
      const existing = state.trims[riderId];
      const end = existing?.endPointIndex ?? Math.max(0, track.points.length - 1);
      const nextStart = Math.max(0, Math.min(pointIndex, end));
      return {
        trims: {
          ...state.trims,
          [riderId]: {
            riderId,
            startPointIndex: nextStart,
            endPointIndex: end,
            normalizedStartTimeMs: track.points[nextStart]?.timeMs
          }
        }
      };
    }),
  setTrimEnd: (riderId, pointIndex) =>
    set((state) => {
      const track = state.tracks.find((item) => item.riderId === riderId);
      if (!track) {
        return state;
      }
      const existing = state.trims[riderId];
      const start = existing?.startPointIndex ?? 0;
      const max = Math.max(0, track.points.length - 1);
      const nextEnd = Math.min(max, Math.max(pointIndex, start));
      return {
        trims: {
          ...state.trims,
          [riderId]: {
            riderId,
            startPointIndex: start,
            endPointIndex: nextEnd,
            normalizedStartTimeMs: track.points[start]?.timeMs
          }
        }
      };
    }),
  nudgeTrimStart: (riderId, delta) =>
    set((state) => {
      const trim = state.trims[riderId];
      if (!trim) {
        return state;
      }
      const next = trim.startPointIndex + delta;
      const clamped = Math.max(0, Math.min(next, trim.endPointIndex));
      return {
        trims: {
          ...state.trims,
          [riderId]: {
            ...trim,
            startPointIndex: clamped
          }
        }
      };
    }),
  nudgeTrimEnd: (riderId, delta) =>
    set((state) => {
      const trim = state.trims[riderId];
      const track = state.tracks.find((item) => item.riderId === riderId);
      if (!trim || !track) {
        return state;
      }
      const max = Math.max(0, track.points.length - 1);
      const next = trim.endPointIndex + delta;
      const clamped = Math.max(trim.startPointIndex, Math.min(next, max));
      return {
        trims: {
          ...state.trims,
          [riderId]: {
            ...trim,
            endPointIndex: clamped
          }
        }
      };
    }),
  setSelectedPoint: (selectedPoint) => set({ selectedPoint }),
  setReferenceRoute: (referenceRoute) => set({ referenceRoute }),
  reset: () =>
    set({
      tracks: [],
      warnings: {},
      trims: {},
      selectedPoint: undefined,
      referenceRoute: undefined
    })
}));
