import { createStore } from "zustand/vanilla";
import type { RiderTrack, RiderTrim, ValidationWarning } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

export type SelectedPoint = {
  riderId: string;
  pointIndex: number;
};

export type RiderSettings = {
  name: string;
  color: string;
};

export type SelectionPhase = "select_start" | "select_end" | "ready_to_build" | "built";

type RiderSelection = {
  startSelected: boolean;
  endSelected: boolean;
};

const riderPalette = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.gpx$/i, "").trim() || fileName;
}

export type AppState = {
  tracks: RiderTrack[];
  warnings: Record<string, ValidationWarning[]>;
  trims: Record<string, RiderTrim>;
  riderSettings: Record<string, RiderSettings>;
  riderSelection: Record<string, RiderSelection>;
  includeInComparison: Record<string, boolean>;
  selectionPhase: SelectionPhase;
  compareToRiderId?: string;
  progressDistanceM: number;
  selectedPoint?: SelectedPoint;
  referenceRoute?: ReferenceRoute;
  addTrack: (track: RiderTrack, warnings: ValidationWarning[]) => void;
  setRiderName: (riderId: string, name: string) => void;
  setRiderColor: (riderId: string, color: string) => void;
  setIncludeInComparison: (riderId: string, include: boolean) => void;
  setCompareToRider: (riderId?: string) => void;
  setSelectionPhase: (phase: SelectionPhase) => void;
  applyPointSelectionByPhase: (riderId: string, pointIndex: number) => void;
  setTrimStart: (riderId: string, pointIndex: number) => void;
  setTrimEnd: (riderId: string, pointIndex: number) => void;
  nudgeTrimStart: (riderId: string, delta: number) => void;
  nudgeTrimEnd: (riderId: string, delta: number) => void;
  setSelectedPoint: (selected?: SelectedPoint) => void;
  setReferenceRoute: (route?: ReferenceRoute, built?: boolean) => void;
  setProgressDistanceM: (distanceM: number) => void;
  reset: () => void;
};

function allIncludedRidersSelected(
  riderSelection: Record<string, RiderSelection>,
  includeInComparison: Record<string, boolean>
): { starts: boolean; ends: boolean } {
  const includedIds = Object.entries(includeInComparison)
    .filter(([, include]) => include)
    .map(([riderId]) => riderId);
  if (includedIds.length === 0) {
    return { starts: false, ends: false };
  }
  const starts = includedIds.every((riderId) => riderSelection[riderId]?.startSelected);
  const ends = includedIds.every((riderId) => riderSelection[riderId]?.endSelected);
  return { starts, ends };
}

export const appStore = createStore<AppState>((set) => ({
  tracks: [],
  warnings: {},
  trims: {},
  riderSettings: {},
  riderSelection: {},
  includeInComparison: {},
  selectionPhase: "select_start",
  compareToRiderId: undefined,
  progressDistanceM: 0,
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
      },
      riderSettings: {
        ...state.riderSettings,
        [track.riderId]: {
          name: fileBaseName(track.fileName),
          color: riderPalette[state.tracks.length % riderPalette.length] ?? "#111827"
        }
      },
      riderSelection: {
        ...state.riderSelection,
        [track.riderId]: { startSelected: false, endSelected: false }
      },
      includeInComparison: {
        ...state.includeInComparison,
        [track.riderId]: true
      }
    })),
  setRiderName: (riderId, name) =>
    set((state) => {
      const existing = state.riderSettings[riderId];
      if (!existing) {
        return state;
      }
      const trimmed = name.trim();
      return {
        riderSettings: {
          ...state.riderSettings,
          [riderId]: {
            ...existing,
            name: trimmed || existing.name
          }
        }
      };
    }),
  setRiderColor: (riderId, color) =>
    set((state) => {
      const existing = state.riderSettings[riderId];
      if (!existing) {
        return state;
      }
      return {
        riderSettings: {
          ...state.riderSettings,
          [riderId]: {
            ...existing,
            color
          }
        }
      };
    }),
  setIncludeInComparison: (riderId, include) =>
    set((state) => {
      const includeInComparison = { ...state.includeInComparison, [riderId]: include };
      const selected = allIncludedRidersSelected(state.riderSelection, includeInComparison);
      const nextPhase =
        state.referenceRoute !== undefined
          ? "built"
          : selected.starts
            ? selected.ends
              ? "ready_to_build"
              : state.selectionPhase === "select_start"
                ? "select_end"
                : state.selectionPhase
            : "select_start";
      const includedIds = Object.entries(includeInComparison)
        .filter(([, value]) => value)
        .map(([id]) => id);
      const compareToRiderId = includedIds.includes(state.compareToRiderId ?? "")
        ? state.compareToRiderId
        : includedIds[0];
      return {
        includeInComparison,
        compareToRiderId,
        selectionPhase: nextPhase
      };
    }),
  setCompareToRider: (compareToRiderId) => set({ compareToRiderId }),
  setSelectionPhase: (selectionPhase) => set({ selectionPhase }),
  applyPointSelectionByPhase: (riderId, pointIndex) =>
    set((state) => {
      const track = state.tracks.find((item) => item.riderId === riderId);
      if (!track) {
        return state;
      }
      const existingTrim = state.trims[riderId];
      if (!existingTrim) {
        return state;
      }

      let trims = { ...state.trims };
      let riderSelection = { ...state.riderSelection };

      if (state.selectionPhase === "select_start") {
        const end = existingTrim.endPointIndex;
        const nextStart = Math.max(0, Math.min(pointIndex, end));
        trims[riderId] = {
          ...existingTrim,
          startPointIndex: nextStart,
          normalizedStartTimeMs: track.points[nextStart]?.timeMs
        };
        riderSelection[riderId] = { ...(riderSelection[riderId] ?? { endSelected: false }), startSelected: true };
      } else if (state.selectionPhase === "select_end") {
        const start = existingTrim.startPointIndex;
        const max = Math.max(0, track.points.length - 1);
        const nextEnd = Math.max(start, Math.min(pointIndex, max));
        trims[riderId] = { ...existingTrim, endPointIndex: nextEnd };
        riderSelection[riderId] = { ...(riderSelection[riderId] ?? { startSelected: false }), endSelected: true };
      }

      const selected = allIncludedRidersSelected(riderSelection, state.includeInComparison);
      const nextPhase = state.referenceRoute
        ? "built"
        : selected.starts
          ? selected.ends
            ? "ready_to_build"
            : "select_end"
          : "select_start";

      return {
        trims,
        riderSelection,
        selectionPhase: nextPhase,
        referenceRoute: state.referenceRoute && state.selectionPhase !== "built" ? undefined : state.referenceRoute
      };
    }),
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
        },
        referenceRoute: undefined,
        selectionPhase: state.selectionPhase === "built" ? "ready_to_build" : state.selectionPhase
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
        },
        referenceRoute: undefined,
        selectionPhase: state.selectionPhase === "built" ? "ready_to_build" : state.selectionPhase
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
        },
        referenceRoute: undefined,
        selectionPhase: state.selectionPhase === "built" ? "ready_to_build" : state.selectionPhase
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
        },
        referenceRoute: undefined,
        selectionPhase: state.selectionPhase === "built" ? "ready_to_build" : state.selectionPhase
      };
    }),
  setSelectedPoint: (selectedPoint) => set({ selectedPoint }),
  setReferenceRoute: (referenceRoute, built = false) =>
    set((state) => {
      const selected = allIncludedRidersSelected(state.riderSelection, state.includeInComparison);
      const selectionPhase = built && referenceRoute
        ? "built"
        : selected.starts
          ? selected.ends
            ? "ready_to_build"
            : "select_end"
          : "select_start";
      return {
        referenceRoute,
        selectionPhase,
        progressDistanceM: 0
      };
    }),
  setProgressDistanceM: (progressDistanceM) => set({ progressDistanceM }),
  reset: () =>
    set({
      tracks: [],
      warnings: {},
      trims: {},
      riderSettings: {},
      riderSelection: {},
      includeInComparison: {},
      selectionPhase: "select_start",
      compareToRiderId: undefined,
      progressDistanceM: 0,
      selectedPoint: undefined,
      referenceRoute: undefined
    })
}));
