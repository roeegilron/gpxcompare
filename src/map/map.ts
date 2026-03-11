import L from "leaflet";
import { appStore } from "../app/store";
import type { RiderTrack } from "../types/gpx";

const riderColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

type PointMode = "none" | "all" | "sampled";
type BaseLayerKey = "road" | "topo" | "satellite" | "dark";

function buildBaseLayers(): Record<BaseLayerKey, L.TileLayer> {
  return {
    road: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }),
    topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenTopoMap contributors"
    }),
    satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri"
      }
    ),
    dark: L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
      }
    )
  };
}

function markerStep(mode: PointMode): number {
  switch (mode) {
    case "all":
      return 1;
    case "sampled":
      return 20;
    case "none":
      return 0;
  }
}

function renderTrackLayers(
  tracks: RiderTrack[],
  map: L.Map,
  trackLayer: L.LayerGroup,
  pointLayer: L.LayerGroup,
  showTracks: boolean,
  pointMode: PointMode
): void {
  trackLayer.clearLayers();
  pointLayer.clearLayers();

  const bounds = L.latLngBounds([]);
  tracks.forEach((track, trackIndex) => {
    const color = riderColors[trackIndex % riderColors.length] ?? "#111827";
    const latLngs = track.points.map((p) => L.latLng(p.lat, p.lon));
    latLngs.forEach((latLng) => bounds.extend(latLng));

    if (showTracks && latLngs.length >= 2) {
      L.polyline(latLngs, { color, weight: 3, opacity: 0.9 }).addTo(trackLayer);
    }

    const step = markerStep(pointMode);
    if (step === 0) {
      return;
    }
    track.points.forEach((point, idx) => {
      if (idx % step !== 0) {
        return;
      }
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 2.8,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 1
      });
      marker.bindTooltip(
        `${track.riderId} #${point.pointIndex}<br/>${point.time ?? "no-time"}<br/>${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`
      );
      marker.addTo(pointLayer);
    });
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.15));
  }
}

export function initMap(container: HTMLElement): void {
  const mapBox = document.createElement("section");
  mapBox.className = "panel map-panel";
  mapBox.innerHTML = `
    <h2>Map</h2>
    <div class="map-controls">
      <label>
        Basemap
        <select id="basemap-select">
          <option value="road">Road (OSM)</option>
          <option value="topo">Topo (OpenTopoMap)</option>
          <option value="satellite">Satellite (Esri)</option>
          <option value="dark">Dark (CARTO)</option>
        </select>
      </label>
      <label>
        <input id="show-tracks" type="checkbox" checked />
        Show tracks
      </label>
      <label>
        Point mode
        <select id="point-mode">
          <option value="none">None</option>
          <option value="sampled" selected>Sampled (every 20)</option>
          <option value="all">All points</option>
        </select>
      </label>
    </div>
    <div id="map-canvas"></div>
  `;
  container.append(mapBox);

  const canvas = mapBox.querySelector<HTMLDivElement>("#map-canvas");
  const basemapSelect = mapBox.querySelector<HTMLSelectElement>("#basemap-select");
  const showTracksInput = mapBox.querySelector<HTMLInputElement>("#show-tracks");
  const pointModeInput = mapBox.querySelector<HTMLSelectElement>("#point-mode");
  if (!canvas || !basemapSelect || !showTracksInput || !pointModeInput) {
    throw new Error("Map controls failed to initialize");
  }

  const map = L.map(canvas, { zoomControl: true }).setView([39.7392, -104.9903], 10);
  const baseLayers = buildBaseLayers();
  const resolveBaseLayer = (value: string): L.TileLayer => {
    switch (value) {
      case "topo":
        return baseLayers.topo;
      case "satellite":
        return baseLayers.satellite;
      case "dark":
        return baseLayers.dark;
      case "road":
      default:
        return baseLayers.road;
    }
  };

  let activeBase: L.TileLayer = resolveBaseLayer("road");
  activeBase.addTo(map);

  const trackLayer = L.layerGroup().addTo(map);
  const pointLayer = L.layerGroup().addTo(map);

  const rerender = (): void => {
    const showTracks = showTracksInput.checked;
    const mode = (pointModeInput.value as PointMode) ?? "sampled";
    renderTrackLayers(appStore.getState().tracks, map, trackLayer, pointLayer, showTracks, mode);
  };

  basemapSelect.addEventListener("change", () => {
    activeBase.removeFrom(map);
    activeBase = resolveBaseLayer(basemapSelect.value);
    activeBase.addTo(map);
  });
  showTracksInput.addEventListener("change", rerender);
  pointModeInput.addEventListener("change", rerender);
  window.addEventListener("gpxcompare:state-changed", rerender);
}
