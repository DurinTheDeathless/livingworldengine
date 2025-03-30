const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const driveRoutes = require('./routes/drive');

require('dotenv').config();
require('./routes/passport-config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/drive', driveRoutes);

app.use(session({
  secret: 'livingworldsecret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/user', userRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
    prompt: 'select_account consent',
    accessType: 'offline',
    responseType: 'code',
    include_granted_scopes: false
  })
);



// Google OAuth callback route
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    const accessToken = req.user.accessToken;

    // Store token on frontend
    res.send(`
      <script>
        sessionStorage.setItem("user", JSON.stringify({ accessToken: "${accessToken}" }));
        window.location.href = "/app.html";
      </script>
    `);
  }
);

app.get('/logout', async (req, res) => {
  const accessToken = req.user?.accessToken;

  if (accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    } catch (err) {
      console.error("Error revoking token:", err);
    }
  }

  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid', { path: '/' });
      res.redirect('/');
    });
  });
});


app.listen(PORT, () => {
  console.log(`🔧 Server running at http://localhost:${PORT}`);
});
