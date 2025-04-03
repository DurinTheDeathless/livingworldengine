// app.js  (Play page script)

// Parse world data passed from the manager (via window.name)
let currentWorld = {};
let currentFileName = null;
let source = "local";  // "drive" or "local" source of currentWorld
if (window.name && window.name.length > 0) {
  try {
    const payload = JSON.parse(window.name);
    currentWorld = payload.world || {};
    currentFileName = payload.fileName || null;
    source = payload.source || "local";
  } catch (e) {
    console.error("Failed to parse world data from manager.");
  }
}
// Clear window.name to avoid reusing stale data
window.name = "";

// Utility: Capitalize string (used for display names if needed)
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Display the world name in the UI (or "Unnamed World" if none)
const worldNameElem = document.getElementById("world-name");
let worldName = currentWorld.name || currentWorld.worldName;
if (!worldName) {
  // If no name property, derive from file name
  if (currentFileName) {
    worldName = currentFileName.replace(".json", "").replace(/[_\-]/g, " ");
  }
}
if (!worldName || worldName.trim() === "") {
  worldName = "Unnamed World";
}
if (worldNameElem) {
  worldNameElem.textContent = worldName;
}

// Editing world name (enable inline editing functionality)
function enableEdit() {
  const nameDisplay = document.getElementById("world-name");
  const editBtn = document.querySelector(".edit-btn");
  const nameInput = document.getElementById("world-name-input");
  const saveNameBtn = document.getElementById("save-world-name");
  if (!nameDisplay || !nameInput || !saveNameBtn || !editBtn) return;
  nameDisplay.style.display = "none";
  editBtn.style.display = "none";
  nameInput.style.display = "inline-block";
  saveNameBtn.style.display = "inline-block";
  nameInput.value = worldName;
}
function saveWorldName() {
  const nameInput = document.getElementById("world-name-input");
  const newName = nameInput ? nameInput.value.trim() : "";
  if (newName) {
    currentWorld.name = newName;
    worldName = newName;
    // Update display
    document.getElementById("world-name").textContent = newName;
    // Mark as dirty so it will be saved
    isDirty = true;
  }
  // Hide edit controls and show static name and edit button again
  document.getElementById("world-name").style.display = "inline-block";
  document.querySelector(".edit-btn").style.display = "inline-block";
  document.getElementById("world-name-input").style.display = "none";
  document.getElementById("save-world-name").style.display = "none";
}

// Auto-save management
let isDirty = false;  // flag to indicate unsaved changes

// Mark the world as dirty whenever a change is made in its data
function markDirty() {
  isDirty = true;
}

// Google Drive save function (saves currentWorld if user is logged in)
function saveToDrive() {
  const tokenData = window.sessionStorage.getItem('user');
  if (!tokenData || !currentFileName) return;
  const accessToken = JSON.parse(tokenData).accessToken;
  // Send currentWorld to Drive (update existing file or create new)
  fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: currentFileName, fileContent: currentWorld, accessToken: accessToken })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) {
      console.warn("Auto-save to Drive failed.");
    }
    // Reset dirty flag regardless (to avoid rapid re-save attempts)
    isDirty = false;
  })
  .catch(err => console.error("Drive save error:", err));
}

// Local file save function (downloads the current world data)
function saveToFile() {
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  const name = currentFileName || (worldName.replace(/\s+/g, "_") + ".json");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  isDirty = false;
}

// Set up auto-save interval (every 30 seconds)
setInterval(() => {
  if (!isDirty) return;  // only save if there are changes
  if (source === "drive") {
    saveToDrive();
  } else {
    // For local source, we cannot auto-write to disk without user action.
    // (Auto-save handled on unload for local.)
    isDirty = false;
  }
}, 30000);

// Warn user or auto-save on page unload for unsaved local data
window.addEventListener("beforeunload", (e) => {
  if (source === "local" && isDirty) {
    // Auto-download the latest data to prevent loss
    saveToFile();
    // (Optionally, one could set e.returnValue to show a warning prompt instead)
  }
});
