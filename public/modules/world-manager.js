
let currentWorld = null;
let currentFile = null;

function getAccessToken() {
  const user = window.sessionStorage.getItem('user');
  if (!user) return null;
  return JSON.parse(user).accessToken;
}

function createNewWorld() {
  const name = document.getElementById('newWorldName').value.trim();
  if (!name) return alert('Please enter a name');
  currentFile = name.replace(/\s+/g, '_') + '.json';
  currentWorld = {
    worldName: name,
    countries: [],
    towns: [],
    npcs: []
  };
  saveToDrive(() => {
    localStorage.setItem("currentWorld", JSON.stringify(currentWorld));
    window.location.href = '/play.html';
  });
}

function enterWorld(filename) {
  localStorage.setItem("currentWorld", filename);
  window.location.href = "/play.html";
}

function saveToDrive(callback) {
  const accessToken = getAccessToken();
  if (!accessToken || !currentFile || !currentWorld) return alert("Not ready to save.");

  fetch('/drive/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: currentFile,
      fileContent: currentWorld,
      accessToken
    })
  }).then(res => res.json())
    .then(data => {
      if (data.success && callback) callback();
      else if (!data.success) alert("Failed to save to Drive.");
    });
}

function loadFromDrive() {
  const fileName = prompt("Enter the file name to load (e.g., MyWorld.json):");
  if (!fileName) return;

  const accessToken = getAccessToken();
  if (!accessToken) return alert("You must be logged in to load from Drive.");

  fetch('/drive/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, accessToken })
  }).then(res => res.json())
    .then(data => {
      currentWorld = data;
      currentFile = fileName;
      localStorage.setItem("currentWorld", JSON.stringify(currentWorld));
      window.location.href = "/play.html";
    }).catch(() => alert("Failed to load from Drive."));
}

function importWorldFromFile() {
  const input = document.getElementById('importFile');
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      currentWorld = imported;
      currentFile = imported.worldName.replace(/\s+/g, '_') + '.json';
      localStorage.setItem("currentWorld", JSON.stringify(currentWorld));
      alert('World imported. Now use Save to Drive to store it.');
    } catch {
      alert("Invalid world file.");
    }
  };
  reader.readAsText(file);
}

function loadWorldFromFile() {
  const input = document.getElementById('loadFile');
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      currentWorld = JSON.parse(event.target.result);
      currentFile = null;
      localStorage.setItem("currentWorld", JSON.stringify(currentWorld));
      window.location.href = '/play.html';
    } catch {
      alert("Invalid world file.");
    }
  };
  reader.readAsText(file);
}

window.onload = () => {
  document.getElementById("saveDriveBtn").onclick = () => saveToDrive();
  document.getElementById("loadDriveBtn").onclick = () => loadFromDrive();
};
