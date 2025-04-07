console.log("✅ map.js loaded");

let currentWorld = null;
let currentFileName = null;
let mapBlob = null; // separate map blob for saving
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

// 📍 Load existing map preview
function loadMapImage() {
  const preview = document.getElementById("map-preview");

  // Prefer local blob if available
  if (mapBlob) {
    preview.src = URL.createObjectURL(mapBlob);
    preview.style.display = "block";
    return;
  }

  // Load from drive or fallback
  if (currentWorld?.mapMeta?.name && currentWorld.mapMeta.localDataURL) {
    preview.src = currentWorld.mapMeta.localDataURL;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
}

// 📤 Upload new map
document.getElementById("uploadMapBtn")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const maxSize = 3 * 1024 * 1024; // 3MB
  if (file.size > maxSize) {
    return alert("❌ Map file too large. Max size is 3MB.");
  }

  if (!confirm("⚠️ Replacing your map will delete all regions/pins associated with the old map.")) return;

  const reader = new FileReader();
  reader.onload = () => {
    if (!currentWorld) return;
    mapBlob = file;
    currentWorld.mapMeta = {
      name: file.name,
      size: file.size,
      type: file.type,
      uploaded: new Date().toISOString(),
      localDataURL: reader.result
    };
    currentWorld.mapRegions = [];
    currentWorld.mapPins = [];
    markDirty();
    loadMapImage();
  };
  reader.readAsDataURL(file);
});

// 💾 Save world.json to file
function saveToFile() {
  if (!currentWorld) return;
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ☁️ Save to Drive (world.json + optional map)
async function triggerSaveToDrive() {
  if (!currentWorld || !currentFileName) return;

  // Save world.json first
  await window.saveToDrive(currentWorld, currentFileName);

  // If map file exists, save separately
  if (mapBlob && currentWorld.fileId) {
    console.log("📍 Uploading map to Drive...");
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    const accessToken = user.accessToken;
    if (!accessToken) return alert("❌ Not logged in.");

    const formData = new FormData();
    formData.append("file", mapBlob);
    formData.append("worldFileId", currentWorld.fileId); // associate

    const res = await fetch("/drive/upload-map", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData
    });

    const result = await res.json();
    if (result.success) {
      console.log("✅ Map uploaded to Drive.");
    } else {
      console.warn("⚠️ Map upload failed.");
    }
  }
}

document.getElementById("saveDriveBtn")?.addEventListener("click", triggerSaveToDrive);
document.getElementById("saveFileBtn")?.addEventListener("click", saveToFile);

// Initialize
loadMapImage();
