import { appStore } from "../app/store";
import { buildComparisonDataset, gapSeriesMs } from "../domain/comparison";

export function createChartsPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel chart-panel";
  panel.innerHTML = `
    <h2>Gap Chart (time vs route distance)</h2>
    <svg id="gap-chart" viewBox="0 0 1000 320" preserveAspectRatio="none"></svg>
    <div id="chart-caption"></div>
  `;
  container.append(panel);

  const chart = panel.querySelector<SVGElement>("#gap-chart");
  const caption = panel.querySelector<HTMLDivElement>("#chart-caption");
  if (!chart || !caption) {
    throw new Error("Chart panel failed to initialize");
  }

  const render = (): void => {
    const { tracks, trims, selectionPhase, includeInComparison, compareToRiderId, riderSettings } =
      appStore.getState();
    if (selectionPhase !== "built" || !compareToRiderId) {
      chart.innerHTML = "";
      caption.textContent = "Build timing comparison and choose a compare rider to view chart.";
      return;
    }

    const includedTracks = tracks.filter((track) => includeInComparison[track.riderId]);
    const dataset = buildComparisonDataset(includedTracks, trims, 350);
    const fractions = dataset.stationFractions;
    const baseElapsed = dataset.byRider[compareToRiderId]?.elapsedMsAtFraction ?? [];
    const totalBaseElapsedMs =
      baseElapsed
        .slice()
        .reverse()
        .find((value): value is number => value !== undefined) ?? 1;
    const allGaps = includedTracks.flatMap((track) =>
      gapSeriesMs(dataset, track.riderId, compareToRiderId).filter((v): v is number => v !== undefined)
    );
    const maxAbsGap = Math.max(1, ...allGaps.map((value) => Math.abs(value / 1000)));

    const toX = (elapsedMs: number): number => (elapsedMs / totalBaseElapsedMs) * 1000;
    const toY = (gapMs: number): number => 160 - ((gapMs / 1000) / maxAbsGap) * 140;

    const paths = includedTracks
      .map((track) => {
        const gaps = gapSeriesMs(dataset, track.riderId, compareToRiderId);
        const points = gaps
          .map((gap, idx) => {
            const baseMs = baseElapsed[idx];
            if (gap === undefined || baseMs === undefined) {
              return "";
            }
            return `${toX(baseMs)},${toY(gap)}`;
          })
          .filter(Boolean)
          .join(" ");
        const color = riderSettings[track.riderId]?.color ?? "#3b82f6";
        return points
          ? `<polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" />`
          : "";
      })
      .join("");

    const totalSec = totalBaseElapsedMs / 1000;
    const tickStepSec = totalSec <= 60 ? 5 : totalSec <= 180 ? 10 : 20;
    const tickLines: string[] = [];
    for (let sec = 0; sec <= totalSec; sec += tickStepSec) {
      const x = (sec / totalSec) * 1000;
      tickLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="320" stroke="#e5e7eb" stroke-width="1" />`);
      tickLines.push(`<text x="${x + 2}" y="315" font-size="11" fill="#374151">${sec}s</text>`);
    }

    chart.innerHTML = `
      ${tickLines.join("")}
      <line x1="0" y1="160" x2="1000" y2="160" stroke="#111827" stroke-width="1.5" />
      <rect x="0" y="0" width="1000" height="320" fill="none" stroke="#d1d5db" />
      ${paths}
    `;
    caption.textContent =
      "X-axis is elapsed time (seconds) of compare rider. 0 line = compare rider. Positive values are behind; negative are ahead.";
  };

  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
