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

const pool = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
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

module.exports = pool; // Optional: export pool if used in other files

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/drive', driveRoutes);

app.use(session({
  secret: process.env.SESSION_SECRET,
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

app.get('/logout', (req, res, next) => {
  const accessToken = req.user?.accessToken;

  // Optionally revoke token
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


app.listen(PORT, () => {
  console.log(`🔧 Server running at http://localhost:${PORT}`);
});
