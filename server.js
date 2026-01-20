require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { createBrackets, calculatePrizePool } = require('./bracket');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration with secure secret
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET not set in environment. Using random secret (sessions will not persist across restarts).');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Rate limiting for auth routes
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function rateLimiter(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: now };
  
  if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return next();
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    return res.status(429).send('Too many login attempts. Please try again later.');
  }
  
  attempts.count++;
  loginAttempts.set(key, attempts);
  next();
}

// Data file handling with async I/O
const dataPath = path.join(__dirname, 'data/data.json');

async function readData() {
  try {
    const content = await fs.readFile(dataPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const initialData = { registrations: [], brackets: [] };
      await writeData(initialData);
      return initialData;
    }
    throw err;
  }
}

async function writeData(data) {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  const data = await readData();
  const user = data.registrations.find(u => u.id === req.session.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).send('Admin access required');
  }
  next();
}

// Input validation helpers
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 100);
}

function validateNumber(val, min, max) {
  const num = Number(val);
  if (isNaN(num) || num < min || num > max) return null;
  return num;
}

// --- Redirect root to login ---
app.get('/', (req, res) => res.redirect('/login'));

// --- Admin Registration ---
app.get('/admin/register', (req, res) => res.render('admin-register'));

app.post('/admin/register', rateLimiter, async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const lane = validateNumber(req.body.lane, 1, 100);
    const password = req.body.password;
    const average = validateNumber(req.body.average, 0, 300);
    const secret = req.body.secret;
    
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return res.status(500).send('Server configuration error');
    }

    // Timing-safe comparison to prevent timing attacks
    if (!secret || secret.length !== adminSecret.length || 
        !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret))) {
      return res.status(403).send('Invalid admin secret');
    }
    
    if (!name || !lane || !password || average === null) {
      return res.status(400).send('All fields required with valid values');
    }
    
    if (password.length < 8) {
      return res.status(400).send('Password must be at least 8 characters');
    }

    const data = await readData();
    const existing = data.registrations.find(u => u.name === name && u.lane === lane);
    if (existing) {
      return res.status(409).send('User with same name and lane exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newAdmin = {
      id: uuidv4(),
      name,
      lane,
      passwordHash,
      average,
      approved: true,
      games: [],
      scoresLocked: false,
      isAdmin: true
    };

    data.registrations.push(newAdmin);
    await writeData(data);
    res.send('Admin registered successfully. You can now login.');
  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).send('Registration failed');
  }
});

// --- Registration ---
app.get('/register', (req, res) => res.render('register'));

app.post('/register', rateLimiter, async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const lane = validateNumber(req.body.lane, 1, 100);
    const password = req.body.password;
    const average = validateNumber(req.body.average, 0, 300);
    
    if (!name || !lane || !password || average === null) {
      return res.status(400).send('All fields required with valid values');
    }
    
    if (password.length < 8) {
      return res.status(400).send('Password must be at least 8 characters');
    }

    const data = await readData();
    const existing = data.registrations.find(u => u.name === name && u.lane === lane);
    if (existing) {
      return res.status(409).send('User with same name and lane exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: uuidv4(),
      name,
      lane,
      passwordHash,
      average,
      approved: false,
      games: [],
      scoresLocked: false
    };

    data.registrations.push(newUser);
    await writeData(data);
    res.redirect('/login');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Registration failed');
  }
});

// --- Login ---
app.get('/login', (req, res) => res.render('login'));

app.post('/login', rateLimiter, async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const lane = validateNumber(req.body.lane, 1, 100);
    const password = req.body.password;
    
    if (!name || !lane || !password) {
      return res.status(400).send('All fields required');
    }
    
    const data = await readData();
    const user = data.registrations.find(u => u.name === name && u.lane === lane);
    
    // Use constant-time comparison even when user not found to prevent enumeration
    const dummyHash = '$2a$12$dummy.hash.for.timing.attack.prevention';
    const hashToCompare = user ? user.passwordHash : dummyHash;
    const match = await bcrypt.compare(password, hashToCompare);
    
    if (!user || !match) {
      return res.status(401).send('Invalid credentials');
    }

    req.session.userId = user.id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Login failed');
  }
});

// --- Dashboard ---
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const user = data.registrations.find(u => u.id === req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }

    const brackets = data.brackets || [];
    res.render('dashboard', { user, brackets, data });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Failed to load dashboard');
  }
});

// --- Admin approve buy-ins ---
app.post('/admin/approve/:userId', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const user = data.registrations.find(u => u.id === req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.approved = true;
    
    // Update brackets
    const buyIn = Number(process.env.BUY_IN || 5);
    const maxBowlers = Number(process.env.MAX_BOWLERS || 8);
    data.brackets = createBrackets(data.registrations, maxBowlers, buyIn);
    
    await writeData(data);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).send('Approval failed');
  }
});

// --- Logout ---
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/login');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal server error');
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
