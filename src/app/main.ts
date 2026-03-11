import "./style.css";
import "leaflet/dist/leaflet.css";
import { mountAppShell } from "./router";
import { initMap } from "../map/map";
import { createUploadPanel } from "../ui/uploadPanel";
import { createRiderPanel } from "../ui/riderPanel";
import { createRoutePanel } from "../ui/routePanel";
import { createPlaybackPanel } from "../ui/playbackPanel";
import { createChartsPanel } from "../ui/chartsPanel";
import { createCompareTable } from "../ui/compareTable";
import { createPointInspector } from "../ui/pointInspector";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app root");
}

const shell = mountAppShell(root);
initMap(shell);
createUploadPanel(shell);
createRiderPanel(shell);
createRoutePanel(shell);
createPlaybackPanel(shell);
createChartsPanel(shell);
createCompareTable(shell);
createPointInspector(shell);
