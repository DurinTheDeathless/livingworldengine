let currentWorld = null;
let currentFileName = null;
let fileId = null;

window.addEventListener("DOMContentLoaded", () => {
  try {
    const stored = sessionStorage.getItem("currentWorld");
    if (stored) {
      try {
        currentWorld = JSON.parse(stored);
        currentFileName = sessionStorage.getItem("worldFilename") || "world.json";
        fileId = currentWorld.fileId || null;

        // Fallback structure if missing
        if (!currentWorld.name) currentWorld.name = "Unnamed World";
        if (!currentWorld.created) currentWorld.created = new Date().toISOString();

        populateWorldInfo();
      } catch (err) {
        console.error("❌ Failed to parse currentWorld from sessionStorage", err);
      }
    } else {
      console.warn("⚠️ No world found in sessionStorage.");
    }
  } catch (e) {
    console.warn("Could not load world from sessionStorage", e);
  }
});

function formatDate(isoDate) {
  if (!isoDate) return "[Unknown]";
  const date = new Date(isoDate);
  const day = date.getDate();
  const suffix = (d => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  })(day);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${weekday} ${day}${suffix} of ${month} ${year}`;
}

function daysSince(iso) {
  if (!iso) return "?";
  const start = new Date(iso);
  const now = new Date();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

function syncEditableFields() {
  currentWorld.inWorldDate = document.getElementById("inworld-date")?.textContent.trim();
  currentWorld.summary = document.getElementById("world-summary")?.textContent.trim();
}

function populateWorldInfo() {
  if (!currentWorld) return;

  document.getElementById("world-name-display").textContent = currentWorld.name || "Unnamed World";
  document.getElementById("created-on").textContent = formatDate(currentWorld.created);
  document.getElementById("days-elapsed").textContent = daysSince(currentWorld.campaignStart || currentWorld.created);
  document.getElementById("inworld-date").textContent = currentWorld.inWorldDate || "[Set Date]";
  document.getElementById("world-summary").textContent = currentWorld.summary || "";
}


document.getElementById("inworld-date")?.addEventListener("input", () => {
  currentWorld.inWorldDate = document.getElementById("inworld-date")?.textContent.trim();
  window.markDirty?.();
});

document.getElementById("world-summary")?.addEventListener("input", () => {
  currentWorld.summary = document.getElementById("world-summary")?.textContent.trim();
  window.markDirty?.();
});

document.getElementById("saveDriveBtn")?.addEventListener("click", () => {
  syncEditableFields();
  window.saveToDrive?.(currentWorld, currentFileName);
});

document.getElementById("saveFileBtn")?.addEventListener("click", () => {
  syncEditableFields();
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
