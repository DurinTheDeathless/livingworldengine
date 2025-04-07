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

        console.log("✅ Loaded world from sessionStorage:", currentWorld);

        // Fallback structure if missing
        if (!currentWorld.name) {
          console.warn("⚠️ World is missing a name. Setting default.");
          currentWorld.name = "Unnamed World";
        }

        if (!currentWorld.created) {
          console.warn("⚠️ World is missing creation date. Setting to now.");
          currentWorld.created = new Date().toISOString();
        }

        populateWorldInfo();
      } catch (err) {
        console.error("❌ Failed to parse currentWorld from sessionStorage", err);
      }
    } else {
      console.warn("⚠️ No world found in sessionStorage.");
    }
  } catch (e) {
    console.warn("⚠️ Error loading world from sessionStorage", e);
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
  const dateSpan = document.getElementById("inworld-date");
  const summaryDiv = document.getElementById("world-summary");

  if (dateSpan) {
    currentWorld.inWorldDate = dateSpan.textContent.trim();
    console.log("📆 Synced inWorldDate:", currentWorld.inWorldDate);
  }

  if (summaryDiv) {
    currentWorld.summary = summaryDiv.textContent.trim();
    console.log("📝 Synced summary:", currentWorld.summary);
  }
}

function populateWorldInfo() {
  if (!currentWorld) return console.warn("⚠️ populateWorldInfo called but currentWorld is null");

  const nameEl = document.getElementById("world-name");
  const dateEl = document.getElementById("created-on");
  const daysEl = document.getElementById("days-elapsed");
  const inworldEl = document.getElementById("inworld-date");
  const summaryEl = document.getElementById("world-summary");

  if (!nameEl || !dateEl || !daysEl || !inworldEl || !summaryEl) {
    console.warn("⚠️ Missing DOM elements in populateWorldInfo.");
    return;
  }

  nameEl.textContent = currentWorld.name || "Unnamed World";
  dateEl.textContent = formatDate(currentWorld.created);
  daysEl.textContent = daysSince(currentWorld.campaignStart || currentWorld.created);
  inworldEl.textContent = currentWorld.inWorldDate || "[Set Date]";
  summaryEl.textContent = currentWorld.summary || "";

  console.log("✅ Populated world info on page.");
}

document.getElementById("inworld-date")?.addEventListener("input", () => {
  currentWorld.inWorldDate = document.getElementById("inworld-date")?.textContent.trim();
  console.log("🟠 Edited inWorldDate:", currentWorld.inWorldDate);
  window.markDirty?.();
});

document.getElementById("world-summary")?.addEventListener("input", () => {
  currentWorld.summary = document.getElementById("world-summary")?.textContent.trim();
  console.log("🟠 Edited world summary:", currentWorld.summary);
  window.markDirty?.();
});

document.getElementById("saveDriveBtn")?.addEventListener("click", () => {
  console.log("💾 Save to Drive clicked.");
  syncEditableFields();
  window.saveToDrive?.(currentWorld, currentFileName);
});

document.getElementById("saveFileBtn")?.addEventListener("click", () => {
  console.log("💾 Save to File clicked.");
  syncEditableFields();
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName || "world.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
