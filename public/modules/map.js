console.log("✅ map.js loaded");

let currentWorld = null;
let currentFileName = null;
let mapBlob = null;
let mapDriveId = null;
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };

try {
  const stored = sessionStorage.getItem("currentWorld");
  if (stored) {
    currentWorld = JSON.parse(stored);
    currentFileName = sessionStorage.getItem("worldFilename") || "world.json";
    ensureFileId(currentWorld);
    sessionStorage.setItem("currentWorld", JSON.stringify(currentWorld));
  }
} catch (e) {
  console.warn("Could not load world from sessionStorage", e);
}

async function loadMapImage() {
  const preview = document.getElementById("map-preview");
  preview.style.display = "none";

  if (mapBlob) {
    preview.src = URL.createObjectURL(mapBlob);
    preview.style.display = "block";
    return;
  }

  if (currentWorld?.mapMeta?.name) {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    const accessToken = user.accessToken;
    if (!accessToken) return console.warn("No access token, cannot fetch map.");

    try {
      const response = await fetch("/drive/fetch-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fileName: currentWorld.mapMeta.name,
        }),
      });

      if (!response.ok) throw new Error("Map not found in Drive.");
      const blob = await response.blob();

      preview.src = URL.createObjectURL(blob);
      preview.style.display = "block";
      console.log("✅ Map loaded from Drive.");
      renderMapPins();
    } catch (err) {
      console.warn("⚠️ Failed to load map from Drive:", err.message);
    }
  }
}

document.getElementById("uploadMapBtn")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const maxSize = 3 * 1024 * 1024;
  if (file.size > maxSize) {
    return alert("❌ Map file too large. Max size is 3MB.");
  }

  if (!confirm("⚠️ Replacing your map will delete all regions/pins associated with the old map.")) return;

  if (!currentWorld) return;
  mapBlob = file;
  currentWorld.mapMeta = {
    name: file.name || "",
    size: file.size || 0,
    type: file.type || "",
    uploaded: new Date().toISOString()
  };
  currentWorld.mapRegions = [];
  currentWorld.mapPins = [];
  markDirty();
  loadMapImage();
});

function saveToFile() {
  if (!currentWorld) return;
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function triggerSaveToDrive() {
  if (!currentWorld || !currentFileName) return;

  await window.saveToDrive(currentWorld, currentFileName);

  if (mapBlob && currentWorld.fileId) {
    console.log("📍 Uploading map to Drive...");
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    const accessToken = user.accessToken;
    if (!accessToken) return alert("❌ Not logged in.");

    const formData = new FormData();
    formData.append("map", mapBlob);
    formData.append("fileName", currentWorld.mapMeta?.name || "map.png");

    const response = await fetch("/drive/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });

    const result = await response.json();
    if (result.success) {
      console.log("✅ Map uploaded to Drive.");
    } else {
      console.warn("⚠️ Map upload failed:", result.message || result);
    }
  }
}

function renderMapPins() {
  const pinLayer = document.getElementById("pins-layer");
  if (!pinLayer || !Array.isArray(currentWorld?.mapPins)) return;

  pinLayer.innerHTML = "";

  const enabledLayers = Array.from(document.querySelectorAll(".layer-toggle:checked")).map(cb => cb.dataset.layer);
  if (!enabledLayers.includes("pins")) return;

  currentWorld.mapPins.forEach((pin, index) => {
    const el = document.createElement("div");
    el.className = "map-pin";
    el.style.left = `${pin.x}%`;
    el.style.top = `${pin.y}%`;
    el.title = pin.name || `Pin ${index + 1}`;
    el.innerHTML = getPinSymbol(pin.type);
    pinLayer.appendChild(el);
  });
}

let activePinType = null;

function enablePinPlacement(type) {
  activePinType = type;
  document.body.style.cursor = "crosshair";
}

function disablePinPlacement() {
  activePinType = null;
  document.body.style.cursor = "default";
}

function getPinSymbol(type) {
  const symbols = {
    City: "🏙️",
    Town: "🏘️",
    Capital: "👑",
    Harbor: "⚓",
    Landmark: "📌",
    Military: "🛡️",
    Cave: "🕳️",
    Ruin: "🏚️",
    Temple: "⛩️",
    Lair: "🐉",
    Wonder: "🌟",
    Custom: "❓"
  };
  return symbols[type] || "📍";
}

document.getElementById("map-preview")?.addEventListener("click", (e) => {
  if (!activePinType || !currentWorld) return;

  const preview = e.target;
  const rect = preview.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;

  const name = prompt(`Enter name for this ${activePinType}:`, "");
  if (!name) return;

  const newPin = {
    name,
    type: activePinType,
    x,
    y,
    id: Date.now(),
  };

  currentWorld.mapPins.push(newPin);
  markDirty();
  renderMapPins();
});

document.querySelectorAll(".layer-toggle").forEach(label => {
  label.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const layer = label.dataset.layer;
    if (layer === "pins") {
      const type = prompt("Enter pin type (e.g., City, Cave, etc.):", "City");
      if (type) {
        enablePinPlacement(type);
        alert(`Click the map to place a "${type}" pin.`);
      }
    }
  });
});

document.getElementById("saveDriveBtn")?.addEventListener("click", triggerSaveToDrive);
document.getElementById("saveFileBtn")?.addEventListener("click", saveToFile);
window.addEventListener("DOMContentLoaded", () => {
  loadMapImage();

  document.getElementById("zoomInBtn")?.addEventListener("click", () => {
    currentZoom = Math.min(8, currentZoom + 0.25);
    applyZoomPan();
  });

  document.getElementById("zoomOutBtn")?.addEventListener("click", () => {
    currentZoom = Math.max(1, currentZoom - 0.25);
    applyZoomPan();
  });

  document.getElementById("zoomResetBtn")?.addEventListener("click", () => {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyZoomPan();
  });

  const zoomWrapper = document.getElementById("zoom-wrapper");

  zoomWrapper.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStart.x = e.clientX - panX;
    dragStart.y = e.clientY - panY;
    zoomWrapper.style.cursor = "grabbing";
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    zoomWrapper.style.cursor = "grab";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panX = e.clientX - dragStart.x;
    panY = e.clientY - dragStart.y;
    applyZoomPan();
  });
});

function applyZoomPan() {
  const map = document.getElementById("map-viewport");
  map.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  map.style.transformOrigin = "top left";
}

document.getElementById("togglePinsBtn")?.addEventListener("click", () => {
  const layer = document.getElementById("pins-layer");
  if (!layer) return;
  const isVisible = layer.style.display !== "none";
  layer.style.display = isVisible ? "none" : "block";
});

document.querySelectorAll(".layer-toggle").forEach(checkbox => {
  checkbox.addEventListener("change", () => {
    const layerName = checkbox.dataset.layer;
    const layer = document.getElementById(`${layerName}-layer`);
    if (layer) {
      layer.style.display = checkbox.checked ? "block" : "none";
    }
    if (layerName === "pins") renderMapPins();
    if (layerName === "roads") renderRoadsLayer();
    if (layerName === "rivers") renderRiversLayer();
    if (layerName === "borders") renderBordersLayer();
    if (layerName === "mountains") renderMountainsLayer();
    if (layerName === "geography") renderGeographyLayer();
    if (layerName === "elevation") renderElevationLayer();
    if (layerName === "corruption") renderCorruptionLayer();
    if (layerName === "factions") renderFactionsLayer();
  });
});

function renderRoadsLayer() {
  const layer = document.getElementById("roads-layer");
  if (!layer || !Array.isArray(currentWorld?.mapRoads)) return;
  layer.innerHTML = "";
}
function renderRiversLayer() {
  const layer = document.getElementById("rivers-layer");
  if (!layer || !Array.isArray(currentWorld?.mapRivers)) return;
  layer.innerHTML = "";
}
function renderBordersLayer() {
  const layer = document.getElementById("borders-layer");
  if (!layer || !Array.isArray(currentWorld?.mapBorders)) return;
  layer.innerHTML = "";
}
function renderMountainsLayer() {
  const layer = document.getElementById("mountains-layer");
  if (!layer || !Array.isArray(currentWorld?.mapMountains)) return;
  layer.innerHTML = "";
}
function renderGeographyLayer() {
  const layer = document.getElementById("geography-layer");
  if (!layer || !Array.isArray(currentWorld?.mapGeography)) return;
  layer.innerHTML = "";
}
function renderElevationLayer() {
  const layer = document.getElementById("elevation-layer");
  if (!layer || !Array.isArray(currentWorld?.mapElevation)) return;
  layer.innerHTML = "";
}
function renderCorruptionLayer() {
  const layer = document.getElementById("corruption-layer");
  if (!layer || !Array.isArray(currentWorld?.mapCorruption)) return;
  layer.innerHTML = "";
}
function renderFactionsLayer() {
  const layer = document.getElementById("factions-layer");
  if (!layer || !Array.isArray(currentWorld?.mapFactions)) return;
  layer.innerHTML = "";
}
