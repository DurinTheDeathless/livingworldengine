
let currentWorld = null;
let currentFile = null;

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
  document.getElementById('worldNameHeader').textContent = name;
  document.getElementById('activeWorld').style.display = 'block';
  displayWorld();
}

function loadUserWorlds() {
  fetch('/user/worlds')
    .then(res => res.json())
    .then(files => {
      const ul = document.getElementById('userWorlds');
      ul.innerHTML = '';
      files.forEach(filename => {
        const li = document.createElement('li');
        li.innerHTML = `\${filename} <button onclick="loadWorldFromServer('\${filename}')">Load</button>\`;
        ul.appendChild(li);
      });
    })
    .catch(() => alert('Login required to access saved worlds.'));
}


function displayWorld() {
  document.getElementById("worldOutput").textContent = JSON.stringify(currentWorld, null, 2);
}

function saveWorldLocally() {
  const blob = new Blob([JSON.stringify(currentWorld, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentWorld.worldName.replace(/\s+/g, '_') + ".json";
  a.click();
}

function saveWorldToServer() {
  if (!currentFile) return;
  fetch('/user/worlds/' + currentFile, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentWorld)
  }).then(res => {
    if (res.ok) alert('Saved!');
    else alert('Failed to save.');
  });
}

function loadWorldFromServer(filename) {
  fetch('/user/worlds/' + filename)
    .then(res => res.json())
    .then(data => {
      currentWorld = data;
      currentFile = filename;
      document.getElementById('worldNameHeader').textContent = currentWorld.worldName;
      document.getElementById('activeWorld').style.display = 'block';
      displayWorld();
    });
}

function deleteWorld() {
  if (!currentFile) return;
  if (!confirm('Delete this world?')) return;
  fetch('/user/worlds/' + currentFile, { method: 'DELETE' })
    .then(res => res.json())
    .then(() => {
      currentWorld = null;
      currentFile = null;
      document.getElementById('activeWorld').style.display = 'none';
      loadUserWorlds();
    });
}

window.onload = loadUserWorlds;
