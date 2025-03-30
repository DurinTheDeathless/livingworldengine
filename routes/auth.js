const express = require('express');
const passport = require('passport');
const router = express.Router();

// Start login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/app.html');
  }
);

module.exports = router;
