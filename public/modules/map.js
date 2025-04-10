console.log("✅ map.js loaded");

let currentWorld = null;
let currentFileName = null;
let mapBlob = null;
let mapDriveId = null;

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

// 📍 Load existing map preview from saved mapMeta
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
  const pinLayer = document.getElementById("pin-layer");
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

// Right-click to place pin
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
window.addEventListener("DOMContentLoaded", loadMapImage);

// Toggle pins on/off with top button
document.getElementById("togglePinsBtn")?.addEventListener("click", () => {
  const layer = document.getElementById("pin-layer");
  if (!layer) return;
  const isVisible = layer.style.display !== "none";
  layer.style.display = isVisible ? "none" : "block";
});

// Toggle layer visibility (pins, roads, rivers, etc.)
document.querySelectorAll(".layer-toggle").forEach(checkbox => {
  checkbox.addEventListener("change", () => {
    const layerName = checkbox.dataset.layer;
    const layer = document.getElementById(`${layerName}-layer`);
    if (layer) {
      layer.style.display = checkbox.checked ? "block" : "none";
    }
    if (layerName === "pins") {
      renderMapPins();
    }
  });
});
