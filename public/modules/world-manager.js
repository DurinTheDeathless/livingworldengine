let currentWorld = null;
let selectedWorldName = null;
let savedWorlds = JSON.parse(localStorage.getItem("userWorlds") || "[]");

function updateWorldList() {
  const list = document.getElementById("userWorlds");
  list.innerHTML = "";

  savedWorlds.forEach(world => {
    const li = document.createElement("li");
    li.textContent = world.name;
    li.onclick = () => {
      selectedWorldName = world.name;
      [...list.children].forEach(li => li.classList.remove("selected"));
      li.classList.add("selected");
    };
    list.appendChild(li);
  });
}

function createNewWorld() {
  const name = document.getElementById("newWorldName").value.trim();
  if (!name) return alert("Please enter a world name.");

  const world = {
    name,
    created: new Date().toISOString(),
    data: {}
  };

  currentWorld = world;
  savedWorlds.push(world);
  localStorage.setItem("userWorlds", JSON.stringify(savedWorlds));
  sessionStorage.setItem("currentWorld", JSON.stringify(world));
  window.location.href = "/play.html";
}

function downloadBlankWorld() {
  const name = document.getElementById("newWorldName").value.trim();
  if (!name) return alert("Enter a name before downloading.");

  const blankWorld = {
    name,
    created: new Date().toISOString(),
    data: {}
  };

  const blob = new Blob([JSON.stringify(blankWorld, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadSelectedWorld() {
  if (!selectedWorldName) return alert("No world selected.");
  const world = savedWorlds.find(w => w.name === selectedWorldName);
  if (!world) return alert("World not found.");

  currentWorld = world;
  sessionStorage.setItem("currentWorld", JSON.stringify(world));
  window.location.href = "/play.html";
}

function deleteSelectedWorld() {
  if (!selectedWorldName) return alert("No world selected.");
  savedWorlds = savedWorlds.filter(w => w.name !== selectedWorldName);
  localStorage.setItem("userWorlds", JSON.stringify(savedWorlds));
  selectedWorldName = null;
  updateWorldList();
}

function loadWorldFromFile() {
  const file = document.getElementById("loadFile").files[0];
  if (!file) return alert("Select a file to load.");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const world = JSON.parse(e.target.result);
      currentWorld = world;
      sessionStorage.setItem("currentWorld", JSON.stringify(world));
      window.location.href = "/play.html";
    } catch {
      alert("Invalid file.");
    }
  };
  reader.readAsText(file);
}

function importWorld() {
  const file = document.getElementById("importFile").files[0];
  if (!file) return alert("Select a file to import.");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const world = JSON.parse(e.target.result);
      currentWorld = world;
      savedWorlds.push(world);
      localStorage.setItem("userWorlds", JSON.stringify(savedWorlds));
      sessionStorage.setItem("currentWorld", JSON.stringify(world));
      updateWorldList();
      alert("World imported and added to list.");
    } catch {
      alert("Invalid file.");
    }
  };
  reader.readAsText(file);
}

function saveImportedWorldToDrive() {
  if (!currentWorld) return alert("No imported world to save.");
  fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentWorld)
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert("World saved to Google Drive.");
      } else {
        alert("Error saving to Drive.");
      }
    });
}

document.addEventListener("DOMContentLoaded", updateWorldList);
