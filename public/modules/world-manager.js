let worldsList = [];
let selectedWorldName = null;

function getAccessToken() {
  const user = window.sessionStorage.getItem('user');
  if (!user) return null;
  return JSON.parse(user).accessToken;
}

function updateWorldList() {
  const listElem = document.getElementById("userWorlds");
  listElem.innerHTML = "";
  worldsList.forEach(world => {
    const li = document.createElement("li");
    li.textContent = world.name;
    if (world.name === selectedWorldName) {
      li.classList.add("selected");
    }
    li.onclick = () => {
      selectedWorldName = world.name;
      [...listElem.children].forEach(item => item.classList.remove("selected"));
      li.classList.add("selected");
    };
    listElem.appendChild(li);
  });
}

function createNewWorld() {
  let name = document.getElementById("newWorldName").value.trim();
  if (!name) name = "Unnamed World";

  const newWorld = {
    name,
    created: new Date().toISOString(),
    summary: "",
    countries: [],
    towns: [],
    npcs: [],
    factions: [],
    events: [],
    bbeg: {},
    market: {},
    journal: [],
    campaignStart: new Date().toISOString(),
    pins: [],
    instabilityMeter: 0,
    favorMeter: 0
  };

  const fileName = name.replace(/\s+/g, '_') + ".json";
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
    })
    .catch(err => alert("Error saving to Drive: " + err));
  }

  sessionStorage.setItem("currentWorld", JSON.stringify(worldData));
sessionStorage.setItem("worldFilename", fileName);
window.location.href = "/play.html";

}

function downloadBlankWorld() {
  let name = document.getElementById("newWorldName").value.trim();
  if (!name) name = "Unnamed World";

  const blankWorld = {
    name: name,
    created: new Date().toISOString(),
    countries: [{ name: "Unnamed Country" }],
    towns:    [{ name: "Unnamed Town" }],
    npcs:     [{ name: "Unnamed NPC" }],
    bbegs:    [{ name: "Unnamed BBEG" }],
    factions: [{ name: "Unnamed Faction" }]
  };

  const blob = new Blob([JSON.stringify(blankWorld, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/\s+/g, '_') + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

async function loadSelectedWorld() {
  if (!selectedWorldName) return alert("No world selected.");
  const worldEntry = worldsList.find(w => w.name === selectedWorldName);
  if (!worldEntry) return alert("World not found.");

  if (worldEntry.source === "drive" && !worldEntry.data) {
    const token = getAccessToken();
    if (!token) return alert("You must log in to load this world from Drive.");
    try {
      const res = await fetch("/drive/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: worldEntry.fileName, accessToken: token })
      });
      if (!res.ok) return alert("Failed to load world from Drive.");
      const data = await res.json();
      worldEntry.data = data;
    } catch (err) {
      return alert("Error loading from Drive.");
    }
  }

  const worldData = worldEntry.data || worldEntry.world;
sessionStorage.setItem("currentWorld", JSON.stringify(worldData));
sessionStorage.setItem("worldFilename", worldEntry.fileName || "world.json");
window.location.href = "/play.html";

}

async function deleteSelectedWorld() {
  if (!selectedWorldName) return alert("No world selected.");

  const index = worldsList.findIndex(w => w.name === selectedWorldName);
  if (index === -1) return alert("World not found.");

  const worldEntry = worldsList[index];
  if (!confirm(`Delete world "${worldEntry.name}"? This cannot be undone.`)) return;

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
      }
    }
  }

  worldsList.splice(index, 1);
  selectedWorldName = null;
  updateWorldList();
}

function loadWorldFromFile() {
  const fileInput = document.getElementById("loadFile");
  const file = fileInput.files[0];
  if (!file) return alert("Select a file to load.");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const worldData = JSON.parse(e.target.result);
      const fileName = file.name.endsWith(".json") ? file.name : (file.name + ".json");
      const name = worldData.name || worldData.worldName || file.name.replace(".json", "");
      const payload = { world: worldData, fileName: fileName, source: "local" };
      window.name = JSON.stringify(payload);
      window.location.href = "/play.html";
    } catch {
      alert("Invalid file format.");
    }
  };
  reader.readAsText(file);
}

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
      worldsList.push({
        name: name,
        fileName: fileName,
        created: worldData.created || new Date().toISOString(),
        source: "local",
        data: worldData
      });
      selectedWorldName = name;
      updateWorldList();
      alert(`World "${name}" imported. You can now load it or save it to Drive.`);
    } catch {
      alert("Invalid file format.");
    }
  };
  reader.readAsText(file);
}

function saveSelectedWorldToDrive() {
  if (!selectedWorldName) return alert("No world selected to save.");
  const worldEntry = worldsList.find(w => w.name === selectedWorldName);
  if (!worldEntry) return alert("World not found.");
  if (worldEntry.source === "drive") return alert("This world is already saved to Drive.");

  const token = getAccessToken();
  if (!token) return alert("You must be logged in with Google to save to Drive.");

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

function saveSelectedWorldToFile() {
  if (!selectedWorldName) return alert("No world selected to save.");
  const worldEntry = worldsList.find(w => w.name === selectedWorldName);
  if (!worldEntry) return;
  const data = worldEntry.data;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const downloadName = worldEntry.fileName || (worldEntry.name.replace(/\s+/g, "_") + ".json");
  a.download = downloadName;
  a.click();
  URL.revokeObjectURL(a.href);
  alert(`World "${worldEntry.name}" downloaded as ${downloadName}.`);
}

async function listWorldsFromDrive() {
  const token = getAccessToken();
  if (!token) return;

  try {
    const res = await fetch("/drive/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token })
    });

    if (res.ok) {
      const { files } = await res.json();
      worldsList = [];
      files.forEach(file => {
        if (file.name && file.name.endsWith(".json")) {
          const worldName = file.name.replace(".json", "").replace(/_/g, " ");
          if (!worldsList.find(w => w.fileName === file.name)) {
            worldsList.push({
              name: capitalizeWords(worldName),
              fileName: file.name,
              created: "(on Drive)",
              source: "drive",
              data: null
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

function capitalizeWords(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

document.addEventListener("DOMContentLoaded", () => {
  updateWorldList();
  listWorldsFromDrive();
  const saveDriveBtn = document.getElementById("saveDriveBtn");
  const saveFileBtn = document.getElementById("saveFileBtn");
  if (saveDriveBtn) saveDriveBtn.onclick = saveSelectedWorldToDrive;
  if (saveFileBtn) saveFileBtn.onclick = saveSelectedWorldToFile;
});
