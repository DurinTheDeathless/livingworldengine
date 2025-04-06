// Auto-load current world from window.name or localStorage
let currentWorld = null;
let currentFileName = null;

if (window.name && window.name.startsWith("{")) {
  try {
    const payload = JSON.parse(window.name);
    currentWorld = payload.world || null;
    currentFileName = payload.fileName || null;
  } catch (e) {
    console.warn("Failed to parse world from window.name", e);
  }
  window.name = ""; // clear to avoid reusing
}

if (!currentWorld) {
  try {
    currentWorld = JSON.parse(localStorage.getItem("currentWorld") || "{}");
    currentFileName = localStorage.getItem("worldFilename") || null;
  } catch (e) {
    console.warn("Could not load world from localStorage.");
    currentWorld = {};
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  const day = date.getDate();
  const suffix = (day > 3 && day < 21) ? 'th' :
    (day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th');
  const month = date.toLocaleString('default', { month: 'long' });
  const weekday = date.toLocaleString('default', { weekday: 'long' });
  const year = date.getFullYear();
  return `${weekday}, ${day}${suffix} of ${month} ${year}`;
}

function daysSince(iso) {
  if (!iso) return "?";
  const start = new Date(iso);
  const now = new Date();
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function populateWorldInfo() {
  document.getElementById("world-name").textContent = currentWorld.name || "Unnamed World";
  document.getElementById("created-on").textContent = currentWorld.created ? formatDate(currentWorld.created) : "[Unknown]";
  document.getElementById("days-elapsed").textContent = currentWorld.campaignStart ?
    daysSince(currentWorld.campaignStart) :
    daysSince(currentWorld.created);

  document.getElementById("inworld-date").textContent = currentWorld.inWorldDate || "[Set Date]";
  document.getElementById("world-summary").textContent = currentWorld.summary || "";
  loadPins();
}

function markDirty() {
  localStorage.setItem("currentWorld", JSON.stringify(currentWorld));
  localStorage.setItem("worldFilename", currentFileName || "world.json");
}

// Save to file
function saveToFile() {
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// Save to Drive (requires sessionStorage.user)
function saveToDrive() {
  const token = sessionStorage.getItem("user");
  if (!token) return alert("You must be logged in to use Google Drive save.");
  const accessToken = JSON.parse(token).accessToken;
  fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: currentFileName, fileContent: currentWorld, accessToken })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) alert("Drive save failed.");
  });
}

// Pins
function loadPins() {
  const list = document.getElementById("pins-list");
  list.innerHTML = "";
  if (!Array.isArray(currentWorld.pins)) currentWorld.pins = [];
  currentWorld.pins.forEach((pin, i) => {
    const li = document.createElement("li");
    li.textContent = pin;
    const del = document.createElement("span");
    del.textContent = " ✖";
    del.style.color = "red";
    del.style.cursor = "pointer";
    del.onclick = () => {
      currentWorld.pins.splice(i, 1);
      markDirty();
      loadPins();
    };
    li.appendChild(del);
    list.appendChild(li);
  });
}

document.getElementById("add-pin").addEventListener("click", () => {
  const input = document.getElementById("new-pin");
  const text = input.value.trim();
  if (!text) return;
  if (!Array.isArray(currentWorld.pins)) currentWorld.pins = [];
  currentWorld.pins.push(text);
  input.value = "";
  markDirty();
  loadPins();
});

document.getElementById("inworld-date").addEventListener("input", () => {
  currentWorld.inWorldDate = document.getElementById("inworld-date").textContent.trim();
  markDirty();
});

document.getElementById("world-summary").addEventListener("input", () => {
  currentWorld.summary = document.getElementById("world-summary").textContent.trim();
  markDirty();
});

document.getElementById("saveDriveBtn").addEventListener("click", saveToDrive);
document.getElementById("saveFileBtn").addEventListener("click", saveToFile);

// INIT
populateWorldInfo();
