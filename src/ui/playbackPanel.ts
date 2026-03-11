import { appStore } from "../app/store";

export function createPlaybackPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Playback</h2>
    <label>
      Route progress
      <input id="progress-slider" type="range" min="0" max="1000" value="0" />
    </label>
    <div id="progress-label"></div>
  `;
  container.append(panel);

  const slider = panel.querySelector<HTMLInputElement>("#progress-slider");
  const label = panel.querySelector<HTMLDivElement>("#progress-label");
  if (!slider || !label) {
    throw new Error("Playback panel failed to initialize");
  }

  slider.addEventListener("input", () => {
    const { referenceRoute } = appStore.getState();
    const maxDistance = referenceRoute?.cumulativeDistanceM[referenceRoute.cumulativeDistanceM.length - 1] ?? 0;
    const ratio = Number(slider.value) / Number(slider.max);
    appStore.getState().setProgressDistanceM(ratio * maxDistance);
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });

  const render = (): void => {
    const { referenceRoute, progressDistanceM } = appStore.getState();
    const maxDistance = referenceRoute?.cumulativeDistanceM[referenceRoute.cumulativeDistanceM.length - 1] ?? 0;
    if (maxDistance <= 0) {
      slider.disabled = true;
      slider.value = "0";
      label.textContent = "Build route to enable playback.";
      return;
    }
    slider.disabled = false;
    const ratio = maxDistance === 0 ? 0 : progressDistanceM / maxDistance;
    slider.value = String(Math.max(0, Math.min(1000, Math.round(ratio * 1000))));
    label.textContent = `${progressDistanceM.toFixed(1)}m / ${maxDistance.toFixed(1)}m`;
  };

  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
