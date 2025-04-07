// ✅ 1. Ensure worldData has fileId (used during load or save)
function ensureFileId(worldData, fileIdFromSession) {
  if (!worldData.fileId && fileIdFromSession) {
    worldData.fileId = fileIdFromSession;
  }
  return worldData;
}

// ✅ 2. Used when loading a world from sessionStorage
window.injectFileIdFromSession = function () {
  const stored = sessionStorage.getItem("currentWorld");
  if (stored) {
    const data = JSON.parse(stored);
    const sessionFileId = data.fileId || null;
    if (!data.fileId && sessionFileId) {
      data.fileId = sessionFileId;
      sessionStorage.setItem("currentWorld", JSON.stringify(data));
    }
  }
};

// ✅ 3. Update all editable fields into currentWorld
window.syncEditableFields = function () {
  try {
    const inWorldEl = document.getElementById("inworld-date");
    const summaryEl = document.getElementById("world-summary");
    if (inWorldEl && window.currentWorld) {
      window.currentWorld.inWorldDate = inWorldEl.textContent.trim();
    }
    if (summaryEl && window.currentWorld) {
      window.currentWorld.summary = summaryEl.textContent.trim();
    }
  } catch (err) {
    console.warn("Could not sync editable fields:", err);
  }
};

// ✅ 4. Show 'Unsaved changes...' status
window.markDirty = function () {
  const statusEl = document.getElementById("saveStatus");
  if (statusEl) {
    statusEl.textContent = "Unsaved changes...";
    statusEl.style.color = "orange";
  }
};

// ✅ 5. Central Save to Drive
window.saveToDrive = function (worldData, fileName) {
  const token = sessionStorage.getItem("user");
  if (!token) return alert("You must be logged in to use Google Drive save.");
  const accessToken = JSON.parse(token).accessToken;

  const jsonString = JSON.stringify(worldData);
  const sizeInBytes = new Blob([jsonString]).size;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > 3) {
    return alert("World file exceeds 3MB limit. Please reduce map size or content.");
  }

  ensureFileId(worldData, worldData.fileId || null);

  console.log("Saving to Drive:", fileName, "Size:", sizeInBytes, "bytes");

  return fetch("/drive/save", {
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
    const statusEl = document.getElementById("saveStatus");

    if (data.success) {
      if (data.fileId) {
        worldData.fileId = data.fileId;
        sessionStorage.setItem("currentWorld", JSON.stringify(worldData));
      }

      if (statusEl) {
        statusEl.textContent = `✅ Saved to Google Drive as ${fileName}`;
        statusEl.style.color = "lightgreen";
        setTimeout(() => (statusEl.textContent = ""), 3000);
      }
    } else {
      console.warn("⚠️ Drive save failed:", data.message || data);
      if (statusEl) {
        statusEl.textContent = `❌ Failed to save.`;
        statusEl.style.color = "orange";
      }
      alert("Failed to save to Google Drive.");
    }
  })
  .catch(err => {
    console.error("❌ Drive save error:", err);
    alert("Error saving to Google Drive: " + err.message);
  });
};
