window.markDirty = function () {
  const statusEl = document.getElementById("saveStatus");
  if (statusEl) {
    statusEl.textContent = "Unsaved changes...";
    statusEl.style.color = "orange";
  }
};

window.saveToDrive = function (worldData, fileName) {
  const token = sessionStorage.getItem("user");
  if (!token) return alert("You must be logged in to use Google Drive save.");
  const accessToken = JSON.parse(token).accessToken;

  const jsonString = JSON.stringify(worldData);
  const sizeInMB = new Blob([jsonString]).size / (1024 * 1024);

  if (sizeInMB > 3) {
    return alert("World file exceeds 3MB limit. Please reduce map size or content.");
  }

  console.log("Saving to Drive:", fileName, "Size:", jsonString.length, "bytes");

  return fetch("/drive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      fileContent: worldData,
      accessToken
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.fileId) {
      worldData.fileId = data.fileId;
      sessionStorage.setItem("currentWorld", JSON.stringify(worldData));
      const statusEl = document.getElementById("saveStatus");
      if (statusEl) {
        statusEl.textContent = `✅ Saved to Google Drive as ${fileName}`;
        statusEl.style.color = "lightgreen";
        setTimeout(() => (statusEl.textContent = ""), 3000);
      }
    } else {
      console.warn("⚠️ Drive save failed:", data.message || data);
      const statusEl = document.getElementById("saveStatus");
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
