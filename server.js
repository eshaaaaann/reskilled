const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('⚠  JWT_SECRET not set - using an insecure dev secret. Set it before deploying.');

const QUIZ = require('./quizzes');
const COURSES = Object.keys(QUIZ);
const PASS = 60, WATCH = 0.8;   // pass mark (%) and share of the video that must be watched
const LEVELS = ['Primary', 'Middle School', 'High School', 'Lecturer', 'Assistant Professor', 'Associate Professor', 'Professor'];

// ---------- Firebase / Firestore ----------
function credentials() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const f = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) { console.error('❌ Could not read the Firebase key:', e.message); process.exit(1); }
  console.error('❌ Firebase key not found. Put serviceAccountKey.json in this folder, or set the FIREBASE_SERVICE_ACCOUNT environment variable.');
  process.exit(1);
}
try { initializeApp({ credential: cert(credentials()) }); }
catch (e) { console.error('❌ Invalid Firebase key:', e.message); process.exit(1); }
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const users = db.collection('users'), certs = db.collection('certificates'), msgs = db.collection('messages');
const uidOf = email => crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
const slug = c => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const enrRef = (uid, course) => users.doc(uid).collection('enrollments').doc(slug(course));
const today = () => new Date().toISOString().slice(0, 10);
const exists = e => e && (e.code === 6 || e.code === 'already-exists');

db.collection('users').limit(1).get()
  .then(() => console.log('✅ Connected to Firestore'))
  .catch(e => console.error('⚠  Could not reach Firestore:', e.message, '\n   Check that the Firestore database is created and the key belongs to this project.'));

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
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
const publicUser = u => ({ name: u.name, email: u.email, school: u.school, level: u.level, qualifications: u.qualifications, joined: u.joined });

// ---- Auth ----
app.post('/api/register', limiter, async (req, res) => {
  const { name, email, school, level, qualifications, password } = req.body || {};
  if (!name || !school || !isEmail(email) || !qualifications || !String(qualifications).trim())
    return res.status(400).json({ error: 'Please fill in all fields correctly.' });
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Please choose a valid teaching level or designation.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const mail = String(email).trim().toLowerCase(), uid = uidOf(mail);
  try {
    await users.doc(uid).create({
      name: String(name).trim().slice(0, 80), email: mail, school: String(school).trim().slice(0, 120), level,
      qualifications: String(qualifications).trim().slice(0, 300), pass: await bcrypt.hash(String(password), 10), joined: today()
    });
  } catch (e) {
    if (exists(e)) return res.status(409).json({ error: 'This email is already registered. Please login.' });
    throw e;
  }
  res.json({ token: token(uid) });
});

app.post('/api/login', limiter, async (req, res) => {
  const snap = await users.doc(uidOf(String(req.body?.email || '').trim().toLowerCase())).get();
  const u = snap.exists && snap.data();
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.pass)))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ token: token(snap.id) });
});

app.get('/api/me', auth, async (req, res) => {
  const snap = await users.doc(req.uid).get();
  if (!snap.exists) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: publicUser(snap.data()) });
});

// ---- Courses ----
app.get('/api/enrollments', auth, async (req, res) => {
  const qs = await users.doc(req.uid).collection('enrollments').get();
  res.json(qs.docs.map(d => d.data()).sort((a, b) => (a.at || 0) - (b.at || 0)).map(e => ({
    course: e.course, done: e.done ? 1 : 0, date: e.date, cert_id: e.cert_id || null,
    watched: e.watched || 0, duration: e.duration || 0, best_score: e.best_score ?? -1
  })));
});

app.post('/api/enroll', auth, async (req, res) => {
  const { course } = req.body || {};
  if (!COURSES.includes(course)) return res.status(400).json({ error: 'Unknown course.' });
  try {
    await enrRef(req.uid, course).create({ course, done: false, date: today(), watched: 0, duration: 0, best_score: -1, at: Date.now() });
  } catch (e) { if (!exists(e)) throw e; }   // already enrolled = fine
  res.json({ ok: true });
});

// Writes an enrollment update inside a transaction. A course is completed when 80% of the video
// is watched AND the assessment is passed (60%+); then a certificate record is created.
function save(t, ref, e, patch, uid, name) {
  const n = { ...e, ...patch };
  if (!n.done && n.duration > 0 && n.watched / n.duration >= WATCH && n.best_score >= PASS) {
    const id = 'RS-' + crypto.randomBytes(4).toString('hex').toUpperCase(), date = today();
    Object.assign(patch, { done: true, date, cert_id: id });
    t.create(certs.doc(id), { name, course: n.course, date, uid });
    n.done = true;
  }
  t.update(ref, patch);
  return !!n.done;
}

app.post('/api/progress', auth, async (req, res) => {
  const { course } = req.body || {}, d = Math.floor(+req.body?.duration), w = Math.floor(+req.body?.watched);
  if (!COURSES.includes(course) || !(d > 0 && d < 36000) || !(w >= 0)) return res.status(400).json({ error: 'Invalid progress.' });
  const ref = enrRef(req.uid, course), uref = users.doc(req.uid);
  const completed = await db.runTransaction(async t => {
    const [es, us] = await Promise.all([t.get(ref), t.get(uref)]);   // all reads first
    if (!es.exists) return null;
    const e = es.data();
    return save(t, ref, e, { watched: Math.max(e.watched || 0, Math.min(w, d)), duration: d }, req.uid, us.exists ? us.data().name : '');
  });
  if (completed === null) return res.status(400).json({ error: 'Enroll first.' });
  res.json({ ok: true, completed });
});

app.get('/api/quiz/:course', auth, async (req, res) => {
  const c = req.params.course;
  if (!COURSES.includes(c)) return res.status(404).json({ error: 'No assessment for this course.' });
  if (!(await enrRef(req.uid, c).get()).exists) return res.status(403).json({ error: 'Enroll first.' });
  res.json({ questions: QUIZ[c].map(([q, o]) => ({ q, o })) });   // answers are never sent to the browser
});

app.post('/api/quiz/:course', auth, async (req, res) => {
  const c = req.params.course, a = req.body && req.body.answers;
  if (!COURSES.includes(c)) return res.status(404).json({ error: 'No assessment for this course.' });
  const bank = QUIZ[c];
  if (!Array.isArray(a) || a.length !== bank.length) return res.status(400).json({ error: 'Answer every question.' });
  const correct = bank.map(b => b[2]), score = correct.filter((x, i) => a[i] === x).length;
  const pct = Math.round(100 * score / bank.length);
  const ref = enrRef(req.uid, c), uref = users.doc(req.uid);
  const completed = await db.runTransaction(async t => {
    const [es, us] = await Promise.all([t.get(ref), t.get(uref)]);
    if (!es.exists) return null;
    const e = es.data();
    return save(t, ref, e, { best_score: Math.max(e.best_score ?? -1, pct) }, req.uid, us.exists ? us.data().name : '');
  });
  if (completed === null) return res.status(403).json({ error: 'Enroll first.' });
  res.json({ score, pct, passed: pct >= PASS, correct, completed });
});

// ---- Contact / feedback ----
app.post('/api/messages', async (req, res) => {
  const { type, name, email, msg } = req.body || {};
  if (!name || !isEmail(email) || !msg) return res.status(400).json({ error: 'Name, valid email and message are required.' });
  await msgs.add({ type: type === 'Feedback' ? 'Feedback' : 'Contact', name: String(name).slice(0, 80), email: String(email).slice(0, 120), msg: String(msg).slice(0, 2000), date: new Date().toISOString() });
  res.json({ ok: true });
});

// ---- Certificate verification ----
async function lookup(id) {
  id = String(id).toUpperCase();
  if (!/^RS-[0-9A-F]{8}$/.test(id)) return null;
  const s = await certs.doc(id).get();
  return s.exists ? s.data() : null;
}
app.get('/api/verify/:id', async (req, res) => {
  const c = await lookup(req.params.id);
  res.json(c ? { valid: true, name: c.name, course: c.course, date: c.date } : { valid: false });
});
app.get('/verify/:id', async (req, res) => {
  const c = await lookup(req.params.id), id = esc(req.params.id.toUpperCase());
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify Certificate - ReSkilled</title><style>body{font-family:Segoe UI,sans-serif;background:#f8f9fa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1rem}
.box{background:#fff;padding:2.5rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:480px;text-align:center}
h1{color:${c ? '#2e7d32' : '#e74c3c'}}a{color:#3498db}</style></head><body><div class="box">
${c ? `<h1>✅ Valid Certificate</h1><p><b>${esc(c.name)}</b> completed</p><h2>${esc(c.course)}</h2><p>on ${esc(c.date)}</p><small>ID: ${id}</small>`
    : `<h1>❌ Not Found</h1><p>No certificate with ID <b>${id}</b> exists.</p>`}
<p style="margin-top:1.5rem"><a href="/">← Back to ReSkilled</a></p></div></body></html>`);
});

// Any unexpected error (e.g. Firestore unreachable) becomes a clean JSON message instead of a crash
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error. Please try again in a moment.' });
});

app.listen(PORT, () => console.log(`ReSkilled running at http://localhost:${PORT}`));