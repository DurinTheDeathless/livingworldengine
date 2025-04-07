const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const driveRoutes = require('./routes/drive');
require('dotenv').config();
require('./config/passport-config');

const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// 🟢 PostgreSQL Setup
const pool = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('❌ Error executing query', err.stack);
    }
    console.log("✅ Connected to PostgreSQL:", result.rows);
  });
});
module.exports = pool;

// 🔧 Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use('/drive', driveRoutes);


// 🗃 Session Store
const pgSession = require('connect-pg-simple')(session);
app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: false // change to true in production with HTTPS
  }
}));

// 🔐 Auth Setup
app.use(passport.initialize());
app.use(passport.session());

// 🌐 Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/drive', driveRoutes); // ✅ Only mount once

// 🏠 Root Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔁 Google OAuth Callback
app.get('/auth/google/callback',
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

// 🚪 Logout
app.get('/logout', (req, res, next) => {
  const accessToken = req.user?.accessToken;

  if (accessToken) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).catch(err => {
      console.error("Error revoking token:", err);
    });
  }

  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`🔧 Server running at http://localhost:${PORT}`);
});
