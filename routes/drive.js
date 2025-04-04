const express = require('express');
const multer = require('multer');
const upload = multer();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.CALLBACK_URL;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

function getDriveClient(accessToken) {
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function ensureAppFolder(drive) {
  const folderName = "LivingWorldEngine";

  const folderList = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (folderList.data.files.length > 0) {
    return folderList.data.files[0].id;
  }

  const createdFolder = await drive.files.create({
    resource: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return createdFolder.data.id;
}

async function ensureIndexFile(drive, folderId) {
  const result = await drive.files.list({
    q: `'${folderId}' in parents and name='index.json' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (result.data.files.length > 0) {
    return result.data.files[0].id;
  }

  const content = JSON.stringify({ worlds: [] }, null, 2);
  const buffer = Buffer.from(content);

  const file = await drive.files.create({
    resource: {
      name: 'index.json',
      parents: [folderId],
    },
    media: {
      mimeType: 'application/json',
      body: buffer,
    },
    fields: 'id',
  });

  return file.data.id;
}

async function listWorldFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/json' and trashed=false and name != 'index.json'`,
    fields: 'files(id, name, createdTime)',
  });

  return res.data.files;
}

async function uploadWorld(drive, folderId, worldData) {
  const fileMetadata = {
    name: worldData.name + ".json",
    parents: [folderId],
  };

  const media = {
    mimeType: 'application/json',
    body: Buffer.from(JSON.stringify(worldData, null, 2)),
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id',
  });

  return file.data.id;
}


router.post('/load', async (req, res) => {
  const { fileName, accessToken } = req.body;
  try {
    const drive = getDriveClient(accessToken);
    const list = await drive.files.list({
      q: `name='${fileName}' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (list.data.files.length === 0) return res.status(404).json({ error: 'File not found' });

    const fileId = list.data.files[0].id;
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load from Drive' });
  }
});

router.post('/list', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

  try {
    const drive = getDriveClient(accessToken);
    const folderId = await ensureAppFolder(drive);
    await ensureIndexFile(drive, folderId); // make sure index.json exists

    const files = await listWorldFiles(drive, folderId);
    res.json({ success: true, files });
  } catch (err) {
    console.error("Drive list error:", err);
    res.status(500).json({ error: 'Drive listing failed' });
  }
});


  

router.post('/upload', upload.single('file'), async (req, res) => {
  console.log("🧪 Headers:", req.headers);
  console.log("🧪 Body:", req.body);
  console.log("🧪 File:", req.file);
    const accessToken = req.headers.authorization?.split(' ')[1];
  const file = req.file;
  const fileName = req.body.filename;

  if (!accessToken || !file || !fileName) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const drive = getDriveClient(accessToken);
    const fileMetadata = { name: fileName };
    const { Readable } = require('stream');

    const media = {
      mimeType: 'application/json',
      body: Readable.from(file.buffer)
    };
    

    const uploaded = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id',
    });

    res.json({ success: true, fileId: uploaded.data.id });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
