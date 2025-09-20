import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import session from "express-session";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { createBowlers, runBracket, calculatePrize } from "./bracket.js";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: true
}));

// Persistent Data
const DATA_FILE = "./data.json";
let registrations = [];
let users = [];
let brackets = [];

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const json = JSON.parse(fs.readFileSync(DATA_FILE));
    registrations = json.registrations || [];
    users = json.users || [];
    brackets = json.brackets || [];
  }
}
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ registrations, users, brackets }, null, 2));
}
loadData();

// Handicap
const HANDICAP_BASE = 220;
const HANDICAP_PCT = 0.9;

// Auth
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}
function requireAdmin(req, res, next) {
  const user = users.find(u => u.id === req.session.userId);
  if (!user || !user.admin) return res.send("Forbidden");
  next();
}

// Signup/Login
app.get("/signup", (req,res)=>res.render("signup"));
app.post("/signup", async (req,res)=>{
  const { username, password, name, average, lane } = req.body;
  if (users.find(u=>u.username===username)) return res.send("Username exists");
  const passwordHash = await bcrypt.hash(password,10);
  const bowlerId = uuidv4();
  registrations.push({ id: bowlerId, name, average: parseInt(average), lane: parseInt(lane) });
  users.push({ id: uuidv4(), username, passwordHash, bowlerId, admin: false });
  saveData();
  res.redirect("/login");
});

app.get("/login",(req,res)=>res.render("login"));
app.post("/login",async(req,res)=>{
  const { username, password } = req.body;
  const user = users.find(u=>u.username===username);
  if(!user) return res.send("Invalid credentials");
  const valid = await bcrypt.compare(password,user.passwordHash);
  if(!valid) return res.send("Invalid credentials");
  req.session.userId = user.id;
  res.redirect("/dashboard");
});
app.get("/logout",(req,res)=>{ req.session.destroy(); res.redirect("/login") });

// Bowler Dashboard
app.get("/dashboard", requireLogin, (req,res)=>{
  const user = users.find(u=>u.id===req.session.userId);
  const bowler = registrations.find(b=>b.id===user.bowlerId);
  const myBrackets = brackets.filter(b => b.bowlers.includes(bowler.id));
  res.render("dashboard", { bowler, myBrackets });
});

// Bowler requests join bracket
app.post("/bracket/join", requireLogin, (req,res)=>{
  const { bracketId } = req.body;
  const user = users.find(u=>u.id===req.session.userId);
  const bracket = brackets.find(b=>b.id===bracketId);
  if(!bracket) return res.send("Bracket not found");
  if(bracket.status!=="open") return res.send("Bracket closed");
  if(bracket.approvedBowlers.includes(user.bowlerId) || bracket.bowlers.includes(user.bowlerId)) return res.send("Already in bracket");
  if(bracket.bowlers.length >= 8) return res.send("Bracket is full");
  bracket.bowlers.push(user.bowlerId);
  saveData();
  res.send("Request submitted. Waiting for admin approval.");
});

// Admin view brackets
app.get("/admin", requireLogin, requireAdmin, (req,res)=>{
  const adminBrackets = brackets.map(b => {
    const prizes = calculatePrize(b);
    return {...b, prizes};
  });
  res.render("adminBracket", { brackets: adminBrackets, registrations });
});

// Admin approve bowler
app.post("/admin/bracket/approve", requireLogin, requireAdmin, (req,res)=>{
  const { bracketId, bowlerId } = req.body;
  const bracket = brackets.find(b=>b.id===bracketId);
  if(!bracket) return res.status(404).send("Bracket not found");
  if(bracket.approvedBowlers.length >= 8) return res.send("Bracket full");
  if(!bracket.approvedBowlers.includes(bowlerId)) bracket.approvedBowlers.push(bowlerId);
  saveData();
  res.json({ success:true });
});

// Close bracket and generate results
app.get("/bracket/:id/close", requireLogin, requireAdmin, (req,res)=>{
  const bracket = brackets.find(b=>b.id===req.params.id);
  if(!bracket) return res.send("Bracket not found");
  if(bracket.approvedBowlers.length<2) return res.send("Need at least 2 approved bowlers");
  bracket.status="closed";

  const players = bracket.approvedBowlers.map(id=>{
    const b = registrations.find(r=>r.id===id);
    const scores = bracket.gameScores[id] || [];
    const handicap = Math.max(0,(HANDICAP_BASE-b.average)*HANDICAP_PCT);
    const netScores = scores.map(s=>s.score + handicap);
    return {...b, scores, handicap, netScores};
  });

  const results = runBracket(players);
  bracket.results = results;
  saveData();
  res.render("results", { results });
});

app.listen(3000,()=>console.log("Bowling app running on port 3000"));
