import { parseGpxFile } from "../domain/gpx";
import { validateTrack } from "../domain/validation";
import { appStore } from "../app/store";

const MAX_FILES = 5;

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.gpx$/i, "").trim() || "rider";
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "rider";
}

function uniqueRiderId(fileName: string, taken: Set<string>): string {
  const base = slugify(fileBaseName(fileName));
  if (!taken.has(base)) {
    return base;
  }
  let count = 2;
  while (taken.has(`${base}-${count}`)) {
    count += 1;
  }
  return `${base}-${count}`;
}

export function createUploadPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel upload-panel";
  panel.innerHTML = `
    <h2>Upload GPX files</h2>
    <p>Upload up to 5 riders. This MVP parses every raw trackpoint.</p>
    <p><a href="./how-to-use.html" target="_blank" rel="noreferrer">How to use (detailed guide)</a></p>
    <input id="gpx-input" type="file" accept=".gpx" multiple />
    <button id="reset-btn" type="button">Reset session</button>
    <div id="upload-error" role="alert"></div>
  `;

  container.append(panel);
  const input = panel.querySelector<HTMLInputElement>("#gpx-input");
  const resetBtn = panel.querySelector<HTMLButtonElement>("#reset-btn");
  const errorBox = panel.querySelector<HTMLDivElement>("#upload-error");

  if (!input || !resetBtn || !errorBox) {
    throw new Error("Upload panel failed to initialize");
  }

  input.addEventListener("change", async () => {
    errorBox.textContent = "";
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }
    if (files.length > MAX_FILES) {
      errorBox.textContent = `Select up to ${MAX_FILES} files at a time.`;
      return;
    }

    try {
      const existingIds = new Set(appStore.getState().tracks.map((track) => track.riderId));
      for (const file of files) {
        const currentCount = appStore.getState().tracks.length;
        if (currentCount >= MAX_FILES) {
          break;
        }
        const riderId = uniqueRiderId(file.name, existingIds);
        existingIds.add(riderId);
        const track = await parseGpxFile(file, riderId);
        const warnings = validateTrack(track);
        appStore.getState().addTrack(track, warnings);
      }
      window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : "Failed to parse GPX file.";
    } finally {
      input.value = "";
    }
  });

  resetBtn.addEventListener("click", () => {
    appStore.getState().reset();
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });
}
