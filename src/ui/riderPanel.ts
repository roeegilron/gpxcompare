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
    const { tracks, warnings } = appStore.getState();
    if (tracks.length === 0) {
      list.innerHTML = "<p>No tracks uploaded yet.</p>";
      return;
    }
    list.innerHTML = tracks
      .map((track) => {
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
            <ul>${warningHtml}</ul>
          </article>
        `;
      })
      .join("");
  };

  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
