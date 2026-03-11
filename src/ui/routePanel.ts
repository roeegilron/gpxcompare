import { appStore } from "../app/store";
import { buildConsensusRoute } from "../domain/consensusRoute";
import type { RiderTrack, RiderTrim } from "../types/gpx";

export function createRoutePanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Reference Route</h2>
    <p>Build a consensus route from each rider's trimmed start/end segment.</p>
    <button id="build-consensus" type="button">Build consensus route from trims</button>
    <button id="clear-route" type="button">Clear route</button>
    <div id="route-status"></div>
  `;
  container.append(panel);

  const buildBtn = panel.querySelector<HTMLButtonElement>("#build-consensus");
  const clearBtn = panel.querySelector<HTMLButtonElement>("#clear-route");
  const status = panel.querySelector<HTMLDivElement>("#route-status");
  if (!buildBtn || !clearBtn || !status) {
    throw new Error("Route panel failed to initialize");
  }

  const render = (): void => {
    const { referenceRoute } = appStore.getState();
    if (!referenceRoute) {
      status.textContent = "No reference route yet.";
      return;
    }
    status.textContent = `Route points: ${referenceRoute.coordinates.length}. Source: ${referenceRoute.source}.`;
  };

  buildBtn.addEventListener("click", () => {
    try {
      const { tracks, trims } = appStore.getState();
      const inputs = tracks.reduce<Array<{ track: RiderTrack; trim: RiderTrim }>>((acc, track) => {
        const trim = trims[track.riderId];
        if (trim) {
          acc.push({ track, trim });
        }
        return acc;
      }, []);
      const route = buildConsensusRoute(inputs);
      appStore.getState().setReferenceRoute(route);
      window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Failed to build reference route.";
    }
  });

  clearBtn.addEventListener("click", () => {
    appStore.getState().setReferenceRoute(undefined);
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });

  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
