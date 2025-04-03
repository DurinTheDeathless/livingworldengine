
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

router.post('/load', async (req, res) => {
  const { fileName, accessToken } = req.body;

  if (!fileName || !accessToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const drive = getDriveClient(accessToken);

    const list = await drive.files.list({
      q: `name='${fileName}' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (list.data.files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileId = list.data.files[0].id;
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' });

    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error('Drive load error:', err);
    res.status(500).json({ error: 'Failed to load from Drive' });
  }
});


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

router.post('/upload', upload.single('file'), async (req, res) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const file = req.file;
  const fileName = req.body.filename;

  if (!accessToken || !file || !fileName) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const drive = getDriveClient(accessToken);
    const fileMetadata = { name: fileName };
    const media = {
      mimeType: 'application/json',
      body: Buffer.from(file.buffer),
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
