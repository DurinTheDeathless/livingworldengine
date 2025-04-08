console.log("✅ map.js loaded");

let currentWorld = null;
let currentFileName = null;
let mapBlob = null; // holds map file blob (not base64)
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

  // Show local mapBlob if exists
  if (mapBlob) {
    preview.src = URL.createObjectURL(mapBlob);
    preview.style.display = "block";
    return;
  }

  // Load from Drive using stored mapMeta
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
    } catch (err) {
      console.warn("⚠️ Failed to load map from Drive:", err.message);
    }
  }
}

// 📤 Upload new map file and reset map data
document.getElementById("uploadMapBtn")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const maxSize = 3 * 1024 * 1024; // 3MB
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

// 💾 Save world.json locally
function saveToFile() {
  if (!currentWorld) return;
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ☁️ Save to Drive (world + map if available)
async function triggerSaveToDrive() {
  if (!currentWorld || !currentFileName) return;

  // First save world.json
  await window.saveToDrive(currentWorld, currentFileName);

  // Then upload map separately if it exists
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
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
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

document.getElementById("saveDriveBtn")?.addEventListener("click", triggerSaveToDrive);
document.getElementById("saveFileBtn")?.addEventListener("click", saveToFile);

// Load image on page load
window.addEventListener("DOMContentLoaded", loadMapImage);
