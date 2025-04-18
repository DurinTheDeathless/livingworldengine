let currentWorld = JSON.parse(sessionStorage.getItem("currentWorld"));
let currentFileName = null;
let source = "local";

try {
  const worldData = JSON.parse(sessionStorage.getItem("currentWorld"));
  if (worldData) {
    currentWorld = worldData;
    currentFileName = sessionStorage.getItem("currentFileName");
    source = sessionStorage.getItem("currentWorldSource") || "local";
  }
} catch (e) {
  console.error("Failed to load world from sessionStorage.");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const worldNameElem = document.getElementById("world-name");
let worldName = "Unnamed World";
if (currentWorld) {
  worldName = currentWorld.name || currentWorld.worldName || "Unnamed World";
}
if (!worldName) {
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
    document.getElementById("world-name").textContent = newName;
    isDirty = true;
  }
  document.getElementById("world-name").style.display = "inline-block";
  document.querySelector(".edit-btn").style.display = "inline-block";
  document.getElementById("world-name-input").style.display = "none";
  document.getElementById("save-world-name").style.display = "none";
}

let isDirty = false;

function markDirty() {
  isDirty = true;
}

function saveToDrive() {
  const tokenData = window.sessionStorage.getItem('user');
  if (!tokenData || !currentFileName) return;
  const accessToken = JSON.parse(tokenData).accessToken;
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
    isDirty = false;
  })
  .catch(err => console.error("Drive save error:", err));
}

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

setInterval(() => {
  if (!isDirty) return;
  if (source === "drive") {
    saveToDrive();
  } else {
    isDirty = false;
  }
}, 30000);

window.addEventListener("beforeunload", (e) => {
  if (source === "local" && isDirty) {
    saveToFile();
  }
});

async function createNewWorld() {
  const worldName = document.getElementById("newWorldName").value.trim();
  if (!worldName) return alert("Please enter a world name.");

  const worldData = {
    name: worldName,
    created: new Date().toISOString(),
    summary: "",
    countries: [{ name: "Unnamed Country" }],
    towns: [{ name: "Unnamed Town" }],
    npcs: [{ name: "Unnamed NPC" }],
    factions: [{ name: "Unnamed Faction" }],
    events: [],
    bbeg: { name: "Unnamed BBEG" },
    market: {},
    journal: []
  };

  const fileName = `${worldName.replace(/\s+/g, "_")}.json`;

  const user = JSON.parse(sessionStorage.getItem("user"));
  const accessToken = user?.accessToken;

  if (!accessToken) return alert("You are not logged in!");

  try {
    console.log("✅ Access Token:", accessToken);

    const fileBlob = new Blob([JSON.stringify(worldData, null, 2)], { type: "application/json" });
    const file = new File([fileBlob], fileName, { type: "application/json" });
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", fileName);
    
    console.log("📦 Uploading File:", file);
    
    const res = await fetch("/drive/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    
  
    try {
      const result = await res.json();
      if (res.ok) {
        alert("New world created and saved to Google Drive!");
        window.location.href = "/play.html?file=" + encodeURIComponent(`${worldName}.json`);
      } else {
        console.error("Drive upload failed:", result);
        alert("Failed to save new world to Drive.");
      }
    } catch (jsonError) {
      const fallbackText = await res.text();
      console.error("❌ Response was not JSON:", fallbackText);
      alert("Unexpected response from server.");
    }
  } catch (err) {
    console.error("❌ Error uploading world:", err);
    alert("Upload error. Check console.");
  }}

  async function createWorldInDrive() {
    const name = document.getElementById("newWorldName").value.trim();
    if (!name) return alert("Enter a world name.");
  
    const worldData = {
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
      journal: []
    };
  
    const file = new File([JSON.stringify(worldData, null, 2)], `${name}.json`, {
      type: "application/json"
    });
  
    const user = JSON.parse(sessionStorage.getItem("user"));
    const accessToken = user?.accessToken;
    if (!accessToken) return alert("You are not logged in!");
  
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", `${name}.json`);
  
    try {
      const res = await fetch("/drive/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
  
      const result = await res.json();
      if (res.ok) {
        alert("World created and saved to Google Drive!");
        window.location.href = "/play.html?file=" + encodeURIComponent(`${name}.json`);
      } else {
        console.error(result);
        alert("Failed to save to Drive.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading world to Drive.");
    }
  }
  
  function createWorldLocally() {
    const name = document.getElementById("newWorldName").value.trim() || "unnamed";
    const worldData = {
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
      journal: []
    };
  
    const blob = new Blob([JSON.stringify(worldData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  
    sessionStorage.setItem("localWorldData", JSON.stringify(worldData));
    window.location.href = "/play.html";
  }
  
function loadWorld(worldData, filename) {
  if (!worldData || typeof worldData !== "object") return alert("Invalid world file");

  sessionStorage.setItem("currentWorld", JSON.stringify(worldData));
  sessionStorage.setItem("worldFilename", filename || "world.json");

  window.location.href = "/play.html";
}

document.getElementById("loadLocalFileBtn")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    try {
      const worldData = JSON.parse(reader.result);
      loadWorld(worldData, file.name);
    } catch (err) {
      alert("Failed to load file: " + err.message);
    }
  };
  reader.readAsText(file);
});

function onGoogleDriveLoadSuccess(worldData, filename) {
  loadWorld(worldData, filename);
}

window.loadWorldFromDrive = onGoogleDriveLoadSuccess;

console.log("✅ app.js finished and sessionStorage is set");
console.log("🟢 play.js is starting");