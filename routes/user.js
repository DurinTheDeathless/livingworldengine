const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Middleware to check if user is authenticated
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Get user's saved worlds
router.get('/worlds', ensureAuth, (req, res) => {
  const userId = req.user.id;
  const userFolder = path.join(__dirname, '../saves', userId);
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
    return res.json([]);
  }

  const files = fs.readdirSync(userFolder).filter(f => f.endsWith('.json'));
  res.json(files);
});

// Get contents of a saved world
router.get('/worlds/:filename', ensureAuth, (req, res) => {
  const filePath = path.join(__dirname, '../saves', req.user.id, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const data = fs.readFileSync(filePath, 'utf-8');
  res.json(JSON.parse(data));
});

// Save a world
router.post('/worlds/:filename', ensureAuth, (req, res) => {
  const userFolder = path.join(__dirname, '../saves', req.user.id);
  if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

  const filePath = path.join(userFolder, req.params.filename);
  fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
  res.json({ status: 'saved' });
});

// Delete a world
router.delete('/worlds/:filename', ensureAuth, (req, res) => {
  const filePath = path.join(__dirname, '../saves', req.user.id, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ status: 'deleted' });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

module.exports = router;