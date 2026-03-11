import { appStore } from "../app/store";

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
    const { tracks, warnings, trims, selectedPoint } = appStore.getState();
    if (tracks.length === 0) {
      list.innerHTML = "<p>No tracks uploaded yet.</p>";
      return;
    }
    list.innerHTML = tracks
      .map((track) => {
        const trim = trims[track.riderId];
        const selectedForRider =
          selectedPoint?.riderId === track.riderId ? selectedPoint.pointIndex : undefined;
        const riderWarnings = warnings[track.riderId] ?? [];
        const warningHtml =
          riderWarnings.length === 0
            ? "<li>None</li>"
            : riderWarnings.map((w) => `<li>${w.message}</li>`).join("");
        return `
          <article class="rider-card">
            <h3>${track.riderId}</h3>
            <p><strong>File:</strong> ${track.fileName}</p>
            <p><strong>Points:</strong> ${track.points.length}</p>
            <p><strong>First timestamp:</strong> ${track.points[0]?.time ?? "N/A"}</p>
            <p><strong>Trim start:</strong> ${trim?.startPointIndex ?? 0}</p>
            <p><strong>Trim end:</strong> ${trim?.endPointIndex ?? Math.max(0, track.points.length - 1)}</p>
            <p><strong>Selected point:</strong> ${selectedForRider ?? "none (click a map point)"}</p>
            <div class="trim-controls">
              <button data-action="set-start" data-rider="${track.riderId}" type="button">Set start from selected</button>
              <button data-action="set-end" data-rider="${track.riderId}" type="button">Set end from selected</button>
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

    const { selectedPoint } = appStore.getState();
    if (action === "set-start") {
      if (selectedPoint?.riderId !== riderId) {
        return;
      }
      appStore.getState().setTrimStart(riderId, selectedPoint.pointIndex);
    } else if (action === "set-end") {
      if (selectedPoint?.riderId !== riderId) {
        return;
      }
      appStore.getState().setTrimEnd(riderId, selectedPoint.pointIndex);
    } else if (action === "start-minus") {
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
