import { appStore } from "../app/store";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createRiderPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `<h2>Riders</h2><div id="rider-list"></div>`;
  container.append(panel);

  const list = panel.querySelector<HTMLDivElement>("#rider-list");
  if (!list) {
    throw new Error("Rider list missing");
  }

  const render = (): void => {
    const { tracks, warnings, trims, selectedPoint, riderSettings, riderSelection, includeInComparison } =
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
        const selectedForRider =
          selectedPoint?.riderId === track.riderId ? selectedPoint.pointIndex : undefined;
        const riderWarnings = warnings[track.riderId] ?? [];
        const warningHtml =
          riderWarnings.length === 0
            ? "<li>None</li>"
            : riderWarnings.map((w) => `<li>${w.message}</li>`).join("");
        return `
          <article class="rider-card">
            <h3>${escapeHtml(displayName)}</h3>
            <p><strong>File:</strong> ${escapeHtml(track.fileName)}</p>
            <p><strong>Rider ID:</strong> ${escapeHtml(track.riderId)}</p>
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
            <p><strong>Points:</strong> ${track.points.length}</p>
            <p><strong>First timestamp:</strong> ${track.points[0]?.time ?? "N/A"}</p>
            <p><strong>Trim start:</strong> ${trim?.startPointIndex ?? 0}</p>
            <p><strong>Trim end:</strong> ${trim?.endPointIndex ?? Math.max(0, track.points.length - 1)}</p>
            <p><strong>Start selected:</strong> ${selection?.startSelected ? "yes" : "no"}</p>
            <p><strong>End selected:</strong> ${selection?.endSelected ? "yes" : "no"}</p>
            <p><strong>Selected point:</strong> ${selectedForRider ?? "none (click a map point)"}</p>
            <div class="trim-controls">
              <button data-action="start-minus" data-rider="${track.riderId}" type="button">Start -1</button>
              <button data-action="start-plus" data-rider="${track.riderId}" type="button">Start +1</button>
              <button data-action="end-minus" data-rider="${track.riderId}" type="button">End -1</button>
              <button data-action="end-plus" data-rider="${track.riderId}" type="button">End +1</button>
            </div>
            <ul>${warningHtml}</ul>
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

    if (action === "start-minus") {
      appStore.getState().nudgeTrimStart(riderId, -1);
    } else if (action === "start-plus") {
      appStore.getState().nudgeTrimStart(riderId, 1);
    } else if (action === "end-minus") {
      appStore.getState().nudgeTrimEnd(riderId, -1);
    } else if (action === "end-plus") {
      appStore.getState().nudgeTrimEnd(riderId, 1);
    }

    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
  render();
}
