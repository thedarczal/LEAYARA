// Backend: Express + data JSON + autentikasi token (tanpa library tambahan)
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'ganti-rahasia-ini-di-produksi';
const DB_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const loadDB = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { users: [], scans: [] }; } };
const saveDB = db => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(pw, salt, 64));
}
function makeToken(id) {
  const body = Buffer.from(JSON.stringify({ id, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function readToken(token) {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}
function auth(req, res, next) {
  const data = readToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!data) return res.status(401).json({ error: 'Sesi berakhir. Silakan masuk kembali.' });
  req.userId = data.id;
  next();
}

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Isi nama, email, dan kata sandi (minimal 6 karakter).' });
  const db = loadDB();
  if (db.users.some(u => u.email === email.toLowerCase()))
    return res.status(409).json({ error: 'Email sudah terdaftar. Coba masuk.' });
  const user = { id: crypto.randomUUID(), name, email: email.toLowerCase(), password: hashPassword(password) };
  db.users.push(user); saveDB(db);
  res.json({ token: makeToken(user.id), name: user.name });
});

app.post('/api/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  const user = loadDB().users.find(u => u.email === email.toLowerCase());
  if (!user || !checkPassword(password, user.password))
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  res.json({ token: makeToken(user.id), name: user.name });
});

// Riwayat pemeriksaan daun
app.get('/api/scans', auth, (req, res) => res.json(loadDB().scans.filter(s => s.userId === req.userId)));

app.post('/api/scans', auth, (req, res) => {
  const { condition, confidence, thumb, note } = req.body;
  if (!condition) return res.status(400).json({ error: 'Data hasil tidak lengkap.' });
  const db = loadDB();
  const scan = { id: crypto.randomUUID(), userId: req.userId, condition, confidence, thumb: thumb || '', note: note || '', createdAt: new Date().toISOString() };
  db.scans.unshift(scan); saveDB(db);
  res.status(201).json(scan);
});

app.delete('/api/scans/:id', auth, (req, res) => {
  const db = loadDB();
  const before = db.scans.length;
  db.scans = db.scans.filter(s => !(s.id === req.params.id && s.userId === req.userId));
  if (db.scans.length === before) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  saveDB(db); res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
