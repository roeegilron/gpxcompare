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

type Pin = {
  lat: number;
  lon: number;
};

type FocusTarget = "start" | "end";

const riderPalette = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.gpx$/i, "").trim() || fileName;
}

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

function nearestPointIndex(track: RiderTrack, pin: Pin, minIndex = 0, maxIndex?: number): number {
  const max = Math.min(track.points.length - 1, maxIndex ?? track.points.length - 1);
  let winner = Math.max(0, minIndex);
  let winnerDist = Number.POSITIVE_INFINITY;
  for (let i = Math.max(0, minIndex); i <= max; i += 1) {
    const point = track.points[i];
    if (!point) {
      continue;
    }
    const dLat = point.lat - pin.lat;
    const dLon = point.lon - pin.lon;
    const dist2 = dLat * dLat + dLon * dLon;
    if (dist2 < winnerDist) {
      winnerDist = dist2;
      winner = i;
    }
  }
  return winner;
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
  routeNeedsRebuild: boolean;
  startPin?: Pin;
  endPin?: Pin;
  lockZoom: boolean;
  zoomToRouteRequestId: number;
  focusRequestId: number;
  focusRiderId?: string;
  focusTarget?: FocusTarget;
  selectedPoint?: SelectedPoint;
  referenceRoute?: ReferenceRoute;
  addTrack: (track: RiderTrack, warnings: ValidationWarning[]) => void;
  setRiderName: (riderId: string, name: string) => void;
  setRiderColor: (riderId: string, color: string) => void;
  setIncludeInComparison: (riderId: string, include: boolean) => void;
  setCompareToRider: (riderId?: string) => void;
  setSelectionPhase: (phase: SelectionPhase) => void;
  setStartPin: (pin?: Pin) => void;
  setEndPin: (pin?: Pin) => void;
  applyPinToIncludedRiders: (phase: "start" | "end") => void;
  setLockZoom: (lock: boolean) => void;
  requestZoomToRoute: () => void;
  requestFocusRiderPoint: (riderId: string, target: FocusTarget) => void;
  setTrimStart: (riderId: string, pointIndex: number) => void;
  setTrimEnd: (riderId: string, pointIndex: number) => void;
  nudgeTrimStart: (riderId: string, delta: number) => void;
  nudgeTrimEnd: (riderId: string, delta: number) => void;
  setSelectedPoint: (selected?: SelectedPoint) => void;
  setReferenceRoute: (route?: ReferenceRoute, built?: boolean) => void;
  setProgressDistanceM: (distanceM: number) => void;
  reset: () => void;
};

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
  routeNeedsRebuild: false,
  startPin: undefined,
  endPin: undefined,
  lockZoom: false,
  zoomToRouteRequestId: 0,
  focusRequestId: 0,
  focusRiderId: undefined,
  focusTarget: undefined,
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
        selectionPhase: nextPhase,
        routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild
      };
    }),
  setCompareToRider: (compareToRiderId) => set({ compareToRiderId }),
  setSelectionPhase: (selectionPhase) => set({ selectionPhase }),
  setStartPin: (startPin) =>
    set((state) => ({
      startPin,
      routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild,
      selectionPhase: state.selectionPhase
    })),
  setEndPin: (endPin) =>
    set((state) => ({
      endPin,
      routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild,
      selectionPhase: state.selectionPhase
    })),
  applyPinToIncludedRiders: (phase) =>
    set((state) => {
      const pin = phase === "start" ? state.startPin : state.endPin;
      if (!pin) {
        return state;
      }
      const trims = { ...state.trims };
      const riderSelection = { ...state.riderSelection };
      state.tracks.forEach((track) => {
        if (!state.includeInComparison[track.riderId]) {
          return;
        }
        const existing = trims[track.riderId];
        if (!existing) {
          return;
        }
        if (phase === "start") {
          const idx = nearestPointIndex(track, pin, 0, existing.endPointIndex);
          trims[track.riderId] = {
            ...existing,
            startPointIndex: idx,
            normalizedStartTimeMs: track.points[idx]?.timeMs
          };
          riderSelection[track.riderId] = {
            ...(riderSelection[track.riderId] ?? { endSelected: false }),
            startSelected: true
          };
        } else {
          const idx = nearestPointIndex(track, pin, existing.startPointIndex);
          trims[track.riderId] = { ...existing, endPointIndex: idx };
          riderSelection[track.riderId] = {
            ...(riderSelection[track.riderId] ?? { startSelected: false }),
            endSelected: true
          };
        }
      });

      const selected = allIncludedRidersSelected(riderSelection, state.includeInComparison);
      const selectionPhase = state.referenceRoute
        ? "built"
        : selected.starts
          ? selected.ends
            ? "ready_to_build"
            : "select_end"
          : "select_start";
      return {
        trims,
        riderSelection,
        selectionPhase,
        routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild
      };
    }),
  setLockZoom: (lockZoom) => set({ lockZoom }),
  requestZoomToRoute: () => set((state) => ({ zoomToRouteRequestId: state.zoomToRouteRequestId + 1 })),
  requestFocusRiderPoint: (focusRiderId, focusTarget) =>
    set((state) => ({
      focusRequestId: state.focusRequestId + 1,
      focusRiderId,
      focusTarget
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
        },
        riderSelection: {
          ...state.riderSelection,
          [riderId]: { ...(state.riderSelection[riderId] ?? { endSelected: false }), startSelected: true }
        },
        routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild,
        selectionPhase: state.selectionPhase
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
        riderSelection: {
          ...state.riderSelection,
          [riderId]: { ...(state.riderSelection[riderId] ?? { startSelected: false }), endSelected: true }
        },
        routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild,
        selectionPhase: state.selectionPhase
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
        routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild,
        selectionPhase: state.selectionPhase
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
        routeNeedsRebuild: state.referenceRoute ? true : state.routeNeedsRebuild,
        selectionPhase: state.selectionPhase
      };
    }),
  setSelectedPoint: (selectedPoint) => set({ selectedPoint }),
  setReferenceRoute: (referenceRoute, built = false) =>
    set((state) => {
      const selected = allIncludedRidersSelected(state.riderSelection, state.includeInComparison);
      const selectionPhase =
        built && referenceRoute
          ? "built"
          : selected.starts
            ? selected.ends
              ? "ready_to_build"
              : "select_end"
            : "select_start";
      return {
        referenceRoute,
        selectionPhase,
        routeNeedsRebuild: false,
        progressDistanceM: 0,
        zoomToRouteRequestId: referenceRoute ? state.zoomToRouteRequestId + 1 : state.zoomToRouteRequestId
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
      routeNeedsRebuild: false,
      startPin: undefined,
      endPin: undefined,
      lockZoom: false,
      zoomToRouteRequestId: 0,
      focusRequestId: 0,
      focusRiderId: undefined,
      focusTarget: undefined,
      selectedPoint: undefined,
      referenceRoute: undefined
    })
}));
