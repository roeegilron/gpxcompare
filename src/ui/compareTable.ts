import { appStore } from "../app/store";
import { buildComparisonDataset } from "../domain/comparison";

type TimeFormat = "seconds" | "clock";

function formatMs(value: number | undefined, mode: TimeFormat): string {
  if (value === undefined) {
    return "--";
  }
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (mode === "seconds") {
    return `${sign}${(abs / 1000).toFixed(3)}s`;
  }
  const totalSeconds = abs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${sign}${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
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
  panel.className = "panel compare-panel";
  panel.innerHTML = `
    <h2>Comparison Table</h2>
    <div class="compare-format-row">
      <label>Time format</label>
      <button id="format-clock" type="button">mm:ss.fff</button>
      <button id="format-seconds" type="button">seconds</button>
    </div>
    <div id="compare-table"></div>
  `;
  container.append(panel);

  let timeFormat: TimeFormat = "clock";
  const formatClockBtn = panel.querySelector<HTMLButtonElement>("#format-clock");
  const formatSecondsBtn = panel.querySelector<HTMLButtonElement>("#format-seconds");
  const root = panel.querySelector<HTMLDivElement>("#compare-table");
  if (!root || !formatClockBtn || !formatSecondsBtn) {
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

    const rowsData = included
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
        return {
          riderId: track.riderId,
          elapsed,
          gap,
          speedDelta,
          marker,
          color: settings?.color ?? "#3b82f6",
          name: settings?.name ?? track.riderId
        };
      })
      .sort((a, b) => {
        if (a.elapsed === undefined && b.elapsed === undefined) {
          return 0;
        }
        if (a.elapsed === undefined) {
          return 1;
        }
        if (b.elapsed === undefined) {
          return -1;
        }
        return a.elapsed - b.elapsed;
      });

    const rows = rowsData
      .map((row) => `
          <tr>
            <td><span style="color:${row.color}">●</span> ${row.name} ${row.marker}</td>
            <td>${formatMs(row.elapsed, timeFormat)}</td>
            <td>${formatMs(row.gap, timeFormat)}</td>
            <td>${row.speedDelta === undefined ? "--" : `${row.speedDelta >= 0 ? "+" : ""}${row.speedDelta.toFixed(2)} m/s`}</td>
            <td>${((fractions[fractionIdx] ?? 0) * 100).toFixed(1)}%</td>
          </tr>
        `)
      .join("");

    const totals = included
      .map((track) => {
        const settings = riderSettings[track.riderId];
        const total = dataset.byRider[track.riderId]?.totalElapsedMs;
        return `<div><span style="color:${settings?.color ?? "#3b82f6"}">●</span> ${settings?.name ?? track.riderId}: ${formatMs(total, timeFormat)}</div>`;
      })
      .join("");

    formatClockBtn.disabled = timeFormat === "clock";
    formatSecondsBtn.disabled = timeFormat === "seconds";

    const timeUnitLabel = timeFormat === "clock" ? "mm:ss.fff" : "seconds";
    root.innerHTML = `
      <div class="compare-totals">
        <strong>Total segment time (${timeUnitLabel})</strong>
        ${totals}
      </div>
      <table class="compare-grid">
        <thead>
          <tr><th>Athlete</th><th>Elapsed (${timeUnitLabel})</th><th>Gap (${timeUnitLabel})</th><th>Speed Δ</th><th>Progress</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  formatClockBtn.addEventListener("click", () => {
    timeFormat = "clock";
    render();
  });
  formatSecondsBtn.addEventListener("click", () => {
    timeFormat = "seconds";
    render();
  });
  window.addEventListener("gpxcompare:state-changed", render);
  render();
}
