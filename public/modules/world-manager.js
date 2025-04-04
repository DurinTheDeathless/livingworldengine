// world-manager.js

// In-memory list of worlds (each item will have {name, fileName, created, source, data})
let worldsList = [];

// Currently selected world name in the UI list (if any)
let selectedWorldName = null;

// Helper: get Google API access token from session (stored at login)
function getAccessToken() {
  const user = window.sessionStorage.getItem('user');
  if (!user) return null;
  return JSON.parse(user).accessToken;
}

// Utility: Update the displayed list of worlds in the UI
function updateWorldList() {
  const listElem = document.getElementById("userWorlds");
  listElem.innerHTML = "";
  // List each world by name
  worldsList.forEach(world => {
    const li = document.createElement("li");
    li.textContent = world.name;
    if (world.name === selectedWorldName) {
      li.classList.add("selected");
    }
    // When a list item is clicked, mark it as selected
    li.onclick = () => {
      selectedWorldName = world.name;
      // Highlight selection
      [...listElem.children].forEach(item => item.classList.remove("selected"));
      li.classList.add("selected");
    };
    listElem.appendChild(li);
  });
}

// Create a new world with default structure and open it for editing
function createNewWorld() {
  let name = document.getElementById("newWorldName").value.trim();
  if (!name) {
    // Default to "unnamed" if no name provided
    name = "Unnamed World";
  }
  // Construct initial world object with required structure
  const newWorld = {
    name: name,
    created: new Date().toISOString(),
    summary: ""
    countries: [{ name: "Unnamed Country" }],
    towns:    [{ name: "Unnamed Town" }],
    npcs:     [{ name: "Unnamed NPC" }],
    bbegs:    [{ name: "Unnamed BBEG" }],
    factions: [{ name: "Unnamed Faction" }]
  };
  // Set a default file name for this world (used for saving)
  const fileName = name.replace(/\s+/g, '_') + ".json";

  // If Google Drive is available (user logged in), save immediately to Drive
  const token = getAccessToken();
  if (token) {
    fetch("/drive/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: fileName, fileContent: newWorld, accessToken: token })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        alert("Failed to save new world to Drive.");
      }
      // Even if save fails, proceed to open the world in editor
    })
    .catch(err => alert("Error saving to Drive: " + err));
  }

  // Open the new world in the play editor (pass data via window.name)
  const payload = { world: newWorld, fileName: fileName, source: token ? "drive" : "local" };
  window.name = JSON.stringify(payload);
  window.location.href = "/play.html";
}

// Download a blank world (new world JSON) without opening it
function downloadBlankWorld() {
  let name = document.getElementById("newWorldName").value.trim();
  if (!name) {
    name = "Unnamed World";
  }
  const blankWorld = {
    name: name,
    created: new Date().toISOString(),
    countries: [{ name: "Unnamed Country" }],
    towns:    [{ name: "Unnamed Town" }],
    npcs:     [{ name: "Unnamed NPC" }],
    bbegs:    [{ name: "Unnamed BBEG" }],
    factions: [{ name: "Unnamed Faction" }]
  };
  // Create a JSON blob and trigger download
  const blob = new Blob([JSON.stringify(blankWorld, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/\s+/g, '_') + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

// Load the selected world from the list into the editor
async function loadSelectedWorld() {
  if (!selectedWorldName) {
    return alert("No world selected.");
  }
  const worldEntry = worldsList.find(w => w.name === selectedWorldName);
  if (!worldEntry) {
    return alert("World not found.");
  }
  // If the world is stored on Drive and data not already loaded, fetch it first
  if (worldEntry.source === "drive" && !worldEntry.data) {
    const token = getAccessToken();
    if (!token) return alert("You must log in to load this world from Drive.");
    try {
      const res = await fetch("/drive/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: worldEntry.fileName, accessToken: token })
      });
      if (!res.ok) {
        return alert("Failed to load world from Drive.");
      }
      const data = await res.json();
      worldEntry.data = data;
    } catch (err) {
      return alert("Error loading from Drive.");
    }
  }
  // Prepare data payload and navigate to play page
  const payload = { 
    world: worldEntry.data || worldEntry.world, 
    fileName: worldEntry.fileName || null, 
    source: worldEntry.source 
  };
  window.name = JSON.stringify(payload);
  window.location.href = "/play.html";
}

// Remove the selected world from the list (and Drive if applicable)
async function deleteSelectedWorld() {
  if (!selectedWorldName) {
    return alert("No world selected.");
  }
  const index = worldsList.findIndex(w => w.name === selectedWorldName);
  if (index === -1) {
    return alert("World not found.");
  }
  const worldEntry = worldsList[index];
  // Confirm deletion
  if (!confirm(`Delete world "${worldEntry.name}"? This cannot be undone.`)) {
    return;
  }
  // If it's a Drive world, attempt to delete from Drive
  if (worldEntry.source === "drive") {
    const token = getAccessToken();
    if (token) {
      try {
        await fetch("/drive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: worldEntry.fileName, accessToken: token })
        });
      } catch {
        alert("Warning: could not delete file from Google Drive.");
        // Proceed to remove from list anyway
      }
    }
  }
  // Remove from local list and update UI
  worldsList.splice(index, 1);
  selectedWorldName = null;
  updateWorldList();
}

// Load a world from a local JSON file directly into the editor
function loadWorldFromFile() {
  const fileInput = document.getElementById("loadFile");
  const file = fileInput.files[0];
  if (!file) return alert("Select a file to load.");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const worldData = JSON.parse(e.target.result);
      // Use the file's name (or world name) for fileName reference
      const fileName = file.name.endsWith(".json") ? file.name : (file.name + ".json");
      const name = worldData.name || worldData.worldName || file.name.replace(".json", "");
      // Prepare payload and navigate to play page
      const payload = { world: worldData, fileName: fileName, source: "local" };
      window.name = JSON.stringify(payload);
      window.location.href = "/play.html";
    } catch {
      alert("Invalid file format.");
    }
  };
  reader.readAsText(file);
}

// Import a world from a local file into the list (without opening it)
function importWorldFromFile() {
  const fileInput = document.getElementById("importFile");
  const file = fileInput.files[0];
  if (!file) return alert("Select a file to import.");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const worldData = JSON.parse(e.target.result);
      const name = worldData.name || worldData.worldName || "Unnamed World";
      const fileName = file.name.endsWith(".json") ? file.name : (file.name + ".json");
      // Add to in-memory list
      worldsList.push({
        name: name,
        fileName: fileName,
        created: worldData.created || new Date().toISOString(),
        source: "local",
        data: worldData
      });
      // Mark the newly imported world as selected in the UI
      selectedWorldName = name;
      updateWorldList();
      alert(`World "${name}" imported. You can now load it or save it to Drive.`);
    } catch {
      alert("Invalid file format.");
    }
  };
  reader.readAsText(file);
}

// Save the currently selected (or last imported) world to Google Drive
function saveSelectedWorldToDrive() {
  if (!selectedWorldName) {
    return alert("No world selected to save.");
  }
  const worldEntry = worldsList.find(w => w.name === selectedWorldName);
  if (!worldEntry) {
    return alert("World not found.");
  }
  if (worldEntry.source === "drive") {
    return alert("This world is already saved to Drive.");
  }
  const token = getAccessToken();
  if (!token) {
    return alert("You must be logged in with Google to save to Drive.");
  }
  // Use the stored fileName (or default) for saving
  const fileName = worldEntry.fileName || (worldEntry.name.replace(/\s+/g, '_') + ".json");
  fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: fileName, fileContent: worldEntry.data, accessToken: token })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      worldEntry.source = "drive";
      worldEntry.fileName = fileName;
      alert(`World "${worldEntry.name}" saved to Google Drive.`);
    } else {
      alert("Failed to save world to Drive.");
    }
  })
  .catch(err => alert("Error saving to Drive: " + err));
}

// Save the currently selected world as a local JSON file (download)
function saveSelectedWorldToFile() {
  if (!selectedWorldName) {
    return alert("No world selected to save.");
  }
  const worldEntry = worldsList.find(w => w.name === selectedWorldName);
  if (!worldEntry) return;
  const data = worldEntry.data;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  // Use the world's fileName or name for the download
  const downloadName = worldEntry.fileName || (worldEntry.name.replace(/\s+/g, "_") + ".json");
  a.download = downloadName;
  a.click();
  URL.revokeObjectURL(a.href);
  alert(`World "${worldEntry.name}" downloaded as ${downloadName}.`);
}

// If user is logged in, load their Drive worlds list on page load
async function listWorldsFromDrive() {
  const token = getAccessToken();
  if (!token) {
    return; // not logged in, skip Drive listing
  }
  try {
    const res = await fetch("/drive/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ accessToken: token })  // <-- this is what your backend expects
    });
    
    if (res.ok) {
      const { files } = await res.json();
      worldsList = []; // Clear old entries before loading fresh from Drive
      files.forEach(file => {
        if (file.name && file.name.endsWith(".json")) {
          const worldName = file.name.replace(".json", "").replace(/_/g, " ");
          // Avoid duplicates (e.g., if already in list by import)
          if (!worldsList.find(w => w.fileName === file.name)) {
            worldsList.push({
              name: capitalizeWords(worldName),
              fileName: file.name,
              created: "(on Drive)",
              source: "drive",
              data: null  // will load on demand
            });
          }
        }
      });
      updateWorldList();
    }
  } catch {
    console.warn("Could not list files from Drive.");
  }
}

// Helper to capitalize each word (for pretty display of file names)
function capitalizeWords(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Attach event handlers for Save buttons after DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Update list from any stored session data (should be none since no localStorage used)
  updateWorldList();
  // Attempt to list worlds from Drive if logged in
  listWorldsFromDrive();
  // Set up Save buttons (used instead of inline onclick for Drive/File save to ensure latest selection)
  const saveDriveBtn = document.getElementById("saveDriveBtn");
  const saveFileBtn = document.getElementById("saveFileBtn");
  if (saveDriveBtn) saveDriveBtn.onclick = saveSelectedWorldToDrive;
  if (saveFileBtn) saveFileBtn.onclick = saveSelectedWorldToFile;
});
