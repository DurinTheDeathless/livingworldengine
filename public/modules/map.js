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
function loadMapImage() {
  const preview = document.getElementById("map-preview");

  if (mapBlob) {
    preview.src = URL.createObjectURL(mapBlob);
    preview.style.display = "block";
    return;
  }

  preview.style.display = "none";
// Optionally: show "No preview available" if you want
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
    formData.append("map", mapBlob); // ✅ ONLY this line
  
    const response = await fetch("/drive/upload-image", {
      method: "POST",
      body: formData
    });
  
    try {
      const result = await response.json();
      if (result.success) {
        console.log("✅ Map uploaded to Drive.");
      } else {
        console.warn("⚠️ Map upload failed:", result.message || result);
      }
    } catch (err) {
      console.error("❌ Invalid response from map upload:", err);
    }
  }
}

document.getElementById("saveDriveBtn")?.addEventListener("click", triggerSaveToDrive);
document.getElementById("saveFileBtn")?.addEventListener("click", saveToFile);

// Run on page load
loadMapImage();
