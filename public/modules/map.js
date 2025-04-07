let currentWorld = null;
let currentFileName = null;

try {
  const stored = sessionStorage.getItem("currentWorld");
  if (stored) {
    currentWorld = JSON.parse(stored);
    currentFileName = sessionStorage.getItem("worldFilename") || "world.json";
  }
} catch (e) {
  console.warn("Could not load world from sessionStorage", e);
}

// 📍 Populate existing map if it exists
function loadMapImage() {
  const preview = document.getElementById("map-preview");
  if (currentWorld?.mapImage) {
    preview.src = currentWorld.mapImage;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
}

// 📍 Upload new map
document.getElementById("uploadMapBtn")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    if (!currentWorld) return;
    // ⚠️ Reset regions/pins if replacing
    currentWorld.mapImage = reader.result;
    currentWorld.mapRegions = [];
    currentWorld.mapPins = [];
    alert("Map image uploaded successfully.");
    loadMapImage();
  };
  reader.readAsDataURL(file);
});

// 📥 Save to file
function saveToFile() {
  if (!currentWorld) return;
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ☁️ Save to Google Drive
function saveToDrive() {
  const token = sessionStorage.getItem("user");
  if (!token) return alert("You must be logged in to use Google Drive save.");
  const accessToken = JSON.parse(token).accessToken;

  const jsonString = JSON.stringify(currentWorld);
  const sizeInBytes = new Blob([jsonString]).size;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > 3) {
    return alert("Map data exceeds 3MB limit. Please use a smaller image or compress it.");
  }

  fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: currentFileName, fileContent: currentWorld, accessToken })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) {
      alert("Drive save failed: " + data.message);
    }
  })
  .catch(err => {
    console.error("Drive save error:", err);
    alert("Error saving to Google Drive: " + err.message);
  });
}


document.getElementById("saveDriveBtn")?.addEventListener("click", saveToDrive);
document.getElementById("saveFileBtn")?.addEventListener("click", saveToFile);

// Initialize
loadMapImage();
