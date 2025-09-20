require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const { createBrackets, calculatePrizePool } = require('./bracket');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

const dataPath = path.join(__dirname, 'data/data.json');
const readData = () => JSON.parse(fs.readFileSync(dataPath));
const writeData = (data) => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// --- Redirect root to login ---
app.get('/', (req, res) => res.redirect('/login'));

// --- Admin Registration ---
app.get('/admin/register', (req, res) => res.render('admin-register'));

app.post('/admin/register', async (req, res) => {
  const { name, lane, password, average, secret } = req.body;
  const adminSecret = process.env.ADMIN_SECRET;

  if (secret !== adminSecret) return res.send('Invalid admin secret');
  if (!name || !lane || !password || !average) return res.send('All fields required');

  const data = readData();
  const existing = data.registrations.find(u => u.name === name && u.lane === Number(lane));
  if (existing) return res.send('User with same name and lane exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const newAdmin = {
    id: uuidv4(),
    name,
    lane: Number(lane),
    passwordHash,
    average: Number(average),
    approved: true,
    games: [],
    scoresLocked: false,
    isAdmin: true
  };

  data.registrations.push(newAdmin);
  writeData(data);
  res.send('Admin registered successfully. You can now login.');
});

// --- Registration ---
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
  const { name, lane, password, average } = req.body;
  if (!name || !lane || !password || !average) return res.send('All fields required');

  const data = readData();
  const existing = data.registrations.find(u => u.name === name && u.lane === Number(lane));
  if (existing) return res.send('User with same name and lane exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    name,
    lane: Number(lane),
    passwordHash,
    average: Number(average),
    approved: false,
    games: [],
    scoresLocked: false
  };

  data.registrations.push(newUser);
  writeData(data);
  res.redirect('/login');
});

// --- Login ---
app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
  const { name, lane, password } = req.body;
  const data = readData();
  const user = data.registrations.find(u => u.name === name && u.lane === Number(lane));
  if (!user) return res.send('User not found, please register first');

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.send('Invalid password');

  req.session.userId = user.id;
  res.redirect('/dashboard');
});

// --- Dashboard ---
app.get('/dashboard', (req, res) => {
  const data = readData();
  const user = data.registrations.find(u => u.id === req.session.userId);
  if (!user) return res.redirect('/login');

  const brackets = data.brackets || [];
  res.render('dashboard', { user, brackets, data });
});

// --- Admin approve buy-ins ---
app.post('/admin/approve/:userId', (req, res) => {
  const data = readData();
  const user = data.registrations.find(u => u.id === req.params.userId);
  if (!user) return res.send('User not found');

  user.approved = true;
  writeData(data);

  // Update brackets
  updateBrackets();

  res.redirect('/dashboard');
});

// --- Update Brackets ---
function updateBrackets() {
  const data = readData();
  const buyIn = Number(process.env.BUY_IN || 5);
  const maxBowlers = Number(process.env.MAX_BOWLERS || 8);

  data.brackets = createBrackets(data.registrations, maxBowlers, buyIn);
  writeData(data);
}

// --- Logout ---
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));