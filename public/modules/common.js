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
    

console.log("Saving to Drive:", currentFileName, "Size:", JSON.stringify(currentWorld).length, "bytes");

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
  if (data.success) {
    console.log("✅ Drive save confirmed.");
    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Saved to Google Drive!";
      setTimeout(() => saveStatus.textContent = "", 3000);
    }
  } else {
    console.warn("⚠️ Drive save failed:", data.message || data);
    alert("Failed to save to Google Drive.");
  }
})
.catch(err => {
  console.error("❌ Drive save error:", err);
  alert("Error saving to Google Drive: " + err.message);
});

    
      .then(res => res.json())
      .then(data => {
        if (data.success && data.fileId) {
            world.fileId = data.fileId;
            sessionStorage.setItem("currentWorld", JSON.stringify(world));
          
            const statusEl = document.getElementById("saveStatus");
            if (statusEl) {
              statusEl.textContent = `✅ Saved to Google Drive as ${fileName}`;
              statusEl.style.color = "lightgreen";
              setTimeout(() => {
                statusEl.textContent = "";
              }, 3000);
            }
          } else {
            const statusEl = document.getElementById("saveStatus");
            if (statusEl) {
              statusEl.textContent = `❌ Failed to save.`;
              statusEl.style.color = "orange";
            }
            alert("Error saving to Google Drive.");
             }
          })

      .catch(err => {
        console.error("Drive save error:", err);
        alert("Error saving to Google Drive: " + err.message);
      });
  };
  
  window.markDirty = function () {
    const statusEl = document.getElementById("saveStatus");
    if (statusEl) {
      statusEl.textContent = "Unsaved changes...";
      statusEl.style.color = "orange";
    }
  };
  