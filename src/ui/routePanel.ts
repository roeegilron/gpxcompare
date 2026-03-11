import { appStore } from "../app/store";
import { buildConsensusRoute } from "../domain/consensusRoute";
import { buildComparisonDataset, leaderRiderId } from "../domain/comparison";
import type { RiderTrack, RiderTrim } from "../types/gpx";

export function createRoutePanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Reference Route</h2>
    <p>Workflow: click selection mode, draw a box on map, adjust draggable S/E pins, then build route.</p>
    <div class="trim-controls">
      <button id="phase-start" type="button">1) Select starts (draw box)</button>
      <button id="phase-end" type="button">2) Select ends (draw box)</button>
    </div>
    <button id="build-consensus" type="button">3) Build consensus route (0.5m)</button>
    <button id="zoom-route" type="button">Zoom to compare route</button>
    <label><input id="lock-zoom" type="checkbox" /> Lock zoom</label>
    <button id="clear-route" type="button">Clear route</button>
    <label>
      Compare to rider
      <select id="compare-rider"></select>
    </label>
    <div id="selection-status"></div>
    <div id="route-status"></div>
  `;
  container.append(panel);

  const buildBtn = panel.querySelector<HTMLButtonElement>("#build-consensus");
  const clearBtn = panel.querySelector<HTMLButtonElement>("#clear-route");
  const phaseStartBtn = panel.querySelector<HTMLButtonElement>("#phase-start");
  const phaseEndBtn = panel.querySelector<HTMLButtonElement>("#phase-end");
  const zoomRouteBtn = panel.querySelector<HTMLButtonElement>("#zoom-route");
  const lockZoomInput = panel.querySelector<HTMLInputElement>("#lock-zoom");
  const compareSelect = panel.querySelector<HTMLSelectElement>("#compare-rider");
  const selectionStatus = panel.querySelector<HTMLDivElement>("#selection-status");
  const status = panel.querySelector<HTMLDivElement>("#route-status");
  if (
    !buildBtn ||
    !clearBtn ||
    !status ||
    !phaseStartBtn ||
    !phaseEndBtn ||
    !zoomRouteBtn ||
    !lockZoomInput ||
    !compareSelect ||
    !selectionStatus
  ) {
    throw new Error("Route panel failed to initialize");
  }

  const render = (): void => {
    const {
      referenceRoute,
      tracks,
      riderSelection,
      includeInComparison,
      selectionPhase,
      compareToRiderId,
      startPin,
      endPin,
      lockZoom,
      routeNeedsRebuild
    } = appStore.getState();
    const includedTracks = tracks.filter((track) => includeInComparison[track.riderId]);
    const allStarts =
      includedTracks.length > 0 &&
      includedTracks.every((track) => riderSelection[track.riderId]?.startSelected === true);
    const allEnds =
      includedTracks.length > 0 &&
      includedTracks.every((track) => riderSelection[track.riderId]?.endSelected === true);

    phaseStartBtn.disabled = false;
    phaseEndBtn.disabled = !allStarts || selectionPhase === "built";
    buildBtn.disabled = !(allStarts && allEnds);
    zoomRouteBtn.disabled = !referenceRoute;
    lockZoomInput.checked = lockZoom;

    compareSelect.innerHTML = includedTracks
      .map((track) => {
        const riderName = appStore.getState().riderSettings[track.riderId]?.name ?? track.riderId;
        const selected = (compareToRiderId ?? "") === track.riderId ? "selected" : "";
        return `<option value="${track.riderId}" ${selected}>${riderName}</option>`;
      })
      .join("");

    selectionStatus.innerHTML = includedTracks
      .map((track) => {
        const riderName = appStore.getState().riderSettings[track.riderId]?.name ?? track.riderId;
        const rider = riderSelection[track.riderId];
        return `<div>${riderName}: start ${rider?.startSelected ? "OK" : "missing"}, end ${rider?.endSelected ? "OK" : "missing"}</div>`;
      })
      .join("");

    if (!referenceRoute) {
      status.textContent = `No reference route yet. Phase: ${selectionPhase}.`;
      if (!startPin || !endPin) {
        status.textContent += " Draw start and end boxes to place S/E pins.";
      }
      return;
    }
    status.textContent = `Route points: ${referenceRoute.coordinates.length}. Source: ${referenceRoute.source}. Phase: ${selectionPhase}.`;
    if (routeNeedsRebuild) {
      status.textContent += " Trim points changed after build; rebuild route to refresh comparison.";
    }
  };

  buildBtn.addEventListener("click", () => {
    try {
      const { tracks, trims, includeInComparison } = appStore.getState();
      const inputs = tracks.reduce<Array<{ track: RiderTrack; trim: RiderTrim }>>((acc, track) => {
        const trim = trims[track.riderId];
        if (trim && includeInComparison[track.riderId]) {
          acc.push({ track, trim });
        }
        return acc;
      }, []);
      const route = buildConsensusRoute(inputs, 0.5);
      const includedIds = tracks.filter((track) => includeInComparison[track.riderId]).map((track) => track.riderId);
      appStore.getState().setReferenceRoute(route, true);
      if (includedIds.length > 0) {
        const dataset = buildComparisonDataset(
          tracks.filter((track) => includeInComparison[track.riderId]),
          trims,
          route
        );
        const leaderId = leaderRiderId(dataset, includedIds);
        appStore.getState().setCompareToRider(leaderId ?? includedIds[0]);
      }
      window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Failed to build reference route.";
    }
  });

  clearBtn.addEventListener("click", () => {
    appStore.getState().setReferenceRoute(undefined, false);
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  phaseStartBtn.addEventListener("click", () => {
    appStore.getState().setSelectionPhase("select_start");
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  phaseEndBtn.addEventListener("click", () => {
    appStore.getState().setSelectionPhase("select_end");
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  compareSelect.addEventListener("change", () => {
    appStore.getState().setCompareToRider(compareSelect.value);
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  zoomRouteBtn.addEventListener("click", () => {
    appStore.getState().requestZoomToRoute();
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  lockZoomInput.addEventListener("change", () => {
    appStore.getState().setLockZoom(lockZoomInput.checked);
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });

  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
