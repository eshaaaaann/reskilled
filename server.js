const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('⚠  JWT_SECRET not set - using an insecure dev secret. Set it before deploying.');

const COURSES = [
  "Essential Classroom Management Strategies",
  "Classroom Management Tips",
  "Lesson Planning",
  "Assessment Methods",
  "KWL Charts",
  "What to Do on the First Day of School",
  "Out-of-the-Box Icebreaker Ideas",
  "How to Prepare for a Demo Lesson",
  "Time Management",
  "Task-Based Lesson Tips"
];

const QUIZ = require('./quizzes');
const PASS = 60, WATCH = 0.8;   // pass mark (%) and share of the video that must be watched

const db = new Database(path.join(__dirname, 'reskilled.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    school TEXT, level TEXT, pass TEXT NOT NULL, joined TEXT DEFAULT CURRENT_DATE);
  CREATE TABLE IF NOT EXISTS enrollments(
    user_id INTEGER NOT NULL, course TEXT NOT NULL, done INTEGER DEFAULT 0,
    date TEXT DEFAULT CURRENT_DATE, cert_id TEXT UNIQUE, PRIMARY KEY(user_id, course));
  CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY, type TEXT, name TEXT, email TEXT, msg TEXT, date TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// Add progress columns to older databases (ignored if they already exist)
for (const col of ['watched INTEGER DEFAULT 0', 'duration INTEGER DEFAULT 0', 'best_score INTEGER DEFAULT -1'])
  try { db.exec('ALTER TABLE enrollments ADD COLUMN ' + col); } catch {}

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isEmail = e => /^\S+@\S+\.\S+$/.test(e || '');
const token = id => jwt.sign({ uid: id }, SECRET, { expiresIn: '7d' });

// Very small in-memory login rate limiter (10 tries / 15 min / IP)
const tries = new Map();
function limiter(req, res, next) {
  const now = Date.now(), k = req.ip, t = (tries.get(k) || []).filter(x => now - x < 15 * 60 * 1000);
  if (t.length >= 10) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  t.push(now); tries.set(k, t); next();
}
function auth(req, res, next) {
  try { req.uid = jwt.verify((req.headers.authorization || '').slice(7), SECRET).uid; next(); }
  catch { res.status(401).json({ error: 'Please login first.' }); }
}
const publicUser = u => ({ name: u.name, email: u.email, school: u.school, level: u.level, joined: u.joined });

// ---- Auth ----
app.post('/api/register', limiter, (req, res) => {
  const { name, email, school, level, password } = req.body || {};
  if (!name || !school || !isEmail(email)) return res.status(400).json({ error: 'Please fill in all fields correctly.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const r = db.prepare('INSERT INTO users(name,email,school,level,pass) VALUES(?,?,?,?,?)')
      .run(name.trim().slice(0, 80), email.trim().toLowerCase(), school.trim().slice(0, 120), String(level).slice(0, 30), bcrypt.hashSync(password, 10));
    res.json({ token: token(r.lastInsertRowid) });
  } catch { res.status(409).json({ error: 'This email is already registered. Please login.' }); }
});

app.post('/api/login', limiter, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body?.email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.pass))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ token: token(u.id) });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.uid);
  if (!u) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: publicUser(u) });
});

// ---- Courses ----
app.get('/api/enrollments', auth, (req, res) =>
  res.json(db.prepare('SELECT course, done, date, cert_id, watched, duration, best_score FROM enrollments WHERE user_id=?').all(req.uid)));

app.post('/api/enroll', auth, (req, res) => {
  const { course } = req.body || {};
  if (!COURSES.includes(course)) return res.status(400).json({ error: 'Unknown course.' });
  db.prepare('INSERT OR IGNORE INTO enrollments(user_id,course) VALUES(?,?)').run(req.uid, course);
  res.json({ ok: true });
});

// A course is completed when 80% of the video is watched AND the assessment is passed (60%+)
function tryComplete(uid, course) {
  const e = db.prepare('SELECT * FROM enrollments WHERE user_id=? AND course=?').get(uid, course);
  if (!e) return false;
  if (e.done) return true;
  if (e.duration > 0 && e.watched / e.duration >= WATCH && e.best_score >= PASS) {
    db.prepare('UPDATE enrollments SET done=1, date=DATE(), cert_id=? WHERE user_id=? AND course=?')
      .run('RS-' + crypto.randomBytes(4).toString('hex').toUpperCase(), uid, course);
    return true;
  }
  return false;
}
const enrolled = (uid, c) => db.prepare('SELECT 1 FROM enrollments WHERE user_id=? AND course=?').get(uid, c);

app.post('/api/progress', auth, (req, res) => {
  const { course } = req.body || {}, d = Math.floor(+req.body?.duration), w = Math.floor(+req.body?.watched);
  if (!COURSES.includes(course) || !(d > 0 && d < 36000) || !(w >= 0)) return res.status(400).json({ error: 'Invalid progress.' });
  const r = db.prepare('UPDATE enrollments SET watched=MAX(watched, ?), duration=? WHERE user_id=? AND course=?').run(Math.min(w, d), d, req.uid, course);
  if (!r.changes) return res.status(400).json({ error: 'Enroll first.' });
  res.json({ ok: true, completed: tryComplete(req.uid, course) });
});

app.get('/api/quiz/:course', auth, (req, res) => {
  const bank = QUIZ[req.params.course];
  if (!bank) return res.status(404).json({ error: 'No assessment for this course.' });
  if (!enrolled(req.uid, req.params.course)) return res.status(403).json({ error: 'Enroll first.' });
  res.json({ questions: bank.map(([q, o]) => ({ q, o })) });   // answers are never sent to the browser
});

app.post('/api/quiz/:course', auth, (req, res) => {
  const c = req.params.course, bank = QUIZ[c], a = req.body && req.body.answers;
  if (!bank || !enrolled(req.uid, c)) return res.status(403).json({ error: 'Enroll first.' });
  if (!Array.isArray(a) || a.length !== bank.length) return res.status(400).json({ error: 'Answer every question.' });
  const correct = bank.map(b => b[2]), score = correct.filter((x, i) => a[i] === x).length;
  const pct = Math.round(100 * score / bank.length);
  db.prepare('UPDATE enrollments SET best_score=MAX(best_score, ?) WHERE user_id=? AND course=?').run(pct, req.uid, c);
  res.json({ score, pct, passed: pct >= PASS, correct, completed: tryComplete(req.uid, c) });
});

// ---- Contact / feedback ----
app.post('/api/messages', (req, res) => {
  const { type, name, email, msg } = req.body || {};
  if (!name || !isEmail(email) || !msg) return res.status(400).json({ error: 'Name, valid email and message are required.' });
  db.prepare('INSERT INTO messages(type,name,email,msg) VALUES(?,?,?,?)')
    .run(type === 'Feedback' ? 'Feedback' : 'Contact', name.slice(0, 80), email.slice(0, 120), msg.slice(0, 2000));
  res.json({ ok: true });
});

// ---- Certificate verification ----
function lookup(id) {
  return db.prepare(`SELECT u.name, e.course, e.date FROM enrollments e JOIN users u ON u.id=e.user_id
                     WHERE e.cert_id=? AND e.done=1`).get(String(id).toUpperCase());
}
app.get('/api/verify/:id', (req, res) => {
  const c = lookup(req.params.id);
  res.json(c ? { valid: true, ...c } : { valid: false });
});
app.get('/verify/:id', (req, res) => {
  const c = lookup(req.params.id), id = esc(req.params.id.toUpperCase());
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify Certificate - ReSkilled</title><style>body{font-family:Segoe UI,sans-serif;background:#f8f9fa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1rem}
.box{background:#fff;padding:2.5rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:480px;text-align:center}
h1{color:${c ? '#2e7d32' : '#e74c3c'}}a{color:#3498db}</style></head><body><div class="box">
${c ? `<h1>✅ Valid Certificate</h1><p><b>${esc(c.name)}</b> completed</p><h2>${esc(c.course)}</h2><p>on ${esc(c.date)}</p><small>ID: ${id}</small>`
    : `<h1>❌ Not Found</h1><p>No certificate with ID <b>${id}</b> exists.</p>`}
<p style="margin-top:1.5rem"><a href="/">← Back to ReSkilled</a></p></div></body></html>`);
});

app.listen(PORT, () => console.log(`ReSkilled running at http://localhost:${PORT}`));
