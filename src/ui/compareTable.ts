import { appStore } from "../app/store";
import { buildComparisonDataset } from "../domain/comparison";

function formatMs(value?: number): string {
  if (value === undefined) {
    return "--";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value / 1000).toFixed(1)}s`;
}

function elapsedAtDistance(series: Array<number | undefined>, idx: number): number | undefined {
  return series[Math.max(0, Math.min(idx, series.length - 1))];
}

function speedAtIndexMps(
  fractions: number[],
  totalDistanceM: number,
  elapsedSeries: Array<number | undefined>,
  idx: number,
  windowFraction = 0.03
): number | undefined {
  const hereDistance = (fractions[idx] ?? 0) * totalDistanceM;
  const hereTime = elapsedAtDistance(elapsedSeries, idx);
  if (hereDistance === undefined || hereTime === undefined) {
    return undefined;
  }
  let backIdx = idx;
  while (
    backIdx > 0 &&
    (hereDistance - ((fractions[backIdx] ?? (fractions[idx] ?? 0)) * totalDistanceM)) <
      windowFraction * totalDistanceM
  ) {
    backIdx -= 1;
  }
  const backDistance = (fractions[backIdx] ?? 0) * totalDistanceM;
  const backTime = elapsedAtDistance(elapsedSeries, backIdx);
  if (backDistance === undefined || backTime === undefined) {
    return undefined;
  }
  const dt = (hereTime - backTime) / 1000;
  if (dt <= 0) {
    return undefined;
  }
  return (hereDistance - backDistance) / dt;
}

export function createCompareTable(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Comparison Table</h2>
    <div id="compare-table"></div>
  `;
  container.append(panel);

  const root = panel.querySelector<HTMLDivElement>("#compare-table");
  if (!root) {
    throw new Error("Comparison table failed to initialize");
  }

  const render = (): void => {
    const { tracks, trims, selectionPhase, includeInComparison, compareToRiderId, progressDistanceM, riderSettings } =
      appStore.getState();
    if (selectionPhase !== "built" || !compareToRiderId) {
      root.innerHTML = "<p>Build timing comparison to enable table.</p>";
      return;
    }
    const included = tracks.filter((track) => includeInComparison[track.riderId]);
    const dataset = buildComparisonDataset(included, trims, 350);
    const fractions = dataset.stationFractions;
    const targetFraction = Math.max(0, Math.min(1, progressDistanceM));
    const idx = fractions.findIndex((fraction) => fraction >= targetFraction);
    const fractionIdx = idx === -1 ? Math.max(0, fractions.length - 1) : idx;

    const baseData = dataset.byRider[compareToRiderId];
    const baseSeries = baseData?.elapsedMsAtFraction;
    if (!baseSeries) {
      root.innerHTML = "<p>Select a compare rider in Reference Route panel.</p>";
      return;
    }
    const baseElapsed = elapsedAtDistance(baseSeries, fractionIdx);
    const baseSpeed = speedAtIndexMps(fractions, baseData.totalDistanceM, baseSeries, fractionIdx);

    const rows = included
      .map((track) => {
        const settings = riderSettings[track.riderId];
        const riderData = dataset.byRider[track.riderId];
        const series = riderData?.elapsedMsAtFraction;
        const elapsed = series ? elapsedAtDistance(series, fractionIdx) : undefined;
        const gap = elapsed !== undefined && baseElapsed !== undefined ? elapsed - baseElapsed : undefined;
        const speed = series
          ? speedAtIndexMps(fractions, riderData?.totalDistanceM ?? 0, series, fractionIdx)
          : undefined;
        const speedDelta =
          speed !== undefined && baseSpeed !== undefined ? speed - baseSpeed : undefined;
        const marker = track.riderId === compareToRiderId ? "(base)" : "";
        return `
          <tr>
            <td><span style="color:${settings?.color ?? "#3b82f6"}">●</span> ${settings?.name ?? track.riderId} ${marker}</td>
            <td>${elapsed === undefined ? "--" : `${(elapsed / 1000).toFixed(1)}s`}</td>
            <td>${formatMs(gap)}</td>
            <td>${speedDelta === undefined ? "--" : `${speedDelta >= 0 ? "+" : ""}${speedDelta.toFixed(2)} m/s`}</td>
            <td>${((fractions[fractionIdx] ?? 0) * 100).toFixed(1)}%</td>
          </tr>
        `;
      })
      .join("");

    root.innerHTML = `
      <table class="compare-grid">
        <thead>
          <tr><th>Athlete</th><th>Elapsed</th><th>Gap</th><th>Speed Δ</th><th>Progress</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
