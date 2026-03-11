import L from "leaflet";
import { appStore } from "../app/store";
import type { RiderTrack, RiderTrim } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

type PointMode = "none" | "all" | "sampled";
type BaseLayerKey = "road" | "topo" | "satellite" | "dark";
const DEFAULT_CENTER_94930: [number, number] = [37.9735, -122.561];
const DEFAULT_ZOOM_94930 = 14;

function buildBaseLayers(): Record<BaseLayerKey, L.TileLayer> {
  return {
    road: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxNativeZoom: 19,
      maxZoom: 24
    }),
    topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenTopoMap contributors",
      maxNativeZoom: 17,
      maxZoom: 24
    }),
    satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxNativeZoom: 19,
        maxZoom: 24
      }
    ),
    dark: L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        maxNativeZoom: 20,
        maxZoom: 24
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
  trims: Record<string, RiderTrim>,
  riderSettings: Record<string, { name: string; color: string }>,
  referenceRoute: ReferenceRoute | undefined,
  selectedPoint: { riderId: string; pointIndex: number } | undefined,
  map: L.Map,
  trackLayer: L.LayerGroup,
  pointLayer: L.LayerGroup,
  routeLayer: L.LayerGroup,
  showTracks: boolean,
  pointMode: PointMode
): void {
  trackLayer.clearLayers();
  pointLayer.clearLayers();
  routeLayer.clearLayers();

  const bounds = L.latLngBounds([]);
  if (referenceRoute && referenceRoute.coordinates.length >= 2) {
    const routeLatLngs = referenceRoute.coordinates.map(([lon, lat]) => L.latLng(lat, lon));
    L.polyline(routeLatLngs, { color: "#111827", weight: 4, opacity: 0.85, dashArray: "6,6" }).addTo(
      routeLayer
    );
    routeLatLngs.forEach((latLng) => bounds.extend(latLng));
  }

  tracks.forEach((track) => {
    const settings = riderSettings[track.riderId];
    const riderName = settings?.name ?? track.riderId;
    const color = settings?.color ?? "#3b82f6";
    const latLngs = track.points.map((p) => L.latLng(p.lat, p.lon));
    latLngs.forEach((latLng) => bounds.extend(latLng));

    if (showTracks && latLngs.length >= 2) {
      L.polyline(latLngs, { color, weight: 3, opacity: 0.9 }).addTo(trackLayer);
    }

    const trim = trims[track.riderId];
    if (trim) {
      const startPoint = track.points[trim.startPointIndex];
      const endPoint = track.points[trim.endPointIndex];
      if (startPoint) {
        L.circleMarker([startPoint.lat, startPoint.lon], {
          radius: 6,
          color,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1
        })
          .bindTooltip(`${riderName} trim start #${trim.startPointIndex}`)
          .addTo(trackLayer);
      }
      if (endPoint) {
        L.circleMarker([endPoint.lat, endPoint.lon], {
          radius: 6,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        })
          .bindTooltip(`${riderName} trim end #${trim.endPointIndex}`)
          .addTo(trackLayer);
      }
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
        radius:
          selectedPoint?.riderId === track.riderId && selectedPoint.pointIndex === point.pointIndex
            ? 5
            : 2.8,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight:
          selectedPoint?.riderId === track.riderId && selectedPoint.pointIndex === point.pointIndex
            ? 3
            : 1
      });
      marker.bindTooltip(
        `${riderName} #${point.pointIndex}<br/>${point.time ?? "no-time"}<br/>${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`
      );
      marker.on("click", () => {
        appStore.getState().setSelectedPoint({ riderId: track.riderId, pointIndex: point.pointIndex });
        appStore.getState().applyPointSelectionByPhase(track.riderId, point.pointIndex);
        window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
      });
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
          <option value="sampled">Sampled (every 20)</option>
          <option value="all" selected>All points</option>
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

  const map = L.map(canvas, { zoomControl: true, maxZoom: 24 }).setView(
    DEFAULT_CENTER_94930,
    DEFAULT_ZOOM_94930
  );
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
  const routeLayer = L.layerGroup().addTo(map);

  const rerender = (): void => {
    const { tracks, trims, riderSettings, referenceRoute, selectedPoint } = appStore.getState();
    const showTracks = showTracksInput.checked;
    const mode = (pointModeInput.value as PointMode) ?? "all";
    renderTrackLayers(
      tracks,
      trims,
      riderSettings,
      referenceRoute,
      selectedPoint,
      map,
      trackLayer,
      pointLayer,
      routeLayer,
      showTracks,
      mode
    );
  };

  basemapSelect.addEventListener("change", () => {
    activeBase.removeFrom(map);
    activeBase = resolveBaseLayer(basemapSelect.value);
    activeBase.addTo(map);
  });
  showTracksInput.addEventListener("change", rerender);
  pointModeInput.addEventListener("change", rerender);
  window.addEventListener("gpxcompare:state-changed", rerender);
  rerender();
}
