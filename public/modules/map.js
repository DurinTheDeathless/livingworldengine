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

let pinInteractionMode = null; // 'add', 'edit', 'remove'
let temporaryPinEl = null; // for drag-following pin
let tempPinCoords = null;  // pin position during hover

let pinMode = null;         // deprecated duplicate (can be removed if unused)
let hoverPin = null;        // for highlighting if needed

let tempPin = null;         // the draggable visual pin before placing
let pinPopup = null;        // the currently open popup (for closing)
let selectedPinId = null;   // for edit/delete tracking

let popupOffsetX = 0;       // optional: fine-tuning popup placement
let popupOffsetY = 0;


// 🧠 Try to load the saved world from sessionStorage
try {
  const stored = sessionStorage.getItem("currentWorld");
  if (stored) {
    currentWorld = JSON.parse(stored);
    currentFileName = sessionStorage.getItem("worldFilename") || "world.json";

    ensureFileId(currentWorld); // Ensures every world has a fileId
    sessionStorage.setItem("currentWorld", JSON.stringify(currentWorld)); // Resave for good measure
  }
} catch (e) {
  console.warn("⚠️ Could not load world from sessionStorage", e);
}

// 🌍 Load and display the map image (either from memory or from Drive)
async function loadMapImage() {
  const preview = document.getElementById("map-preview");
  if (!preview) return console.warn("❌ Map preview element not found.");
  preview.style.display = "none";

  if (mapBlob) {
    preview.src = URL.createObjectURL(mapBlob);
    preview.style.display = "block";
    return;
  }

  if (currentWorld?.mapMeta?.name) {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    const accessToken = user.accessToken;
    if (!accessToken) {
      console.warn("❌ No access token, cannot fetch map from Drive.");
      return;
    }

    try {
      const response = await fetch("/drive/fetch-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fileName: currentWorld.mapMeta.name }),
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

// 📤 Upload a new map and reset pins/regions
document.getElementById("uploadMapBtn")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const maxSize = 3 * 1024 * 1024; // 3MB max
  if (file.size > maxSize) {
    alert("❌ Map file too large. Max size is 3MB.");
    return;
  }

  if (!confirm("⚠️ Replacing your map will delete all regions/pins associated with the old map.")) return;

  if (!currentWorld) {
    alert("❌ No world loaded.");
    return;
  }

  mapBlob = file;
  currentWorld.mapMeta = {
    name: file.name || "map.png",
    size: file.size || 0,
    type: file.type || "image/png",
    uploaded: new Date().toISOString(),
  };

  // Reset map content
  currentWorld.mapRegions = [];
  currentWorld.mapPins = [];

  markDirty();
  loadMapImage();
});


// 💾 Save current world to local file
function saveToFile() {
  if (!currentWorld) return;

  const fileName = currentFileName || "world.json";
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(a.href);
  console.log(`✅ World saved locally as ${fileName}`);
}

// ☁️ Save current world and map to Google Drive
async function triggerSaveToDrive() {
  if (!currentWorld || !currentFileName) {
    console.warn("⚠️ No world or filename found, skipping save to Drive.");
    return;
  }

  console.log("💾 Saving world JSON to Drive...");
  await window.saveToDrive(currentWorld, currentFileName);

  // Upload map image if it exists
  if (mapBlob && currentWorld.fileId) {
    console.log("📍 Uploading map to Drive...");

    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    const accessToken = user.accessToken;

    if (!accessToken) {
      alert("❌ Not logged in. Cannot upload map.");
      return;
    }

    const formData = new FormData();
    formData.append("map", mapBlob);
    formData.append("fileName", currentWorld.mapMeta?.name || "map.png");

    try {
      const response = await fetch("/drive/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const result = await response.json().catch(() => ({ success: false, message: "Invalid JSON response" }));

      if (result.success) {
        console.log("✅ Map uploaded to Drive.");
      } else {
        console.warn("⚠️ Map upload failed:", result.message || result);
      }
    } catch (err) {
      console.error("❌ Map upload error:", err);
    }
  }
}

function renderMapPins() {
  const pinLayer = document.getElementById("pins-layer");
  if (!pinLayer || !Array.isArray(currentWorld?.mapPins)) return;

  // Clear old pins
  pinLayer.innerHTML = "";

  // Check if pin layer is enabled
  const enabledLayers = Array.from(document.querySelectorAll(".layer-toggle:checked"))
    .map(cb => cb.dataset.layer);
  if (!enabledLayers.includes("pins")) return;

  // Draw each pin
  currentWorld.mapPins.forEach((pin, index) => {
    const el = document.createElement("div");
    el.className = "map-pin";
    el.dataset.id = pin.id;

    // Position on map
    el.style.left = `${pin.x}%`;
    el.style.top = `${pin.y}%`;

    // Visual & metadata
    el.title = pin.name || `Pin ${index + 1}`;
    el.innerHTML = getPinSymbol(pin.type);
    el.style.fontSize = "0.65rem"; // 💡 Keeps pin size smaller on a large-scale world map
    el.style.lineHeight = "1";
    el.style.position = "absolute";

    // Interaction
    el.addEventListener("click", (e) => handlePinClick(e, pin));

    // Add to map
    pinLayer.appendChild(el);
  });
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

  return symbols[type] || "📍"; // Fallback icon
}


function handlePinClick(e, pin) {
  if (!pin || !currentWorld?.mapPins) return;

  if (pinInteractionMode === "remove") {
    const confirmDelete = confirm(`Are you sure you want to delete pin "${pin.name}"?`);
    if (confirmDelete) {
      const updatedPins = currentWorld.mapPins.filter(p => p.id !== pin.id);
      currentWorld.mapPins = updatedPins;
      markDirty();
      renderMapPins();
    }
  } else {
    // If in 'edit' mode, pass editable = true
    const editable = pinInteractionMode === "edit";
    showPinPopup(pin, editable);
  }
}

function showPinPopup(pin, editable) {
  // ⚠️ TEMPORARY ALERT — Replace with custom floating popup later
  alert(`${editable ? "Edit" : "View"}: ${pin.name}\nType: ${pin.type}`);

  // Future: call renderPinPopup(pin, editable) with your custom UI builder here
}

function applyZoomPan() {
  const map = document.getElementById("map-viewport");
  if (!map) return;
  map.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  map.style.transformOrigin = "center center";
}

window.addEventListener("DOMContentLoaded", () => {
  loadMapImage();

  // Zoom Controls
  document.getElementById("zoomInBtn")?.addEventListener("click", () => {
    currentZoom = Math.min(8, currentZoom + 0.25); // Max zoom
    applyZoomPan();
  });

  document.getElementById("zoomOutBtn")?.addEventListener("click", () => {
    currentZoom = Math.max(1, currentZoom - 0.25); // Min zoom
    applyZoomPan();
  });

  document.getElementById("zoomResetBtn")?.addEventListener("click", () => {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    applyZoomPan();
  });

  // Drag to Pan
  const zoomWrapper = document.getElementById("zoom-wrapper");

  zoomWrapper?.addEventListener("mousedown", (e) => {
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

  // Pin Tool Buttons (Add / Edit / Remove)
  document.querySelectorAll(".layer-controls button").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const layer = button.dataset.layer;
  
      if (layer === "pins") {
        const isSameMode = pinInteractionMode === action;
  
        // Reset everything if toggling off
        if (isSameMode) {
          pinInteractionMode = null;
          button.style.backgroundColor = "";
          if (tempPin) {
            tempPin.remove();
            tempPin = null;
          }
          return;
        }
  
        // Clear other highlights
        document.querySelectorAll(".layer-controls button").forEach(btn => {
          btn.style.backgroundColor = "";
        });
  
        // Activate selected mode
        pinInteractionMode = action;
        button.style.backgroundColor = "#8a5f2e";
  
        if (action !== "add" && tempPin) {
          tempPin.remove();
          tempPin = null;
        }
      }
    });
  });  
});

  
const mapPreview = document.getElementById("map-preview");
const pinsLayer = document.getElementById("pins-layer");

if (mapPreview && pinsLayer) {
  // 🎯 Live position tracking for the temporary pin icon
  mapPreview.addEventListener("mousemove", (e) => {
    if (pinInteractionMode !== "add") return;

    const rect = mapPreview.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    tempPinCoords = { x, y };

    if (!tempPin) {
      tempPin = document.createElement("div");
      tempPin.className = "map-pin";
      tempPin.style.pointerEvents = "none";
      tempPin.style.fontSize = "0.7rem"; // Shrink for world-scale view
      tempPin.innerHTML = "📍";
      pinsLayer.appendChild(tempPin);
    }

    tempPin.style.left = `${x}%`;
    tempPin.style.top = `${y}%`;
  });

  // 📌 Add pin and open a map UI pop-up at click location
  mapPreview.addEventListener("click", (e) => {
    if (pinInteractionMode !== "add" || !tempPinCoords || !currentWorld) return;
      // Prevent creating a new pin if clicking inside a popup
      if (e.target.closest(".pin-popup")) return;
      
    const id = `pin-${Date.now()}`;

    const popup = document.createElement("div");
    popup.className = "pin-popup";
    popup.dataset.id = id;
    popup.style.position = "absolute";
    popup.style.left = `${tempPinCoords.x}%`;
    popup.style.top = `${tempPinCoords.y}%`;
    popup.style.transform = "translate(-50%, -100%)";
    popup.style.background = "#3a2d1e";
    popup.style.border = "1px solid #ffd700";
    popup.style.padding = "8px";
    popup.style.color = "#f4e3c1";
    popup.style.borderRadius = "6px";
    popup.style.zIndex = "999";
    popup.style.transform += ` scale(${1 / currentZoom})`;
    popup.style.transformOrigin = "top left";


    popup.innerHTML = `
      <label style="display:block;margin-bottom:4px;">
        Name: <input type="text" id="name-${id}" style="width: 120px;" />
      </label>
      <label style="display:block;margin-bottom:4px;">
        Type:
        <select id="type-${id}">
          <option>City</option>
          <option>Town</option>
          <option>Capital</option>
          <option>Harbor</option>
          <option>Landmark</option>
          <option>Military</option>
          <option>Cave</option>
          <option>Ruin</option>
          <option>Temple</option>
          <option>Lair</option>
          <option>Wonder</option>
          <option>Custom</option>
        </select>
      </label>
      <div style="font-size: 0.8rem; margin-bottom: 4px;">ID: ${id}</div>
      <button id="confirm-${id}" style="margin-top: 4px;">Add Pin</button>
    `;

    pinsLayer.appendChild(popup);

    document.getElementById(`confirm-${id}`)?.addEventListener("click", () => {
      const name = document.getElementById(`name-${id}`)?.value || "Unnamed";
      const type = document.getElementById(`type-${id}`)?.value;

      const newPin = {
        name,
        type,
        id,
        x: tempPinCoords.x,
        y: tempPinCoords.y,
      };

      currentWorld.mapPins.push(newPin);
      markDirty();
      renderMapPins();

      // Cleanup UI
      popup.remove();
      if (tempPin) tempPin.remove();
      tempPin = null;
      pinInteractionMode = null;
    });
  });
}


// 🔁 Toggle visibility of pins with top-right button
document.getElementById("togglePinsBtn")?.addEventListener("click", () => {
  const layer = document.getElementById("pins-layer");
  if (!layer) return;
  const isVisible = layer.style.display !== "none";
  layer.style.display = isVisible ? "none" : "block";
});

// ✅ Handle layer visibility toggles and re-render specific content
document.querySelectorAll(".layer-toggle").forEach(checkbox => {
  checkbox.addEventListener("change", () => {
    const layerName = checkbox.dataset.layer;
    const layer = document.getElementById(`${layerName}-layer`);
    if (layer) {
      layer.style.display = checkbox.checked ? "block" : "none";
    }

    // 🔁 Call the right render function based on layer name
    switch (layerName) {
      case "pins": renderMapPins(); break;
      case "roads": renderRoadsLayer(); break;
      case "rivers": renderRiversLayer(); break;
      case "borders": renderBordersLayer(); break;
      case "mountains": renderMountainsLayer(); break;
      case "geography": renderGeographyLayer(); break;
      case "elevation": renderElevationLayer(); break;
      case "corruption": renderCorruptionLayer(); break;
      case "factions": renderFactionsLayer(); break;
      // Add new layers here as needed
    }
  });
});

// 📌 Layer rendering functions — stubbed with clearing logic (will be expanded)
function renderRoadsLayer() {
  const layer = document.getElementById("roads-layer");
  if (!layer || !Array.isArray(currentWorld?.mapRoads)) return;
  layer.innerHTML = ""; // Placeholder — draw roads here later
}

function renderRiversLayer() {
  const layer = document.getElementById("rivers-layer");
  if (!layer || !Array.isArray(currentWorld?.mapRivers)) return;
  layer.innerHTML = ""; // Placeholder — draw rivers here later
}

function renderBordersLayer() {
  const layer = document.getElementById("borders-layer");
  if (!layer || !Array.isArray(currentWorld?.mapBorders)) return;
  layer.innerHTML = ""; // Placeholder — draw borders here later
}

function renderMountainsLayer() {
  const layer = document.getElementById("mountains-layer");
  if (!layer || !Array.isArray(currentWorld?.mapMountains)) return;
  layer.innerHTML = ""; // Placeholder — draw mountains here later
}

function renderGeographyLayer() {
  const layer = document.getElementById("geography-layer");
  if (!layer || !Array.isArray(currentWorld?.mapGeography)) return;
  layer.innerHTML = ""; // Placeholder — draw biomes here later
}

function renderElevationLayer() {
  const layer = document.getElementById("elevation-layer");
  if (!layer || !Array.isArray(currentWorld?.mapElevation)) return;
  layer.innerHTML = ""; // Placeholder — draw elevation here later
}

function renderCorruptionLayer() {
  const layer = document.getElementById("corruption-layer");
  if (!layer || !Array.isArray(currentWorld?.mapCorruption)) return;
  layer.innerHTML = ""; // Placeholder — draw corrupted regions here later
}

function renderFactionsLayer() {
  const layer = document.getElementById("factions-layer");
  if (!layer || !Array.isArray(currentWorld?.mapFactions)) return;
  layer.innerHTML = ""; // Placeholder — draw faction areas here later
}
