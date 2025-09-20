const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { createBowlerPDF, calculatePrizePool, generateWeeklySnapshot } = require('./utils/snapshot');
const { createBrackets } = require('./bracket');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const MAX_BOWLERS = Number(process.env.MAX_BOWLERS) || 8;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let data = JSON.parse(fs.readFileSync(DATA_FILE));
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// ----- Routes -----

app.get('/', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));
app.post('/register', (req, res) => {
  const { name, average } = req.body;
  const id = uuidv4();
  data.registrations.push({ id, name, average: Number(average), approved: false, games: [], scoresLocked: false });
  saveData();
  res.redirect('/');
});

app.get('/dashboard/:userId', (req, res) => {
  const user = data.registrations.find(r => r.id === req.params.userId);
  res.render('dashboard', { user, brackets: data.brackets, registrations: data.registrations });
});

app.post('/submit-score', (req, res) => {
  const { bowlerId, bracketId, scores } = req.body;
  const bowler = data.registrations.find(r => r.id === bowlerId);
  const bracket = data.brackets.find(b => b.id === bracketId);
  if (!bowler || !bracket) return res.status(404).send('Not found');
  if (bowler.scoresLocked) return res.status(403).send('Scores locked');
  bowler.games = scores.map((s, i) => ({ game: i+1, score: Number(s) }));
  bowler.scoresLocked = true;
  saveData();
  res.send({ success: true });
});

app.post('/approve-buys/:bowlerId', (req, res) => {
  const bowler = data.registrations.find(r => r.id === req.params.bowlerId);
  if (!bowler) return res.status(404).send('Bowler not found');
  bowler.approved = true;
  saveData();
  res.send({ success: true });
});

app.post('/close-week', (req, res) => {
  const allClosed = data.brackets.every(b => b.status === 'closed');
  if (!allClosed) return res.status(400).send('Not all brackets closed');
  const snapshot = generateWeeklySnapshot(data.brackets, data.registrations);
  const filePath = path.join(__dirname, 'data', `snapshot_week_${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  const pdfPath = createBowlerPDF(snapshot, 'admin');
  res.send({ success: true, file: pdfPath });
});

app.get('/download-my-bracket/:bowlerId', (req, res) => {
  const bowlerId = req.params.bowlerId;
  const bracket = data.brackets.find(b => b.bowlers.includes(bowlerId));
  const bowler = data.registrations.find(r => r.id === bowlerId);
  if (!bracket || !bowler) return res.status(404).send('Bracket or bowler not found');
  const snapshot = {
    bracketId: bracket.id,
    bowler: {
      id: bowler.id,
      name: bowler.name,
      games: bowler.games || [],
      previousGames: bowler.previousGames || [],
      scoresLocked: bowler.scoresLocked
    },
    prizePool: calculatePrizePool(bracket, bracket.buyIn)
  };
  const filePath = path.join(__dirname, 'data', `bowler_${bowlerId}_snapshot.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  const pdfPath = createBowlerPDF(snapshot, bowlerId);
  res.download(pdfPath);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
