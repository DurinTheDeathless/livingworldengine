// routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive'
  ],
  prompt: 'consent', // ensures Google asks for permissions again
  accessType: 'offline',
  responseType: 'code'

}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    const accessToken = req.user.accessToken;

    res.send(`
      <script>
        sessionStorage.setItem("user", JSON.stringify({ accessToken: "${accessToken}" }));
        window.location.href = "/app.html";
      </script>
    `);
  }
);

module.exports = router;
