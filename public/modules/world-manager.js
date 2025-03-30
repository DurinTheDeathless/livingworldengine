let currentWorld = null;
let savedWorlds = JSON.parse(localStorage.getItem("userWorlds") || "[]");
const userWorldsList = document.getElementById("userWorlds");

function updateWorldList() {
  userWorldsList.innerHTML = "";
  savedWorlds.forEach(world => {
    const li = document.createElement("li");
    li.textContent = world.name;
    li.style.cursor = "pointer";
    li.onclick = () => {
      currentWorld = world;
      document.getElementById("deleteFile").value = world.name;
    };
    userWorldsList.appendChild(li);
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

function loadWorldFromFile() {
  const fileInput = document.getElementById("loadFile");
  const file = fileInput.files[0];
  if (!file) return alert("Please select a file to load.");

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const world = JSON.parse(e.target.result);
      currentWorld = world;
      sessionStorage.setItem("currentWorld", JSON.stringify(world));
      window.location.href = "/play.html";
    } catch (err) {
      alert("Invalid world file.");
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
      const world = JSON.parse(e.target.result);
      currentWorld = world;
      savedWorlds.push(world);
      localStorage.setItem("userWorlds", JSON.stringify(savedWorlds));
      sessionStorage.setItem("currentWorld", JSON.stringify(world));
      alert("World imported. Now use Save to Drive to store it.");
    } catch {
      alert("Invalid file format.");
    }
  };
  reader.readAsText(file);
}

function saveWorldToDrive() {
  if (!currentWorld) return alert("Not ready to save.");

  fetch("/drive/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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

function loadWorldFromDrive() {
  const name = prompt("Enter the name of the world to load from Drive:");
  if (!name) return;

  fetch(`/drive/load?name=${encodeURIComponent(name)}`)
    .then(res => res.json())
    .then(world => {
      if (!world || !world.name) {
        alert("World not found.");
        return;
      }
      currentWorld = world;
      sessionStorage.setItem("currentWorld", JSON.stringify(world));
      window.location.href = "/play.html";
    })
    .catch(() => alert("Error loading from Drive."));
}

function deleteWorldFromList() {
  const name = document.getElementById("deleteFile").value.trim();
  if (!name) return alert("Enter a world name to delete.");

  savedWorlds = savedWorlds.filter(w => w.name !== name);
  localStorage.setItem("userWorlds", JSON.stringify(savedWorlds));
  updateWorldList();
}

function downloadBlankWorld() {
  const name = document.getElementById("newWorldName").value.trim();
  if (!name) return alert("Enter a name before downloading.");

  const blankWorld = {
    name: name,
    created: new Date().toISOString(),
    data: {}
  };

  const blob = new Blob([JSON.stringify(blankWorld, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);

  alert(`Blank world "${name}" downloaded.`);
}

document.addEventListener("DOMContentLoaded", updateWorldList);
