const express = require('express');
const multer = require('multer');
const upload = multer();
const { google } = require('googleapis');
const { Readable } = require('stream');
const router = express.Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.CALLBACK_URL;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

function getDriveClient(accessToken) {
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function ensureAppFolder(drive) {
  const folderName = "LivingWorldEngine";
  const existing = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (existing.data.files.length > 0) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    resource: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return created.data.id;
}

// === Route: Load World File ===
router.post('/load', async (req, res) => {
  const { fileName, accessToken } = req.body;
  if (!accessToken || !fileName) {
    return res.status(400).json({ error: 'Missing credentials or file name' });
  }

  try {
    const drive = getDriveClient(accessToken);
    const result = await drive.files.list({
      q: `name='${fileName}' and trashed=false`,
      fields: 'files(id)',
    });

    if (result.data.files.length === 0) return res.status(404).json({ error: 'File not found' });

    const fileId = result.data.files[0].id;
    const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' });

    res.json(file.data);
  } catch (err) {
    console.error("Load failed:", err);
    res.status(500).json({ error: 'Failed to load from Drive' });
  }
});

// === Route: Save World File ===
router.post("/save", async (req, res) => {
  const { fileName, fileContent, accessToken } = req.body;

  if (!accessToken || !fileName || !fileContent) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }

  try {
    const drive = getDriveClient(accessToken);
    const folderId = await ensureAppFolder(drive);

    const media = {
      mimeType: "application/json",
      body: JSON.stringify(fileContent, null, 2),
    };
    

    const existing = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    let fileId;
    if (existing.data.files.length > 0) {
      fileId = existing.data.files[0].id;
      await drive.files.update({ fileId, media });
    } else {
      const created = await drive.files.create({
        resource: { name: fileName, parents: [folderId] },
        media,
        fields: "id",
      });
      fileId = created.data.id;
    }

    res.json({ success: true, fileId });
  } catch (err) {
    console.error("❌ Drive save error:", err);
    res.status(500).json({ success: false, message: "Save failed" });
  }
});

// === Route: Upload Map Image (separate from world file) ===
router.post("/upload-image", upload.single("map"), async (req, res) => {
  const accessToken = req.headers.authorization?.split(" ")[1];
  const fileName = req.body.fileName;
  const file = req.file;

  if (!accessToken || !file || !fileName) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }

  try {
    const drive = getDriveClient(accessToken);
    const folderId = await ensureAppFolder(drive);
    const bufferStream = Readable.from(file.buffer);

    const uploaded = await drive.files.create({
      resource: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype,
        body: bufferStream,
      },
      fields: "id",
    });

    res.json({ success: true, fileId: uploaded.data.id });
  } catch (err) {
    console.error("Map upload error:", err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// === Route: List World Files ===
router.post('/list', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

  try {
    const drive = getDriveClient(accessToken);
    const folderId = await ensureAppFolder(drive);

    const result = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/json' and trashed=false and name != 'index.json'`,
      fields: 'files(id, name, createdTime)',
    });

    res.json({ success: true, files: result.data.files });
  } catch (err) {
    console.error("Drive list error:", err);
    res.status(500).json({ error: 'Drive listing failed' });
  }
});

// === Route: Upload World File from .json upload ===
router.post('/upload', upload.single('file'), async (req, res) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const file = req.file;
  const fileName = req.body.filename;

  if (!accessToken || !file || !fileName) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const drive = getDriveClient(accessToken);
    const folderId = await ensureAppFolder(drive);

    const bufferStream = Readable.from(file.buffer);
    const uploaded = await drive.files.create({
      resource: { name: fileName, parents: [folderId] },
      media: { mimeType: 'application/json', body: bufferStream },
      fields: 'id',
    });

    res.json({ success: true, fileId: uploaded.data.id });
  } catch (err) {
    console.error('Error uploading world file:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
