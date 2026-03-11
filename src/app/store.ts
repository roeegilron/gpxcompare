import { createStore } from "zustand/vanilla";
import type { RiderTrack, ValidationWarning } from "../types/gpx";

export type AppState = {
  tracks: RiderTrack[];
  warnings: Record<string, ValidationWarning[]>;
  addTrack: (track: RiderTrack, warnings: ValidationWarning[]) => void;
  reset: () => void;
};

export const appStore = createStore<AppState>((set) => ({
  tracks: [],
  warnings: {},
  addTrack: (track, warnings) =>
    set((state) => ({
      tracks: [...state.tracks, track],
      warnings: { ...state.warnings, [track.riderId]: warnings }
    })),
  reset: () => set({ tracks: [], warnings: {} })
}));
