import { parseGpxFile } from "../domain/gpx";
import { validateTrack } from "../domain/validation";
import { appStore } from "../app/store";

const MAX_FILES = 5;

function riderId(index: number): string {
  return `rider-${index + 1}`;
}

export function createUploadPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Upload GPX files</h2>
    <p>Upload up to 5 riders. This MVP parses every raw trackpoint.</p>
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
      let nextRiderNumber = appStore.getState().tracks.length + 1;
      for (const file of files) {
        const currentCount = appStore.getState().tracks.length;
        if (currentCount >= MAX_FILES || nextRiderNumber > MAX_FILES) {
          break;
        }
        const track = await parseGpxFile(file, riderId(nextRiderNumber - 1));
        const warnings = validateTrack(track);
        appStore.getState().addTrack(track, warnings);
        nextRiderNumber += 1;
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
