try {
  const stored = sessionStorage.getItem("currentWorld");
  if (stored) {
    currentWorld = JSON.parse(stored);
    currentFileName = sessionStorage.getItem("worldFilename") || "world.json";
  }
} catch (e) {
  console.warn("Could not load world from sessionStorage", e);
}

function formatDate(isoDate) {
  if (!isoDate) return "[Unknown]";
  const date = new Date(isoDate);
  if (isNaN(date)) return "[Unknown]";
  const day = date.getDate();
  const daySuffix = (d => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  })(day);
  const options = { weekday: 'long', month: 'long', year: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-GB', options);
  const parts = formatter.formatToParts(date);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const year = parts.find(p => p.type === 'year')?.value;
  return `${weekday} ${day}${daySuffix} of ${month} ${year}`;
}

function daysSince(iso) {
  if (!iso) return "?";
  const start = new Date(iso);
  const now = new Date();
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function populateWorldInfo() {
  if (!currentWorld) return;
  document.getElementById("world-name").textContent = currentWorld.name || "Unnamed World";
  document.getElementById("created-on").textContent = currentWorld.created ? formatDate(currentWorld.created) : "[Unknown]";
  document.getElementById("days-elapsed").textContent = currentWorld.campaignStart ?
    daysSince(currentWorld.campaignStart) :
    daysSince(currentWorld.created);

  document.getElementById("inworld-date").textContent = currentWorld.inWorldDate || "[Set Date]";
  document.getElementById("world-summary").textContent = currentWorld.summary || "";
  loadPins();
}

function saveToFile() {
  if (!currentWorld) return;
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function saveToDrive() {
  const token = sessionStorage.getItem("user");
  if (!token) return alert("You must be logged in to use Google Drive save.");
  const accessToken = JSON.parse(token).accessToken;

  fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: currentFileName,
      fileContent: currentWorld,
      accessToken
    })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) alert("Drive save failed.");
  })
  .catch(err => {
    console.error("Drive save error:", err);
    alert("Error saving to Google Drive: " + err.message);
  });
}

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
      markDirty?.(); // safe optional call
      loadPins();
    };
    li.appendChild(del);
    list.appendChild(li);
  });
}

document.getElementById("add-pin")?.addEventListener("click", () => {
  const input = document.getElementById("new-pin");
  const text = input.value.trim();
  if (!text) return;
  if (!Array.isArray(currentWorld.pins)) currentWorld.pins = [];
  currentWorld.pins.push(text);
  input.value = "";
  markDirty?.();
  loadPins();
});

document.getElementById("inworld-date")?.addEventListener("input", () => {
  currentWorld.inWorldDate = document.getElementById("inworld-date").textContent.trim();
  markDirty?.();
});

document.getElementById("world-summary")?.addEventListener("input", () => {
  currentWorld.summary = document.getElementById("world-summary").textContent.trim();
  markDirty?.();
});

document.getElementById("saveDriveBtn")?.addEventListener("click", saveToDrive);
document.getElementById("saveFileBtn")?.addEventListener("click", saveToFile);

populateWorldInfo();
document.addEventListener("DOMContentLoaded", populateWorldInfo);

