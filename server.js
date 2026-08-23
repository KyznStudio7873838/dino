/* =========================================================================
   DINO RUNNER — SERVER AKUN (JSON per akun)
   =========================================================================
   Cara kerja singkat:
   - Tiap akun disimpan sebagai satu baris di data/accounts.json
     (username, hash password + salt, tanggal dibuat).
   - Data progres tiap akun (skor, koin, skin, dsb) disimpan TERPISAH di
     file data/saves/<username>.json — jadi progres antar akun TIDAK PERNAH
     tercampur, karena satu akun = satu file JSON sendiri.
   - Login menghasilkan token acak yang harus disertakan di header
     "Authorization: Bearer <token>" untuk memuat/menyimpan data.

   Cara jalanin:
     cd server
     npm install
     npm start
   Server jalan di http://localhost:3000 secara default (ganti lewat PORT).

   PENTING SEBELUM DIPAKAI SUNGGUHAN DI PUBLIK:
   - Ganti CORS_ORIGIN di bawah dari "*" ke domain situs game kamu.
   - Jalankan di belakang HTTPS (mis. lewat Nginx/Cloudflare/hosting yang
     otomatis kasih SSL), supaya password tidak dikirim polos di jaringan.
   ========================================================================= */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // ganti ke domain kamu saat live
const DATA_DIR = path.join(__dirname, 'data');
const SAVES_DIR = path.join(DATA_DIR, 'saves');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD_LEN = 6;
const MAX_BODY_BYTES = 200 * 1024; // 200KB, cukup longgar untuk 1 save data
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_LOCK_MS = 5 * 60 * 1000; // 5 menit

// ---------- util: penyimpanan JSON aman ----------
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SAVES_DIR)) fs.mkdirSync(SAVES_DIR, { recursive: true });
  if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify({}, null, 2));
}
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}
// tulis atomik: tulis ke file sementara dulu lalu rename, supaya file tidak
// pernah setengah-jadi/corrupt kalau server mati di tengah proses tulis.
function writeJSONAtomic(file, obj) {
  const tmp = file + '.tmp' + process.pid + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}
function saveFilePath(username) {
  return path.join(SAVES_DIR, username.toLowerCase() + '.json');
}

// ---------- util: password hashing (scrypt bawaan Node, tanpa dependency tambahan) ----------
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const target = Buffer.from(hash, 'hex');
  if (check.length !== target.length) return false;
  return crypto.timingSafeEqual(check, target);
}

// ---------- state di memori: akun (di-cache dari file), sesi login, percobaan login ----------
ensureDirs();
let accounts = readJSON(ACCOUNTS_FILE, {}); // key: username lowercase -> { username, passHash, createdAt }
const sessions = new Map();   // token -> { username, expires }
const loginAttempts = new Map(); // username lowercase -> { count, lockedUntil }

function persistAccounts() { writeJSONAtomic(ACCOUNTS_FILE, accounts); }

function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function createSession(username) {
  const token = makeToken();
  sessions.set(token, { username, expires: Date.now() + TOKEN_TTL_MS });
  return token;
}
function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) { sessions.delete(token); return null; }
  return s;
}
// bersihkan sesi kedaluwarsa tiap jam supaya memori tidak terus membengkak
setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (now > s.expires) sessions.delete(t);
}, 60 * 60 * 1000);

// ---------- default data akun baru ----------
function emptySave() {
  return {
    highScore: 0, coins: 0, diamonds: 0, unlocked: [0], selectedSkin: 0,
    questProgress: null, questCompleted: false, mantraCount: 0,
    chapter2StageDone: false, chapter2IntroSeen: false, achievements: [],
    bestStreak: 0, dailyDate: '', dailyChallengeId: '', dailyDone: false, dailyClaimed: false,
    updatedAt: new Date().toISOString()
  };
}
// batasi & rapikan data yang dikirim klien supaya file save tidak bisa dijejali
// data raksasa/aneh yang merusak server (klien tetap dipercaya untuk isi progres,
// karena ini game single-player, tapi bentuk datanya tetap dijaga).
function sanitizeSave(input) {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.max(0, Math.min(v, 999999999)) : d);
  const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  input = input || {};
  return {
    highScore: n(input.highScore),
    coins: n(input.coins),
    diamonds: n(input.diamonds),
    unlocked: arr(input.unlocked, 200),
    selectedSkin: n(input.selectedSkin),
    questProgress: (typeof input.questProgress === 'object') ? input.questProgress : null,
    questCompleted: !!input.questCompleted,
    mantraCount: n(input.mantraCount),
    chapter2StageDone: !!input.chapter2StageDone,
    chapter2IntroSeen: !!input.chapter2IntroSeen,
    achievements: arr(input.achievements, 500),
    bestStreak: n(input.bestStreak),
    dailyDate: String(input.dailyDate || '').slice(0, 20),
    dailyChallengeId: String(input.dailyChallengeId || '').slice(0, 40),
    dailyDone: !!input.dailyDone,
    dailyClaimed: !!input.dailyClaimed,
    updatedAt: new Date().toISOString()
  };
}

// ---------- helper request/response ----------
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('BAD_JSON')); }
    });
    req.on('error', reject);
  });
}
function getToken(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
function requireAuth(req, res) {
  const token = getToken(req);
  const session = token ? getSession(token) : null;
  if (!session) { sendJSON(res, 401, { ok: false, error: 'Sesi tidak valid, silakan login lagi.' }); return null; }
  return session;
}

// ---------- route handlers ----------
async function handleRegister(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return sendJSON(res, 400, { ok: false, error: 'Body tidak valid.' }); }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!USERNAME_RE.test(username)) {
    return sendJSON(res, 400, { ok: false, error: 'Username 3-20 karakter, hanya huruf/angka/underscore.' });
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return sendJSON(res, 400, { ok: false, error: `Password minimal ${MIN_PASSWORD_LEN} karakter.` });
  }
  const key = username.toLowerCase();
  if (accounts[key]) {
    return sendJSON(res, 409, { ok: false, error: 'Username sudah dipakai.' });
  }
  accounts[key] = { username, passHash: hashPassword(password), createdAt: new Date().toISOString() };
  persistAccounts();
  writeJSONAtomic(saveFilePath(username), emptySave());
  const token = createSession(key);
  return sendJSON(res, 200, { ok: true, token, username });
}

async function handleLogin(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return sendJSON(res, 400, { ok: false, error: 'Body tidak valid.' }); }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const key = username.toLowerCase();

  const attempt = loginAttempts.get(key);
  if (attempt && attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    const secs = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
    return sendJSON(res, 429, { ok: false, error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${secs} detik.` });
  }

  const acct = accounts[key];
  const ok = acct && verifyPassword(password, acct.passHash);
  if (!ok) {
    const cur = loginAttempts.get(key) || { count: 0 };
    cur.count += 1;
    if (cur.count >= MAX_LOGIN_ATTEMPTS) { cur.lockedUntil = Date.now() + LOGIN_LOCK_MS; cur.count = 0; }
    loginAttempts.set(key, cur);
    return sendJSON(res, 401, { ok: false, error: 'Username atau password salah.' });
  }
  loginAttempts.delete(key);
  const token = createSession(key);
  return sendJSON(res, 200, { ok: true, token, username: acct.username });
}

function handleLogout(req, res) {
  const token = getToken(req);
  if (token) sessions.delete(token);
  return sendJSON(res, 200, { ok: true });
}

function handleGetData(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  const file = saveFilePath(session.username);
  const data = readJSON(file, emptySave());
  return sendJSON(res, 200, { ok: true, data });
}

async function handlePostData(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  let body;
  try { body = await readBody(req); } catch (e) {
    const status = e.message === 'BODY_TOO_LARGE' ? 413 : 400;
    return sendJSON(res, status, { ok: false, error: 'Data save tidak valid atau terlalu besar.' });
  }
  const clean = sanitizeSave(body.data || body);
  writeJSONAtomic(saveFilePath(session.username), clean);
  return sendJSON(res, 200, { ok: true, savedAt: clean.updatedAt });
}

// ---------- server HTTP sederhana (tanpa framework tambahan) ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJSON(res, 200, { ok: true, accounts: Object.keys(accounts).length });
    }
    if (url.pathname === '/api/register' && req.method === 'POST') return await handleRegister(req, res);
    if (url.pathname === '/api/login' && req.method === 'POST') return await handleLogin(req, res);
    if (url.pathname === '/api/logout' && req.method === 'POST') return handleLogout(req, res);
    if (url.pathname === '/api/data' && req.method === 'GET') return handleGetData(req, res);
    if (url.pathname === '/api/data' && req.method === 'POST') return await handlePostData(req, res);
    return sendJSON(res, 404, { ok: false, error: 'Tidak ditemukan.' });
  } catch (e) {
    console.error(e);
    return sendJSON(res, 500, { ok: false, error: 'Server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`Server akun Dino Runner jalan di http://localhost:${PORT}`);
  console.log(`Akun tersimpan di: ${ACCOUNTS_FILE}`);
  console.log(`Data progres per akun tersimpan di: ${SAVES_DIR}/<username>.json`);
});
