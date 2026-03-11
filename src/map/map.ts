import L from "leaflet";
import { appStore } from "../app/store";
import type { RiderTrack, RiderTrim } from "../types/gpx";
import type { ReferenceRoute } from "../types/route";

type PointMode = "none" | "all" | "sampled";
type BaseLayerKey = "road" | "topo" | "satellite" | "dark";
type InteractionMode = "navigate" | "draw_start" | "draw_end";

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
    dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxNativeZoom: 20,
      maxZoom: 24
    })
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

function pinIcon(label: "S" | "E", color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:white;border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:0 0 0 2px ${color};">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function renderTrackLayers(
  tracks: RiderTrack[],
  trims: Record<string, RiderTrim>,
  riderSettings: Record<string, { name: string; color: string }>,
  referenceRoute: ReferenceRoute | undefined,
  selectedPoint: { riderId: string; pointIndex: number } | undefined,
  trackLayer: L.LayerGroup,
  pointLayer: L.LayerGroup,
  routeLayer: L.LayerGroup,
  boxLayer: L.LayerGroup,
  pinLayer: L.LayerGroup,
  showTracks: boolean,
  pointMode: PointMode,
  startBoxBounds?: L.LatLngBounds,
  endBoxBounds?: L.LatLngBounds,
  onPointClick?: (riderId: string, pointIndex: number) => void,
  onStartPinDrag?: (lat: number, lon: number) => void,
  onEndPinDrag?: (lat: number, lon: number) => void
): void {
  trackLayer.clearLayers();
  pointLayer.clearLayers();
  routeLayer.clearLayers();
  boxLayer.clearLayers();
  pinLayer.clearLayers();

  if (referenceRoute && referenceRoute.coordinates.length >= 2) {
    const routeLatLngs = referenceRoute.coordinates.map(([lon, lat]) => L.latLng(lat, lon));
    L.polyline(routeLatLngs, { color: "#111827", weight: 4, opacity: 0.9, dashArray: "6,6" }).addTo(
      routeLayer
    );
  }

  if (startBoxBounds) {
    L.rectangle(startBoxBounds, { color: "#dc2626", weight: 2, fillOpacity: 0.08 }).addTo(boxLayer);
  }
  if (endBoxBounds) {
    L.rectangle(endBoxBounds, { color: "#111827", weight: 2, fillOpacity: 0.06 }).addTo(boxLayer);
  }

  tracks.forEach((track) => {
    const settings = riderSettings[track.riderId];
    const riderName = settings?.name ?? track.riderId;
    const color = settings?.color ?? "#3b82f6";
    const latLngs = track.points.map((p) => L.latLng(p.lat, p.lon));

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
        const { endPin } = appStore.getState();
        if (endPin) {
          L.polyline(
            [
              [endPin.lat, endPin.lon],
              [endPoint.lat, endPoint.lon]
            ],
            {
              color,
              weight: 2,
              dashArray: "4,4",
              opacity: 0.9
            }
          ).addTo(trackLayer);
        }
        L.circleMarker([endPoint.lat, endPoint.lon], {
          radius: 10,
          color,
          weight: 3,
          fillColor: color,
          fillOpacity: 1
        })
          .bindTooltip(`${riderName} END #${trim.endPointIndex}`, {
            permanent: true,
            direction: "right",
            className: "end-point-label"
          })
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
      const active =
        selectedPoint?.riderId === track.riderId && selectedPoint.pointIndex === point.pointIndex;
      const startTime = trim ? track.points[trim.startPointIndex]?.timeMs : undefined;
      const elapsedFromStartMs =
        startTime !== undefined && point.timeMs !== undefined ? point.timeMs - startTime : undefined;
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: active ? 5 : 2.8,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: active ? 3 : 1
      });
      marker.bindTooltip(
        `${riderName} #${point.pointIndex}<br/>${point.time ?? "no-time"}<br/>elapsed from start: ${
          elapsedFromStartMs !== undefined
            ? `${Math.round(elapsedFromStartMs)} ms (${(elapsedFromStartMs / 1000).toFixed(3)}s)`
            : "--"
        }<br/>${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`
      );
      marker.on("click", () => {
        onPointClick?.(track.riderId, point.pointIndex);
      });
      marker.addTo(pointLayer);
    });
  });

  const { startPin, endPin } = appStore.getState();
  if (startPin) {
    const marker = L.marker([startPin.lat, startPin.lon], {
      icon: pinIcon("S", "#dc2626"),
      draggable: true
    });
    marker.on("dragend", () => {
      const next = marker.getLatLng();
      onStartPinDrag?.(next.lat, next.lng);
    });
    marker.addTo(pinLayer);
  }
  if (endPin) {
    const marker = L.marker([endPin.lat, endPin.lon], {
      icon: pinIcon("E", "#111827"),
      draggable: true
    });
    marker.on("dragend", () => {
      const next = marker.getLatLng();
      onEndPinDrag?.(next.lat, next.lng);
    });
    marker.addTo(pinLayer);
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
    <div class="map-controls">
      <button id="mode-nav" type="button">Navigate</button>
      <button id="mode-start" type="button">Set start box</button>
      <button id="mode-end" type="button">Set end box</button>
      <span id="mode-label"></span>
    </div>
  `;
  container.append(mapBox);

  const canvas = mapBox.querySelector<HTMLDivElement>("#map-canvas");
  const basemapSelect = mapBox.querySelector<HTMLSelectElement>("#basemap-select");
  const showTracksInput = mapBox.querySelector<HTMLInputElement>("#show-tracks");
  const pointModeInput = mapBox.querySelector<HTMLSelectElement>("#point-mode");
  const modeNavBtn = mapBox.querySelector<HTMLButtonElement>("#mode-nav");
  const modeStartBtn = mapBox.querySelector<HTMLButtonElement>("#mode-start");
  const modeEndBtn = mapBox.querySelector<HTMLButtonElement>("#mode-end");
  const modeLabel = mapBox.querySelector<HTMLSpanElement>("#mode-label");
  if (
    !canvas ||
    !basemapSelect ||
    !showTracksInput ||
    !pointModeInput ||
    !modeNavBtn ||
    !modeStartBtn ||
    !modeEndBtn ||
    !modeLabel
  ) {
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
  const boxLayer = L.layerGroup().addTo(map);
  const pinLayer = L.layerGroup().addTo(map);

  let startBoxBounds: L.LatLngBounds | undefined;
  let endBoxBounds: L.LatLngBounds | undefined;
  let drawStart: L.LatLng | undefined;
  let drawRect: L.Rectangle | undefined;
  let isDrawing = false;
  let lastZoomRequestId = -1;
  let lastFocusRequestId = -1;
  let lastLockZoom = false;
  let interactionMode: InteractionMode = "navigate";

  const updateModeUI = (): void => {
    modeNavBtn.disabled = interactionMode === "navigate";
    modeStartBtn.disabled = interactionMode === "draw_start";
    modeEndBtn.disabled = interactionMode === "draw_end";
    modeLabel.textContent =
      interactionMode === "navigate"
        ? "Mode: navigate"
        : interactionMode === "draw_start"
          ? "Mode: draw start box"
          : "Mode: draw end box";
  };

  const applyZoomLock = (lock: boolean): void => {
    if (lock === lastLockZoom) {
      return;
    }
    lastLockZoom = lock;
    if (lock) {
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
    } else {
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    }
  };

  const processSelectionBox = (bounds: L.LatLngBounds, phase: "start" | "end"): void => {
    const { tracks, includeInComparison } = appStore.getState();
    const points = tracks
      .filter((track) => includeInComparison[track.riderId])
      .flatMap((track) => track.points.filter((point) => bounds.contains([point.lat, point.lon])));
    if (points.length === 0) {
      return;
    }
    const avgLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const avgLon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
    if (phase === "start") {
      startBoxBounds = bounds;
      appStore.getState().setStartPin({ lat: avgLat, lon: avgLon });
      appStore.getState().applyPinToIncludedRiders("start");
    } else {
      endBoxBounds = bounds;
      appStore.getState().setEndPin({ lat: avgLat, lon: avgLon });
      appStore.getState().applyPinToIncludedRiders("end");
    }
  };

  const rerender = (): void => {
    const {
      tracks,
      trims,
      riderSettings,
      referenceRoute,
      selectedPoint,
      lockZoom,
      zoomToRouteRequestId,
      focusRequestId,
      focusRiderId,
      focusTarget
    } = appStore.getState();
    const showTracks = showTracksInput.checked;
    const mode = (pointModeInput.value as PointMode) ?? "all";

    renderTrackLayers(
      tracks,
      trims,
      riderSettings,
      referenceRoute,
      selectedPoint,
      trackLayer,
      pointLayer,
      routeLayer,
      boxLayer,
      pinLayer,
      showTracks,
      mode,
      startBoxBounds,
      endBoxBounds,
      (riderId, pointIndex) => {
        appStore.getState().setSelectedPoint({ riderId, pointIndex });
        window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
      },
      (lat, lon) => {
        appStore.getState().setStartPin({ lat, lon });
        appStore.getState().applyPinToIncludedRiders("start");
        window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
      },
      (lat, lon) => {
        appStore.getState().setEndPin({ lat, lon });
        appStore.getState().applyPinToIncludedRiders("end");
        window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
      }
    );

    applyZoomLock(lockZoom);

    if (zoomToRouteRequestId !== lastZoomRequestId && referenceRoute && referenceRoute.coordinates.length > 1) {
      lastZoomRequestId = zoomToRouteRequestId;
      const routeBounds = L.latLngBounds(referenceRoute.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]));
      if (routeBounds.isValid()) {
        map.fitBounds(routeBounds.pad(0.15));
      }
    }

    if (focusRequestId !== lastFocusRequestId && focusRiderId && focusTarget) {
      lastFocusRequestId = focusRequestId;
      const track = tracks.find((item) => item.riderId === focusRiderId);
      const trim = track ? trims[focusRiderId] : undefined;
      const pointIdx = focusTarget === "start" ? trim?.startPointIndex : trim?.endPointIndex;
      const point = pointIdx !== undefined && track ? track.points[pointIdx] : undefined;
      if (point) {
        map.setView([point.lat, point.lon], 22, { animate: true });
      }
    }
  };

  map.on("mousedown", (event) => {
    if (interactionMode === "navigate") {
      return;
    }
    isDrawing = true;
    drawStart = event.latlng;
    map.dragging.disable();
    if (drawRect) {
      drawRect.remove();
    }
    drawRect = L.rectangle(L.latLngBounds(drawStart, drawStart), {
      color: interactionMode === "draw_start" ? "#dc2626" : "#111827",
      weight: 2,
      fillOpacity: 0.08
    }).addTo(boxLayer);
  });

  map.on("mousemove", (event) => {
    if (!isDrawing || !drawStart || !drawRect) {
      return;
    }
    drawRect.setBounds(L.latLngBounds(drawStart, event.latlng));
  });

  map.on("mouseup", (event) => {
    if (!isDrawing || !drawStart) {
      return;
    }
    isDrawing = false;
    map.dragging.enable();
    const phase = interactionMode === "draw_start" ? "select_start" : "select_end";
    const bounds = L.latLngBounds(drawStart, event.latlng);
    if (phase === "select_start") {
      processSelectionBox(bounds, "start");
    } else if (phase === "select_end") {
      processSelectionBox(bounds, "end");
    }
    interactionMode = "navigate";
    updateModeUI();
    window.dispatchEvent(new CustomEvent("gpxcompare:state-changed"));
  });

  basemapSelect.addEventListener("change", () => {
    activeBase.removeFrom(map);
    activeBase = resolveBaseLayer(basemapSelect.value);
    activeBase.addTo(map);
  });
  showTracksInput.addEventListener("change", rerender);
  pointModeInput.addEventListener("change", rerender);
  modeNavBtn.addEventListener("click", () => {
    interactionMode = "navigate";
    updateModeUI();
  });
  modeStartBtn.addEventListener("click", () => {
    interactionMode = "draw_start";
    appStore.getState().setSelectionPhase("select_start");
    updateModeUI();
  });
  modeEndBtn.addEventListener("click", () => {
    interactionMode = "draw_end";
    appStore.getState().setSelectionPhase("select_end");
    updateModeUI();
  });
  window.addEventListener("gpxcompare:state-changed", rerender);
  updateModeUI();
  rerender();
}
