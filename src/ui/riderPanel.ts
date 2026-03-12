import { appStore } from "../app/store";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSegmentDurationMs(startMs?: number, endMs?: number): string {
  if (startMs === undefined || endMs === undefined || endMs < startMs) {
    return "--";
  }
  const seconds = (endMs - startMs) / 1000;
  return `${seconds.toFixed(2)}s`;
}

export function createRiderPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel riders-panel";
  panel.innerHTML = `<h2>Riders</h2><div id="rider-list"></div>`;
  container.append(panel);

  const list = panel.querySelector<HTMLDivElement>("#rider-list");
  if (!list) {
    throw new Error("Rider list missing");
  }

  const render = (): void => {
    const { tracks, warnings, trims, selectedPoint, riderSettings, riderSelection, includeInComparison, routeNeedsRebuild } =
      appStore.getState();
    if (tracks.length === 0) {
      list.innerHTML = "<p>No tracks uploaded yet.</p>";
      return;
    }
    list.innerHTML = tracks
      .map((track) => {
        const settings = riderSettings[track.riderId];
        const displayName = settings?.name ?? track.riderId;
        const trim = trims[track.riderId];
        const selection = riderSelection[track.riderId];
        const startPoint = trim ? track.points[trim.startPointIndex] : undefined;
        const endPoint = trim ? track.points[trim.endPointIndex] : undefined;
        const segmentTime = formatSegmentDurationMs(startPoint?.timeMs, endPoint?.timeMs);
        const selectedForRider =
          selectedPoint?.riderId === track.riderId ? selectedPoint.pointIndex : undefined;
        const riderWarnings = warnings[track.riderId] ?? [];
        const warningText =
          riderWarnings.length === 0
            ? "none"
            : riderWarnings.map((w) => w.message).join(" | ");
        return `
          <article class="rider-card">
            <div class="rider-card-header">
              <h3>${escapeHtml(displayName)}</h3>
              <span class="rider-meta">${escapeHtml(track.fileName)}</span>
              <span class="rider-meta">pts: ${track.points.length}</span>
              <span class="rider-meta">time: ${segmentTime}</span>
              <span class="rider-meta">${routeNeedsRebuild ? "needs rebuild" : "ready"}</span>
            </div>
            <div class="rider-edit-row">
              <label>
                Name
                <input
                  data-action="name-input"
                  data-rider="${track.riderId}"
                  type="text"
                  value="${escapeHtml(displayName)}"
                />
              </label>
              <label>
                Color
                <input
                  data-action="color-input"
                  data-rider="${track.riderId}"
                  type="color"
                  value="${settings?.color ?? "#3b82f6"}"
                />
              </label>
              <label>
                Compare
                <input
                  data-action="include-comparison"
                  data-rider="${track.riderId}"
                  type="checkbox"
                  ${includeInComparison[track.riderId] ? "checked" : ""}
                />
              </label>
            </div>
            <div class="rider-status-row">
              <span>S: ${trim?.startPointIndex ?? 0} (${selection?.startSelected ? "set" : "unset"})</span>
              <span>E: ${trim?.endPointIndex ?? Math.max(0, track.points.length - 1)} (${selection?.endSelected ? "set" : "unset"})</span>
              <span>Selected: ${selectedForRider ?? "none"}</span>
            </div>
            <div class="trim-controls compact">
              <button data-action="zoom-start" data-rider="${track.riderId}" type="button">Zoom S</button>
              <button data-action="start-minus-5" data-rider="${track.riderId}" type="button">S-5</button>
              <button data-action="start-minus" data-rider="${track.riderId}" type="button">S-1</button>
              <button data-action="start-plus" data-rider="${track.riderId}" type="button">S+1</button>
              <button data-action="start-plus-5" data-rider="${track.riderId}" type="button">S+5</button>
              <button data-action="zoom-end" data-rider="${track.riderId}" type="button">Zoom E</button>
              <button data-action="end-minus-5" data-rider="${track.riderId}" type="button">E-5</button>
              <button data-action="end-minus" data-rider="${track.riderId}" type="button">E-1</button>
              <button data-action="end-plus" data-rider="${track.riderId}" type="button">E+1</button>
              <button data-action="end-plus-5" data-rider="${track.riderId}" type="button">E+5</button>
            </div>
            <div class="rider-warning-row">
              <strong>Warnings:</strong> ${escapeHtml(warningText)}
            </div>
          </article>
        `;
      })
      .join("");
  };

  window.addEventListener("gpxcompare:state-changed", render);
  list.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const riderId = target.dataset.rider;
    const action = target.dataset.action;
    if (!riderId || !action) {
      return;
    }
    if (action === "name-input") {
      appStore.getState().setRiderName(riderId, target.value);
      window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
    } else if (action === "color-input") {
      appStore.getState().setRiderColor(riderId, target.value);
      window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
    } else if (action === "include-comparison") {
      appStore.getState().setIncludeInComparison(riderId, target.checked);
      window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
    }
  });
  list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const riderId = target.dataset.rider;
    const action = target.dataset.action;
    if (!riderId || !action) {
      return;
    }

    if (action === "zoom-start") {
      appStore.getState().requestFocusRiderPoint(riderId, "start");
    } else if (action === "zoom-end") {
      appStore.getState().requestFocusRiderPoint(riderId, "end");
    } else if (action === "start-minus-5") {
      appStore.getState().nudgeTrimStart(riderId, -5);
    } else if (action === "start-minus") {
      appStore.getState().nudgeTrimStart(riderId, -1);
    } else if (action === "start-plus") {
      appStore.getState().nudgeTrimStart(riderId, 1);
    } else if (action === "start-plus-5") {
      appStore.getState().nudgeTrimStart(riderId, 5);
    } else if (action === "end-minus-5") {
      appStore.getState().nudgeTrimEnd(riderId, -5);
    } else if (action === "end-minus") {
      appStore.getState().nudgeTrimEnd(riderId, -1);
    } else if (action === "end-plus") {
      appStore.getState().nudgeTrimEnd(riderId, 1);
    } else if (action === "end-plus-5") {
      appStore.getState().nudgeTrimEnd(riderId, 5);
    }

    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  render();
}
