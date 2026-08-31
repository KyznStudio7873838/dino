/* ===================== SETUP ===================== */

/* Reset total SEKALI JALAN: menghapus semua data lama pemain (profil, skor,
   koin, setelan, status login, dll) supaya semua pemain mulai dari nol bersih
   di update ini. Setelah dijalankan sekali, flag di bawah mencegah ini
   terulang lagi di kunjungan berikutnya. */
(function hardResetAllGameDataOnce() {
  const RESET_FLAG = 'dino_hardResetDone_v2_8';
  if (localStorage.getItem(RESET_FLAG) === '1') return;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.toLowerCase().startsWith('dino')) keysToRemove.push(k);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  localStorage.setItem(RESET_FLAG, '1');
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lobby = document.getElementById('lobby');
const modeSelect = document.getElementById('modeSelect');
const shop = document.getElementById('shop');
const account = document.getElementById('account');
const gameover = document.getElementById('gameover');
const hud = document.getElementById('hud');
const flashEl = document.getElementById('flash');

const hudScore = document.getElementById('hudScore');
const hudCoins = document.getElementById('hudCoins');
const livesEl = document.getElementById('lives');
const weatherPill = document.getElementById('weatherPill');
const biomePill = document.getElementById('biomePill');
const hudDiamonds = document.getElementById('hudDiamonds');
const streakPill = document.getElementById('streakPill');
const hudStreak = document.getElementById('hudStreak');
const buffRow = document.getElementById('buffRow');
const questHud = document.getElementById('questHud');
const bossBarWrap = document.getElementById('bossBarWrap');
const bossBarFill = document.getElementById('bossBarFill');
const bossNameEl = document.getElementById('bossName');
const skillToast = document.getElementById('skillToast');
const storyOverlay = document.getElementById('storyOverlay');
const storyIcon = document.getElementById('storyIcon');
const storyComic = document.getElementById('storyComic');
const storyComicCtx = storyComic.getContext('2d');
const storyTitle = document.getElementById('storyTitle');
const storyText = document.getElementById('storyText');
const storyDots = document.getElementById('storyDots');
const storyBtn = document.getElementById('storyBtn');

/* ===================== AUDIO (musik & efek suara) =====================
   Tidak pakai file .mp3 eksternal — musik & SFX dibuat langsung lewat
   Web Audio API (osilator) supaya game tetap ringan & 100% offline
   tanpa perlu file audio tambahan. Semua bisa diatur di menu Pengaturan. */
const AudioMgr = (function () {
  let actx = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicPlaying = false;
  let unlocked = false;
  let noteIndex = 0;
  let nextNoteTime = 0;

  let musicOn = localStorage.getItem('dino_musicOn') !== 'false';
  let sfxOn = localStorage.getItem('dino_sfxOn') !== 'false';
  let musicVol = parseFloat(localStorage.getItem('dino_musicVol') ?? '0.45');
  let sfxVol = parseFloat(localStorage.getItem('dino_sfxVol') ?? '0.7');
  if (Number.isNaN(musicVol)) musicVol = 0.45;
  if (Number.isNaN(sfxVol)) sfxVol = 0.7;

  const NOTE_DUR = 0.28;
  const MELODY = [392, 440, 523.25, 659.25, 523.25, 440, 392, 330, 392, 440, 523.25, 659.25, 783.99, 659.25, 523.25, 440];

  function ensureCtx() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      musicGain = actx.createGain();
      musicGain.gain.value = musicVol;
      musicGain.connect(actx.destination);
      sfxGain = actx.createGain();
      sfxGain.gain.value = sfxVol;
      sfxGain.connect(actx.destination);
    }
    return actx;
  }

  function tone(freq, start, dur, type, dest, peak) {
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function sfx(name) {
    if (!sfxOn) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const t = c.currentTime;
    switch (name) {
      case 'jump':
        tone(520, t, 0.12, 'square', sfxGain, 0.18);
        tone(760, t + 0.05, 0.1, 'square', sfxGain, 0.14);
        break;
      case 'coin':
        tone(880, t, 0.08, 'square', sfxGain, 0.18);
        tone(1320, t + 0.05, 0.12, 'square', sfxGain, 0.16);
        break;
      case 'diamond':
        tone(1046, t, 0.09, 'triangle', sfxGain, 0.2);
        tone(1568, t + 0.06, 0.14, 'triangle', sfxGain, 0.18);
        tone(2093, t + 0.12, 0.16, 'triangle', sfxGain, 0.14);
        break;
      case 'hit':
        tone(180, t, 0.18, 'sawtooth', sfxGain, 0.22);
        tone(90, t + 0.05, 0.2, 'sawtooth', sfxGain, 0.18);
        break;
      case 'gameover':
        tone(400, t, 0.18, 'sawtooth', sfxGain, 0.2);
        tone(300, t + 0.16, 0.18, 'sawtooth', sfxGain, 0.18);
        tone(180, t + 0.34, 0.3, 'sawtooth', sfxGain, 0.18);
        break;
      case 'click':
        tone(700, t, 0.05, 'square', sfxGain, 0.12);
        break;
      case 'claim':
        tone(660, t, 0.08, 'square', sfxGain, 0.16);
        tone(880, t + 0.07, 0.08, 'square', sfxGain, 0.16);
        tone(1100, t + 0.14, 0.14, 'square', sfxGain, 0.16);
        break;
      case 'buy':
        tone(500, t, 0.07, 'square', sfxGain, 0.16);
        tone(750, t + 0.06, 0.1, 'square', sfxGain, 0.16);
        break;
      case 'unlock':
        tone(600, t, 0.1, 'triangle', sfxGain, 0.18);
        tone(900, t + 0.08, 0.1, 'triangle', sfxGain, 0.18);
        tone(1200, t + 0.16, 0.16, 'triangle', sfxGain, 0.18);
        break;
    }
  }

  function scheduleMusic() {
    if (!musicOn || !actx) return;
    while (nextNoteTime < actx.currentTime + 0.6) {
      const freq = MELODY[noteIndex % MELODY.length];
      tone(freq, nextNoteTime, NOTE_DUR * 0.9, 'triangle', musicGain, 0.09);
      tone(freq / 2, nextNoteTime, NOTE_DUR * 0.9, 'sine', musicGain, 0.05);
      nextNoteTime += NOTE_DUR;
      noteIndex++;
    }
  }

  function startMusic() {
    const c = ensureCtx();
    if (!c || musicPlaying || !musicOn) return;
    if (c.state === 'suspended') c.resume();
    musicPlaying = true;
    nextNoteTime = c.currentTime + 0.1;
    noteIndex = 0;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(scheduleMusic, 150);
    scheduleMusic();
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function unlock() {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
    if (musicOn) startMusic();
  }

  function setMusicOn(v) {
    musicOn = v;
    localStorage.setItem('dino_musicOn', String(v));
    if (v) { if (unlocked) startMusic(); } else stopMusic();
  }
  function setSfxOn(v) { sfxOn = v; localStorage.setItem('dino_sfxOn', String(v)); }
  function setMusicVol(v) { musicVol = v; localStorage.setItem('dino_musicVol', String(v)); if (musicGain) musicGain.gain.value = v; }
  function setSfxVol(v) { sfxVol = v; localStorage.setItem('dino_sfxVol', String(v)); if (sfxGain) sfxGain.gain.value = v; }

  // BUGFIX: suara/musik tetap jalan walau app diminimize/ditutup ke background.
  // Solusinya: begitu tab/app disembunyikan (visibilitychange) atau halaman
  // mau ditinggal (pagehide), langsung stop timer musik & suspend AudioContext
  // supaya osilator berhenti total. Begitu app dibuka lagi, resume otomatis
  // kalau musik memang lagi aktif.
  let wasPlayingBeforeHide = false;
  function suspendForBackground() {
    wasPlayingBeforeHide = musicPlaying;
    stopMusic();
    if (actx && actx.state === 'running') actx.suspend();
  }
  function resumeFromBackground() {
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();
    if (musicOn && wasPlayingBeforeHide) startMusic();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendForBackground();
    else resumeFromBackground();
  });
  window.addEventListener('pagehide', suspendForBackground);
  window.addEventListener('blur', suspendForBackground);
  window.addEventListener('focus', resumeFromBackground);

  return {
    unlock, sfx,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    get musicVol() { return musicVol; },
    get sfxVol() { return sfxVol; },
    setMusicOn, setSfxOn, setMusicVol, setSfxVol,
    pauseAudio: suspendForBackground,
    resumeAudio: resumeFromBackground
  };
})();

let GROUND_Y = 0;
const GRAVITY = 0.6;
const JUMP_FORCE = -12.5;

/* ===================== KUALITAS GRAFIS ===================== =
   VW/VH = ukuran "logis" layar (satuan CSS px) — SEMUA posisi & ukuran
   game (dino, rintangan, partikel, dsb) dihitung dari VW/VH ini persis
   seperti sebelumnya, jadi proporsi game tidak berubah sama sekali.
   Yang berubah cuma RESOLUSI GAMBAR di belakang layar (backing store)
   lewat ctx.setTransform(dpr,...) — sama seperti trik retina/HiDPI di
   web modern. Jadi makin tinggi setting-nya, makin tajam garis & bentuk
   yang dirender, tanpa mengubah ukuran/posisi objek game sama sekali. */
let VW = window.innerWidth, VH = window.innerHeight;
const GFX_LEVELS = { rendah: 0.5, normal: 1, tinggi: 2.2, '4k': 3.2 };
let gfxQuality = localStorage.getItem('dino_gfxQuality') || 'normal';
if (!GFX_LEVELS[gfxQuality]) gfxQuality = 'normal';
function effectiveDPR() {
  // Sengaja TIDAK dibatasi oleh devicePixelRatio asli HP, supaya perbedaan
  // antar tingkat kualitas selalu kelihatan jelas di HP apapun (termasuk HP
  // dengan layar biasa yang devicePixelRatio-nya cuma 1).
  return GFX_LEVELS[gfxQuality] || 1;
}
// Dipakai buat atur jumlah partikel (hujan/angin/kabut/jejak kaki/awan) dan
// intensitas glow (cahaya matahari dsb) supaya perbedaan tiap tingkat kualitas
// benar-benar kelihatan, bukan cuma beda dikit.
function gfxParticleMul() {
  return gfxQuality === 'rendah' ? 0.3 : gfxQuality === 'tinggi' ? 1.7 : gfxQuality === '4k' ? 2.5 : 1;
}
function gfxGlowMul() {
  return gfxQuality === 'rendah' ? 0 : gfxQuality === 'tinggi' ? 1.5 : gfxQuality === '4k' ? 2.2 : 1;
}
function setGfxQuality(q) {
  if (!GFX_LEVELS[q]) return;
  gfxQuality = q;
  localStorage.setItem('dino_gfxQuality', q);
  document.body.dataset.gfx = q;
  resizeCanvas();
}

/* ===================== SISTEM AKUN LOKAL (PROFIL + BACKUP) =====================
   1) Profil lokal bernama (bisa lebih dari satu di HP/browser yang sama) supaya
      data antar pemain tidak tercampur.
   2) Kunci PIN opsional per profil — pembatas ringan, BUKAN enkripsi sungguhan.
   3) Export/Import save ke file .json — cara manual menyelamatkan data kalau
      ganti HP, uninstall, atau membersihkan data browser.
   4) Opsional: Akun Online (lihat blok SISTEM SERVER AKUN di bawah) — kalau
      dipakai, profil aktif disinkron ke backend server yang menyimpan tiap
      akun sebagai file JSON sendiri-sendiri, supaya data antar akun online
      juga tidak pernah tercampur. Tanpa akun online, semua tetap berjalan
      100% lokal seperti biasa.
================================================================================ */
const PROFILE_KEYS = ['highScore', 'coins', 'diamonds', 'unlocked', 'selectedSkin', 'questProgress', 'questCompleted', 'mantraCount', 'chapter2StageDone', 'chapter2IntroSeen', 'achievements', 'bestStreak', 'dailyDate', 'dailyChallengeId', 'dailyDone', 'dailyClaimed', 'unlockedTrails', 'selectedTrail', 'eventGhost', 'castleProgress', 'castleMantraCount', 'castleBestFloor'];
function profileStorageKey(profileId, key) { return `dino_p_${profileId}_${key}`; }
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function loadProfileList() {
  try { return JSON.parse(localStorage.getItem('dinoProfiles') || '[]'); } catch (e) { return []; }
}
function saveProfileList(list) { localStorage.setItem('dinoProfiles', JSON.stringify(list)); }
function getActiveProfileId() { return localStorage.getItem('dinoActiveProfileId'); }
function getActiveProfile() {
  const id = getActiveProfileId();
  return loadProfileList().find(p => p.id === id) || null;
}
/* Migrasi satu kali: kalau sebelumnya belum pakai sistem profil (versi lama
   menyimpan data langsung tanpa nama akun), buat profil "Pemain 1" otomatis
   dan pindahkan data lama ke situ supaya TIDAK HILANG. */
function migrateLegacyDataIfNeeded() {
  if (localStorage.getItem('dinoProfiles')) return;
  const id = 'p' + Date.now().toString(36);
  const hasLegacy = localStorage.getItem('dinoHighScore') !== null || localStorage.getItem('dinoCoins') !== null;
  if (hasLegacy) {
    localStorage.setItem(profileStorageKey(id, 'highScore'), localStorage.getItem('dinoHighScore') || '0');
    localStorage.setItem(profileStorageKey(id, 'coins'), localStorage.getItem('dinoCoins') || '0');
    localStorage.setItem(profileStorageKey(id, 'unlocked'), localStorage.getItem('dinoUnlocked') || '[0]');
    localStorage.setItem(profileStorageKey(id, 'selectedSkin'), localStorage.getItem('dinoSelectedSkin') || '0');
    localStorage.setItem(profileStorageKey(id, 'questProgress'), localStorage.getItem('dinoQuestProgress') || 'null');
    localStorage.setItem(profileStorageKey(id, 'questCompleted'), localStorage.getItem('dinoQuestCompleted') || 'false');
  }
  saveProfileList([{ id, name: 'Pemain 1', pinHash: null, createdAt: Date.now() }]);
  localStorage.setItem('dinoActiveProfileId', id);
}
migrateLegacyDataIfNeeded();

function createProfile(name, pin) {
  const list = loadProfileList();
  const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const cleanName = (name || '').trim().slice(0, 18) || `Pemain ${list.length + 1}`;
  list.push({ id, name: cleanName, pinHash: pin ? simpleHash(pin) : null, createdAt: Date.now() });
  saveProfileList(list);
  localStorage.setItem('dinoActiveProfileId', id);
  return id;
}
function switchProfile(id) {
  const target = loadProfileList().find(p => p.id === id);
  if (!target) return;
  if (target.pinHash) {
    const entered = prompt(`Masukkan PIN untuk profil "${target.name}":`);
    if (entered === null) return;
    if (simpleHash(entered) !== target.pinHash) { alert('PIN salah.'); return; }
  }
  localStorage.setItem('dinoActiveProfileId', id);
  data = loadData();
  refreshLobbyStats();
  renderAccountScreen();
}
function deleteProfile(id) {
  const list = loadProfileList();
  const target = list.find(p => p.id === id);
  if (!target) return;
  if (!confirm(`Hapus profil "${target.name}" beserta semua datanya? Tindakan ini tidak bisa dibatalkan.`)) return;
  const remaining = list.filter(p => p.id !== id);
  saveProfileList(remaining);
  PROFILE_KEYS.forEach(k => localStorage.removeItem(profileStorageKey(id, k)));
  if (getActiveProfileId() === id) {
    if (remaining.length) {
      localStorage.setItem('dinoActiveProfileId', remaining[0].id);
    } else {
      const newId = createProfile('Pemain 1', null);
      localStorage.setItem('dinoActiveProfileId', newId);
    }
    data = loadData();
    refreshLobbyStats();
  }
  renderAccountScreen();
}
function exportSave() {
  const profile = getActiveProfile();
  const payload = {
    app: 'dino-runner-save', version: 1,
    profileName: profile ? profile.name : 'Pemain',
    exportedAt: new Date().toISOString(),
    data: {
      highScore: data.highScore, coins: data.coins, diamonds: data.diamonds, unlocked: data.unlocked,
      selectedSkin: data.selectedSkin, questProgress: data.questProgress, questCompleted: data.questCompleted,
      mantraCount: data.mantraCount, chapter2StageDone: data.chapter2StageDone, chapter2IntroSeen: data.chapter2IntroSeen,
      achievements: data.achievements, bestStreak: data.bestStreak,
      unlockedTrails: data.unlockedTrails, selectedTrail: data.selectedTrail, eventGhost: data.eventGhost,
      castleProgress: data.castleProgress, castleMantraCount: data.castleMantraCount, castleBestFloor: data.castleBestFloor
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (payload.profileName || 'pemain').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `dino-save-${safeName}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function handleImportSaveFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let payload;
    try { payload = JSON.parse(reader.result); } catch (e) { alert('File save tidak valid.'); return; }
    if (!payload || payload.app !== 'dino-runner-save' || !payload.data) { alert('File save tidak valid.'); return; }
    const id = createProfile((payload.profileName || 'Pemain') + ' (impor)', null);
    localStorage.setItem(profileStorageKey(id, 'highScore'), String(payload.data.highScore || 0));
    localStorage.setItem(profileStorageKey(id, 'coins'), String(payload.data.coins || 0));
    localStorage.setItem(profileStorageKey(id, 'diamonds'), String(payload.data.diamonds || 0));
    localStorage.setItem(profileStorageKey(id, 'unlocked'), JSON.stringify(payload.data.unlocked || [0]));
    localStorage.setItem(profileStorageKey(id, 'selectedSkin'), String(payload.data.selectedSkin || 0));
    localStorage.setItem(profileStorageKey(id, 'questProgress'), JSON.stringify(payload.data.questProgress || null));
    localStorage.setItem(profileStorageKey(id, 'questCompleted'), String(!!payload.data.questCompleted));
    localStorage.setItem(profileStorageKey(id, 'mantraCount'), String(payload.data.mantraCount || 0));
    localStorage.setItem(profileStorageKey(id, 'chapter2StageDone'), String(!!payload.data.chapter2StageDone));
    localStorage.setItem(profileStorageKey(id, 'chapter2IntroSeen'), String(!!payload.data.chapter2IntroSeen));
    localStorage.setItem(profileStorageKey(id, 'achievements'), JSON.stringify(payload.data.achievements || []));
    localStorage.setItem(profileStorageKey(id, 'bestStreak'), String(payload.data.bestStreak || 0));
    localStorage.setItem(profileStorageKey(id, 'unlockedTrails'), JSON.stringify(payload.data.unlockedTrails || [0]));
    localStorage.setItem(profileStorageKey(id, 'selectedTrail'), String(payload.data.selectedTrail || 0));
    localStorage.setItem(profileStorageKey(id, 'eventGhost'), JSON.stringify(payload.data.eventGhost || {}));
    localStorage.setItem(profileStorageKey(id, 'castleProgress'), JSON.stringify(payload.data.castleProgress || null));
    localStorage.setItem(profileStorageKey(id, 'castleMantraCount'), String(payload.data.castleMantraCount || 0));
    localStorage.setItem(profileStorageKey(id, 'castleBestFloor'), String(payload.data.castleBestFloor || 1));
    data = loadData();
    refreshLobbyStats();
    renderAccountScreen();
    alert('Save berhasil dipulihkan sebagai profil baru.');
  };
  reader.onerror = () => alert('Gagal membaca file save.');
  reader.readAsText(file);
}
function renderEquippedSkinPanel() {
  const s = getSkin(data.selectedSkin);
  document.getElementById('equippedSkinName').textContent = s.name;
  const buffEl = document.getElementById('equippedSkinBuff');
  buffEl.textContent = s.affinity ? skinAffinityShortLabel(s.affinity) : '✦ Skin polos, tanpa bonus buff';
  const cvs = document.getElementById('equippedSkinCanvas');
  const cctx = cvs.getContext('2d');
  cctx.clearRect(0, 0, cvs.width, cvs.height);
  drawDinoShape(cctx, 16, 26, 38, 38, s, false, 0, 1);
}
function renderAccountScreen() {
  renderEquippedSkinPanel();
  const activeId = getActiveProfileId();
  const list = loadProfileList();
  const wrap = document.getElementById('profileList');
  wrap.innerHTML = '';
  list.forEach(p => {
    const isActive = p.id === activeId;
    const hs = localStorage.getItem(profileStorageKey(p.id, 'highScore')) || '0';
    const pc = localStorage.getItem(profileStorageKey(p.id, 'coins')) || '0';
    const row = document.createElement('div');
    row.className = 'profile-item' + (isActive ? ' active' : '');
    row.innerHTML = `
      <div class="p-avatar">${isActive ? '👑' : '🦖'}</div>
      <div class="p-info">
        <div class="p-name">${p.name}${p.pinHash ? ' 🔒' : ''}</div>
        <div class="p-meta">🏆 ${hs} &nbsp;·&nbsp; 🪙 ${pc}</div>
      </div>
      <div class="p-actions">
        ${isActive ? '<button class="p-btn current" disabled>AKTIF</button>' : `<button class="p-btn switch" data-id="${p.id}" data-action="switch">PAKAI</button>`}
        <button class="p-btn del" data-id="${p.id}" data-action="del">HAPUS</button>
      </div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'switch') switchProfile(id);
      else if (btn.dataset.action === 'del') deleteProfile(id);
    });
  });
  const profile = getActiveProfile();
  document.getElementById('profilePillName').textContent = profile ? profile.name : 'Pemain';
  renderAchievements();
  renderServerAcctUI();
}

/* ===================== SISTEM SERVER AKUN (ONLINE, OPSIONAL) =====================
   Ini lapisan TAMBAHAN di atas sistem profil lokal di atas. Kalau pemain daftar/
   masuk ke akun server, progres profil AKTIF di perangkat ini akan disinkronkan
   ke server lewat backend Node.js sederhana (lihat folder /server). Backend
   menyimpan tiap akun sebagai FILE JSON TERPISAH (server/data/saves/<username>.json)
   sehingga data antar akun tidak pernah tercampur, dan kalau server tidak bisa
   dihubungi (offline / belum di-deploy), game tetap jalan normal pakai data lokal —
   sinkron server hanya percobaan tambahan, bukan syarat wajib untuk main.

   SERVER_API_BASE otomatis pakai domain tempat game ini di-host (dengan asumsi
   API server jalan di domain yang sama, path /api/...). Kalau server akun kamu
   ada di domain/subdomain LAIN (mis. api.situskamu.com), isi manual di bawah,
   HARUS https:// (bukan http://) supaya jalan waktu sudah jadi Android app. */
const SERVER_API_BASE = (function () {
  const manualOverride = ''; // contoh: 'https://api.kyznteam.com'
  if (manualOverride) return manualOverride;
  if (location.protocol === 'file:') return 'http://localhost:3000'; // dev lokal
  return location.origin; // production: pakai domain yang sama
})();
const SERVER_TOKEN_KEY = 'dino_serverToken';
const SERVER_USER_KEY = 'dino_serverUsername';

function getServerToken() { return localStorage.getItem(SERVER_TOKEN_KEY); }
function getServerUsername() { return localStorage.getItem(SERVER_USER_KEY); }
function isServerLoggedIn() { return !!(getServerToken() && getServerUsername()); }

async function serverApiCall(pathName, method, body, useAuth) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const token = getServerToken();
    if (!token) throw new Error('Belum masuk akun online.');
    headers['Authorization'] = 'Bearer ' + token;
  }
  const res = await fetch(SERVER_API_BASE + pathName, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* respons bukan JSON */ }
  if (!res.ok || !json || json.ok === false) {
    const msg = (json && json.error) || `Server merespons dengan status ${res.status}.`;
    throw new Error(msg);
  }
  return json;
}

function setServerAcctMsg(text, kind) {
  const el = document.getElementById('serverAcctMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'server-acct-msg' + (kind ? ' ' + kind : '');
}

function renderServerAcctUI() {
  const loggedIn = isServerLoggedIn();
  const outBox = document.getElementById('serverAcctLoggedOut');
  const inBox = document.getElementById('serverAcctLoggedIn');
  if (!outBox || !inBox) return;
  outBox.style.display = loggedIn ? 'none' : '';
  inBox.style.display = loggedIn ? '' : 'none';
  if (loggedIn) document.getElementById('serverAcctName').textContent = getServerUsername();
}

/* Setelah login/daftar sukses: tarik data dari server dan timpa data profil lokal
   yang sedang aktif, supaya akun server jadi acuan progres begitu dipakai. */
async function pullServerDataIntoActiveProfile() {
  const json = await serverApiCall('/api/data', 'GET', null, true);
  const pid = getActiveProfileId();
  if (!pid || !json.data) return;
  const d = json.data;
  const set = (key, val) => localStorage.setItem(profileStorageKey(pid, key), val);
  set('highScore', String(d.highScore || 0));
  set('coins', String(d.coins || 0));
  set('diamonds', String(d.diamonds || 0));
  set('unlocked', JSON.stringify(d.unlocked || [0]));
  set('selectedSkin', String(d.selectedSkin || 0));
  set('questProgress', JSON.stringify(d.questProgress || null));
  set('questCompleted', String(!!d.questCompleted));
  set('mantraCount', String(d.mantraCount || 0));
  set('chapter2StageDone', String(!!d.chapter2StageDone));
  set('chapter2IntroSeen', String(!!d.chapter2IntroSeen));
  set('achievements', JSON.stringify(d.achievements || []));
  set('bestStreak', String(d.bestStreak || 0));
  set('dailyDate', d.dailyDate || '');
  set('dailyChallengeId', d.dailyChallengeId || '');
  set('dailyDone', String(!!d.dailyDone));
  set('dailyClaimed', String(!!d.dailyClaimed));
  set('unlockedTrails', JSON.stringify(d.unlockedTrails || [0]));
  set('selectedTrail', String(d.selectedTrail || 0));
  set('eventGhost', JSON.stringify(d.eventGhost || {}));
  set('castleProgress', JSON.stringify(d.castleProgress || null));
  set('castleMantraCount', String(d.castleMantraCount || 0));
  set('castleBestFloor', String(d.castleBestFloor || 1));
  data = loadData();
  refreshLobbyStats();
}

/* Dorong data profil lokal aktif ke server. Gagal secara diam-diam (mis. server
   belum di-deploy / tidak ada koneksi) supaya main offline tidak pernah terganggu. */
let serverPushTimer = null;
function scheduleServerPush() {
  if (!isServerLoggedIn()) return;
  clearTimeout(serverPushTimer);
  serverPushTimer = setTimeout(pushServerDataNow, 800); // throttle biar tidak spam request tiap saveData()
}
async function pushServerDataNow() {
  if (!isServerLoggedIn()) return;
  try {
    await serverApiCall('/api/data', 'POST', { data }, true);
  } catch (e) {
    // Offline / server belum jalan — abaikan, data tetap aman di localStorage.
  }
}

async function handleServerRegister() {
  const username = (document.getElementById('serverUsername').value || '').trim();
  const password = document.getElementById('serverPassword').value || '';
  setServerAcctMsg('Mendaftarkan akun...', '');
  try {
    const json = await serverApiCall('/api/register', 'POST', { username, password }, false);
    localStorage.setItem(SERVER_TOKEN_KEY, json.token);
    localStorage.setItem(SERVER_USER_KEY, json.username);
    await pushServerDataNow(); // kirim progres profil lokal saat ini sebagai data awal akun baru
    setServerAcctMsg(`Akun "${json.username}" berhasil dibuat & masuk.`, 'ok');
    renderServerAcctUI();
  } catch (e) {
    setServerAcctMsg(e.message, 'error');
  }
}

async function handleServerLogin() {
  const username = (document.getElementById('serverUsername').value || '').trim();
  const password = document.getElementById('serverPassword').value || '';
  setServerAcctMsg('Masuk...', '');
  try {
    const json = await serverApiCall('/api/login', 'POST', { username, password }, false);
    localStorage.setItem(SERVER_TOKEN_KEY, json.token);
    localStorage.setItem(SERVER_USER_KEY, json.username);
    await pullServerDataIntoActiveProfile();
    setServerAcctMsg(`Berhasil masuk sebagai "${json.username}". Data disinkron.`, 'ok');
    renderServerAcctUI();
  } catch (e) {
    setServerAcctMsg(e.message, 'error');
  }
}

function handleServerLogout() {
  serverApiCall('/api/logout', 'POST', null, true).catch(() => {});
  localStorage.removeItem(SERVER_TOKEN_KEY);
  localStorage.removeItem(SERVER_USER_KEY);
  setServerAcctMsg('Sudah keluar dari akun online. Progres tetap aman secara lokal.', 'ok');
  renderServerAcctUI();
}

/* ===================== PERSISTENT DATA (per profil aktif) ===================== */
function loadData() {
  const pid = getActiveProfileId();
  const get = (key, def) => localStorage.getItem(profileStorageKey(pid, key)) ?? def;
  let questProgress = null;
  try { questProgress = JSON.parse(get('questProgress', 'null')); } catch (e) { questProgress = null; }
  let achievements = [];
  try { achievements = JSON.parse(get('achievements', '[]')); } catch (e) { achievements = []; }
  return {
    highScore: parseInt(get('highScore', '0'), 10),
    coins: parseInt(get('coins', '0'), 10),
    diamonds: parseInt(get('diamonds', '0'), 10),
    unlocked: JSON.parse(get('unlocked', '[0]')),
    selectedSkin: parseInt(get('selectedSkin', '0'), 10),
    questProgress,
    questCompleted: get('questCompleted', 'false') === 'true',
    mantraCount: parseInt(get('mantraCount', '0'), 10),
    chapter2StageDone: get('chapter2StageDone', 'false') === 'true',
    chapter2IntroSeen: get('chapter2IntroSeen', 'false') === 'true',
    achievements,
    bestStreak: parseInt(get('bestStreak', '0'), 10),
    dailyDate: get('dailyDate', ''),
    dailyChallengeId: get('dailyChallengeId', ''),
    dailyDone: get('dailyDone', 'false') === 'true',
    dailyClaimed: get('dailyClaimed', 'false') === 'true',
    unlockedTrails: JSON.parse(get('unlockedTrails', '[0]')),
    selectedTrail: parseInt(get('selectedTrail', '0'), 10),
    eventGhost: (() => { try { return JSON.parse(get('eventGhost', '{}')); } catch (e) { return {}; } })(),
    castleProgress: (() => { try { return JSON.parse(get('castleProgress', 'null')); } catch (e) { return null; } })(),
    castleMantraCount: parseInt(get('castleMantraCount', '0'), 10),
    castleBestFloor: parseInt(get('castleBestFloor', '1'), 10)
  };
}
let data = loadData();
// Pastikan struktur progres event Hantu selalu lengkap (jaga-jaga kalau
// profil ini belum pernah punya field ini sama sekali sebelum event ada).
if (!data.eventGhost || typeof data.eventGhost !== 'object') data.eventGhost = {};
data.eventGhost.nightPasses = data.eventGhost.nightPasses || 0;
data.eventGhost.mission1Done = !!data.eventGhost.mission1Done;
data.eventGhost.mission2Done = !!data.eventGhost.mission2Done;
function saveData() {
  const pid = getActiveProfileId();
  const set = (key, val) => localStorage.setItem(profileStorageKey(pid, key), val);
  set('highScore', String(data.highScore));
  set('coins', String(data.coins));
  set('diamonds', String(data.diamonds));
  set('unlocked', JSON.stringify(data.unlocked));
  set('selectedSkin', String(data.selectedSkin));
  set('questProgress', JSON.stringify(data.questProgress));
  set('questCompleted', String(data.questCompleted));
  set('mantraCount', String(data.mantraCount));
  set('chapter2StageDone', String(data.chapter2StageDone));
  set('chapter2IntroSeen', String(data.chapter2IntroSeen));
  set('achievements', JSON.stringify(data.achievements));
  set('bestStreak', String(data.bestStreak));
  set('dailyDate', data.dailyDate);
  set('dailyChallengeId', data.dailyChallengeId);
  set('dailyDone', String(data.dailyDone));
  set('dailyClaimed', String(data.dailyClaimed));
  set('unlockedTrails', JSON.stringify(data.unlockedTrails));
  set('selectedTrail', String(data.selectedTrail));
  set('eventGhost', JSON.stringify(data.eventGhost));
  set('castleProgress', JSON.stringify(data.castleProgress));
  set('castleMantraCount', String(data.castleMantraCount || 0));
  set('castleBestFloor', String(data.castleBestFloor || 1));
  scheduleServerPush();
}
/* Simpan checkpoint story mode: dipanggil tiap kali sebuah bos berhasil dikalahkan,
   supaya progres tidak hilang saat halaman ditutup/di-reload.
   - completed=false -> simpan wilayah tempat berhenti agar bisa dilanjutkan.
   - completed=true  -> seluruh story mode tamat; status ini disimpan permanen,
     terpisah dari checkpoint, supaya trofi tidak hilang walau main ulang. */
function qSaveCheckpoint(mapIndex, completed) {
  if (completed) {
    data.questProgress = null;
    data.questCompleted = true;
    // Buka semua skin hadiah begitu story mode tamat —
    // KECUALI skin hadiah event (eventOnly), itu cuma bisa didapat lewat misi event-nya sendiri.
    SKINS.filter(s => s.rewardOnly && !s.eventOnly).forEach(s => {
      if (!data.unlocked.includes(s.id)) data.unlocked.push(s.id);
    });
  } else {
    data.questProgress = { mapIndex, completed: false };
  }
  saveData();
}
function qClearCheckpoint() {
  data.questProgress = null;
  saveData();
}

/* ===================== SKINS ===================== */
/* Setiap skin punya bentuk (spikeStyle/pattern/tailStyle/horn) yang beda, bukan cuma warna.
   affinity = jenis buff yang "cocok" dengan skin ini -> durasi/efeknya jadi lebih kuat. */
const SKINS = [
  { id: 0, name: 'Hijau Klasik', cost: 0,
    body: '#4fa84a', head: '#367a33', belly: '#d9f2c9', eye: '#fff',
    spikeStyle: 'normal', pattern: 'plain', tailStyle: 'normal', horn: false, affinity: null },
  { id: 1, name: 'Merah Bara',   cost: 50,
    body: '#e5573f', head: '#b83a26', belly: '#ffd7c2', eye: '#fff',
    spikeStyle: 'flame', pattern: 'flame', tailStyle: 'normal', horn: false, affinity: 'speed' },
  { id: 2, name: 'Biru Laut',    cost: 80,
    body: '#3d8fd9', head: '#2b5fa8', belly: '#cfe8ff', eye: '#fff',
    spikeStyle: 'fin', pattern: 'scales', tailStyle: 'fin', horn: false, affinity: 'jump' },
  { id: 3, name: 'Kuning Cerah', cost: 120,
    body: '#e8c22e', head: '#b8941f', belly: '#fff6cf', eye: '#3a2a00',
    spikeStyle: 'round', pattern: 'spots', tailStyle: 'normal', horn: false, affinity: 'coin2x' },
  { id: 4, name: 'Emas Kilau',   cost: 200,
    body: '#d9a53d', head: '#b8842b', belly: '#fff3c9', eye: '#fff',
    spikeStyle: 'double', pattern: 'stars', tailStyle: 'normal', horn: true, affinity: 'life' },
  { id: 5, name: 'Ungu Misteri', cost: 300,
    body: '#8a4fd9', head: '#6a34ad', belly: '#e8d3ff', eye: '#fff',
    spikeStyle: 'crown', pattern: 'stripes', tailStyle: 'spiked', horn: true, affinity: 'all' },
  { id: 7, name: 'Kristal Berlian', cost: 60, costType: 'diamond',
    body: '#bfe9ff', head: '#8fd3f0', belly: '#eafcff', eye: '#1c2440',
    spikeStyle: 'fin', pattern: 'scales', tailStyle: 'fin', horn: true, hornColor: '#5ec8ff',
    shimmer: true, shimmerColor: '#eafcff', shimmerDark: '#8fd3f0', affinity: 'magnet' },
  { id: 8, name: 'Hutan Malam', cost: 260,
    body: '#2f5f38', head: '#1e3f26', belly: '#a8d9a0', eye: '#c9ffb0',
    spikeStyle: 'crown', pattern: 'spots', tailStyle: 'spiked', horn: false, affinity: 'slowmo' },
  { id: 9, name: 'Pasir Senja', cost: 90, costType: 'diamond',
    body: '#e89a4f', head: '#c76f2c', belly: '#ffe3b0', eye: '#fff',
    spikeStyle: 'double', pattern: 'stripes', tailStyle: 'normal', horn: true, hornColor: '#c76f2c',
    shimmer: true, shimmerColor: '#ffd9a0', shimmerDark: '#c76f2c', affinity: 'shield' },
  { id: 10, name: 'Hantu Kelana', cost: 0, rewardOnly: true, eventOnly: true,
    rewardLabel: 'Hadiah Event Hantu — Misi 2',
    body: '#e6e0f5', head: '#cfc4ea', belly: '#ffffff', eye: '#3a2a5c',
    spikeStyle: 'none', pattern: 'plain', tailStyle: 'wisp', horn: false,
    ghostly: true, affinity: 'ghost' },
];
function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
// Label singkat yang dipakai di kartu Toko biar pemain LANGSUNG tau efek
// bonus skin ini sebelum beli — sebelumnya bonus ini "tersembunyi" total,
// jalan di balik layar tapi gak pernah dijelasin ke pemain sama sekali.
function skinAffinityLabel(affinity) {
  const map = {
    speed: '⚡ Buff Kecepatan +50% lama',
    jump: '🦘 Buff Lompat Tinggi +50% lama',
    coin2x: '🪙 Buff 2x Koin jadi 3x',
    life: '❤️ Buff Nyawa: bonus koin lebih besar',
    magnet: '🧲 Buff Magnet +50% lama',
    slowmo: '🐌 Buff Perlambat +50% lama',
    shield: '🛡 Buff Perisai +50% lama',
    ghost: '👻 Buff Hantu +50% lama',
    all: '★ SEMUA buff +50% lebih kuat'
  };
  return map[affinity] || '';
}
// Versi singkat khusus buat popup pas mulai main (biar gak kepanjangan di layar)
function skinAffinityShortLabel(affinity) {
  if (affinity === 'all') return '★ SEMUA BUFF +50%';
  if (affinity === 'coin2x') return '🪙 2X KOIN → 3X';
  if (affinity === 'life') return '❤ BONUS KOIN NYAWA';
  const b = BUFF_TYPES[affinity];
  return b ? `${b.icon} ${b.label} +50%` : '';
}

/* ===================== FITUR BARU: EFEK JEJAK KAKI (TRAIL) =====================
   Independen dari skin — pemain bisa gonta-ganti warna/bentuk partikel yang
   muncul di belakang dino saat lari, dibeli terpisah pakai koin/berlian. */
const TRAIL_EFFECTS = [
  { id: 0, name: 'Debu Klasik', cost: 0, type: 'dust', color: '#a08a6a' },
  { id: 1, name: 'Api Membara', cost: 60, type: 'flame', color: '#ff7a33', color2: '#ffcf3c' },
  { id: 2, name: 'Kristal Es', cost: 60, type: 'ice', color: '#8fe3ff', color2: '#eafcff' },
  { id: 3, name: 'Bintang Kilau', cost: 90, type: 'star', color: '#ffe36b', color2: '#fff6cf' },
  { id: 4, name: 'Daun Musim Gugur', cost: 90, type: 'leaf', color: '#c98f3f', color2: '#e0b95e' },
  { id: 5, name: 'Petir Elektrik', cost: 50, costType: 'diamond', type: 'electric', color: '#c9a8ff', color2: '#fff' },
  { id: 6, name: 'Gelembung Air', cost: 70, type: 'bubble', color: '#8fd3f0', color2: '#eafcff' },
  { id: 7, name: 'Pelangi Ajaib', cost: 80, costType: 'diamond', type: 'rainbow', color: '#ff6b6b' },
  { id: 8, name: 'Jejak Hantu', cost: 0, rewardOnly: true, eventOnly: true,
    rewardLabel: 'Hadiah Event Hantu — Misi 1',
    type: 'ghost', color: '#b8a6ff', color2: '#f0eaff' },
];
function getTrail(id) { return TRAIL_EFFECTS.find(t => t.id === id) || TRAIL_EFFECTS[0]; }
const RAINBOW_COLORS = ['#ff6b6b', '#ffb238', '#ffe36b', '#7ed957', '#4fd6c8', '#5ec8ff', '#b06fff'];

/* ===================== BUFFS ===================== */
const BUFF_TYPES = {
  speed:  { icon: '⚡', label: 'KECEPATAN',  color: '#ffb238', duration: 300 },
  jump:   { icon: '🦘', label: 'LOMPAT TINGGI', color: '#4fd6c8', duration: 360 },
  coin2x: { icon: '🪙', label: '2X KOIN',    color: '#ffd23c', duration: 420 },
  shield: { icon: '🛡',  label: 'PERISAI',    color: '#5ec8ff', duration: 400 },
  magnet: { icon: '🧲', label: 'MAGNET',     color: '#b06fff', duration: 360 },
  slowmo: { icon: '🐌', label: 'PERLAMBAT WAKTU', color: '#4fe0a0', duration: 260 },
  life:   { icon: '❤',  label: 'NYAWA',      color: '#ff5d7a', duration: 0 },
  ghost:  { icon: '👻', label: 'HANTU',      color: '#b8a6ff', duration: 240 }
};
let activeBuffs = { speed: 0, jump: 0, coin2x: 0, shield: 0, magnet: 0, slowmo: 0, ghost: 0 };
let dinoTrail = [];
let dustParticles = [];
let popups = [];
let sparkles = [];
function spawnSparkles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.4 + Math.random() * 2.6;
    sparkles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 0.6,
      life: 26 + Math.random() * 14,
      maxLife: 40,
      size: 2 + Math.random() * 2.4,
      color
    });
  }
}

function skinAffinityMatches(type) {
  const s = getSkin(data.selectedSkin);
  return s.affinity === type || s.affinity === 'all';
}
function spawnPopup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 55 });
}
function applyBuff(type) {
  const boosted = skinAffinityMatches(type);
  if (type === 'life') {
    if (lives < 3) {
      lives++;
      spawnPopup(dino.x + dino.w / 2, dino.y - 10, boosted ? '+1 NYAWA (BONUS SKIN!)' : '+1 NYAWA', '#ff5d7a');
    } else {
      const bonus = boosted ? 30 : 15;
      runCoins += bonus;
      spawnPopup(dino.x + dino.w / 2, dino.y - 10, `+${bonus} KOIN`, '#ffd23c');
    }
    return;
  }
  const base = BUFF_TYPES[type].duration;
  const dur = boosted ? Math.floor(base * 1.5) : base;
  activeBuffs[type] = Math.max(activeBuffs[type], dur);
  spawnPopup(dino.x + dino.w / 2, dino.y - 10, boosted ? BUFF_TYPES[type].label + ' +50%!' : BUFF_TYPES[type].label, BUFF_TYPES[type].color);
}
function coinMultiplier() {
  if (activeBuffs.coin2x <= 0) return 1;
  return skinAffinityMatches('coin2x') ? 3 : 2;
}
function currentJumpForce() {
  return activeBuffs.jump > 0 ? JUMP_FORCE * 1.35 : JUMP_FORCE;
}
function updateBuffRow() {
  let html = '';
  const boosted = getSkin(data.selectedSkin).affinity;
  for (const key in activeBuffs) {
    if (activeBuffs[key] > 0) {
      const info = BUFF_TYPES[key];
      const full = key === 'coin2x' ? 420 : info.duration;
      const pct = Math.max(0, Math.min(100, (activeBuffs[key] / full) * 100));
      // Chip dikasih tanda bintang ✦ kalau buff ini lagi dapat bonus dari skin
      // yang dipakai — biar pemain kelihatan terus selama buff aktif, bukan
      // cuma lewat popup sekilas pas awal ambil buff.
      const isBoosted = boosted === key || boosted === 'all';
      html += `<div class="buff-chip${isBoosted ? ' boosted' : ''}">${info.icon}${isBoosted ? '<span class="boost-star">✦</span>' : ''}<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${info.color}"></div></div></div>`;
    }
  }
  buffRow.innerHTML = html;
}

/* ===================== MODE (dipakai loop utama, dll) ===================== */
let mode = 'normal'; // 'normal' | 'quest'
let qPaused = false; // dipakai Story Mode buat jeda internal (dialog dsb), terpisah dari `paused` biasa


/* ===================== STORY MODE: KASTIL TUA =====================
   Dino terjebak di kastil tua berisi zombie. Kontrol penuh di tangan
   pemain: joystick analog kiri-kanan + tombol lompat + 3 slot serang
   (cuma slot 1 yang aktif dari awal, 2 lainnya kekunci sampai ketemu
   Mantra Skill). HP 150 bisa nambah lewat Mantra Nyawa. 4 lantai:
   1) zombie biasa, 2) zombie mutasi (lebih besar & sakit), 3) boss
   zombie raksasa sendirian, 4) campuran + vampir + Raja Vampir. */
const CASTLE_ENEMY_DEFS = {
  zombie:      { w: 30, h: 38, hp: 20,  dmg: 8,  speed: 0.55, color: '#5a7a4f', dark: '#33482c', scoreOnKill: 8 },
  zombieBig:   { w: 42, h: 52, hp: 46,  dmg: 14, speed: 0.42, color: '#3f5c33', dark: '#243a1c', scoreOnKill: 16 },
  vampire:     { w: 28, h: 40, hp: 26,  dmg: 11, speed: 0.95, color: '#5a2a3a', dark: '#33141d', scoreOnKill: 14 },
  zombieBoss:  { w: 70, h: 80, hp: 260, dmg: 22, speed: 0.3,  color: '#2e4526', dark: '#182a12', scoreOnKill: 0, isBoss: true, name: 'ZOMBIE RAKSASA' },
  vampireKing: { w: 60, h: 76, hp: 320, dmg: 26, speed: 0.65, color: '#4a1a2a', dark: '#280d17', scoreOnKill: 0, isBoss: true, name: 'RAJA VAMPIR' },
  aurelion:    { w: 58, h: 84, hp: 360, dmg: 20, speed: 0.5,  color: '#eee6d2', dark: '#0d0710', scoreOnKill: 0, isBoss: true, name: 'AURELION — KESOMBONGAN' },
  goldraven:   { w: 74, h: 82, hp: 420, dmg: 18, speed: 0.35, color: '#6b3a12', dark: '#3a1f09', scoreOnKill: 0, isBoss: true, name: 'GOLDRAVEN — KETAMAKAN' }
};
// AURELION bisa "mengubah aturan permainan" — tiap ~5 detik dia acak 1 efek
// yang aktif ~3 detik, bikin pertarungan gak monoton.
const AURELION_RULES = {
  invert:   { label: 'KONTROL DIBALIK 🔄' },
  heavygrav:{ label: 'GRAVITASI BERAT ⬇️' },
  nojump:   { label: 'LOMPAT DIKUNCI 🔒' }
};
const CASTLE_SKILLS = [
  { name: 'Cakar', dmg: 12, range: 40, cooldown: 24, icon: '👊' },
  { name: 'Gigitan', dmg: 20, range: 55, cooldown: 36, icon: '🦷' },
  { name: 'Hantam Ekor', dmg: 32, range: 46, cooldown: 50, icon: '💥' }
];
const CASTLE_FLOORS = [
  null,
  { name: 'Lantai 1 — Aula Bawah', target: 150, pool: ['zombie'], gap: [65, 105] },
  { name: 'Lantai 2 — Ruang Mutasi', target: 220, pool: ['zombieBig'], gap: [85, 130] },
  { name: 'Lantai 3 — Ruang Boss', target: 0, pool: [], isBossFloor: true, bossType: 'zombieBoss' },
  { name: 'Lantai 4 — Puncak Kastil', target: 260, kingTarget: 220, pool: ['zombie', 'zombieBig', 'vampire'], gap: [55, 95] },
  { name: 'Alam Bawah Sadar — AURELION', target: 0, pool: [], isBossFloor: true, bossType: 'aurelion', subconscious: true },
  { name: 'Alam Bawah Sadar — GOLDRAVEN', target: 0, pool: [], isBossFloor: true, bossType: 'goldraven', subconscious: true }
];
let castle = {
  floor: 1, hp: 150, maxHp: 150, score: 0,
  skillsUnlocked: [true, false, false],
  enemies: [], mantras: [],
  boss: null, bossActive: false,
  spawnTimer: 0, nextSpawnGap: 80,
  mantraTimer: 0, nextMantraGap: 260,
  attackCooldowns: [0, 0, 0],
  invincible: 0, analogX: 0, facing: 1, shakeT: 0, completed: false,
  portal: null, floorCleared: false, victoryCutscene: null,
  ruleEffect: null, ruleEffectT: 0, ruleTimer: 0, projectiles: []
};
function castleResetRun() {
  castle = {
    floor: 1, hp: 150, maxHp: 150, score: 0,
    skillsUnlocked: [true, false, false],
    enemies: [], mantras: [],
    boss: null, bossActive: false,
    spawnTimer: 0, nextSpawnGap: 80,
    mantraTimer: 0, nextMantraGap: 260,
    attackCooldowns: [0, 0, 0],
    invincible: 0, analogX: 0, facing: 1, shakeT: 0, completed: false,
    portal: null, floorCleared: false, victoryCutscene: null,
    ruleEffect: null, ruleEffectT: 0, ruleTimer: 0, projectiles: []
  };
}
function castleFloorDef() { return CASTLE_FLOORS[castle.floor]; }
function castleSpawnEnemy(typeOverride) {
  const f = castleFloorDef();
  const type = typeOverride || f.pool[Math.floor(Math.random() * f.pool.length)];
  const def = CASTLE_ENEMY_DEFS[type];
  const fromLeft = Math.random() < 0.5;
  castle.enemies.push({
    type, x: fromLeft ? -40 : VW + 40, y: GROUND_Y - def.h,
    w: def.w, h: def.h, hp: def.hp, maxHp: def.hp,
    dmg: def.dmg, speed: def.speed, atkCooldown: 0, hitFlash: 0, walkFrame: Math.random() * 10
  });
}
function castleSpawnBoss(type) {
  const def = CASTLE_ENEMY_DEFS[type];
  castle.boss = {
    type, x: VW / 2 - def.w / 2, y: GROUND_Y - def.h,
    w: def.w, h: def.h, hp: def.hp, maxHp: def.hp,
    dmg: def.dmg, speed: def.speed, atkCooldown: 0, hitFlash: 0, walkFrame: 0,
    rangedCooldown: 150, absorbT: 0
  };
  castle.bossActive = true;
  bossBarWrap.style.display = 'block';
  bossNameEl.textContent = def.name;
  castleUpdateBossBar();
}
function castleSpawnMantra() {
  const needSkill = castle.skillsUnlocked.includes(false);
  const type = needSkill && Math.random() < 0.5 ? 'skill' : 'hp';
  castle.mantras.push({ type, x: 30 + Math.random() * (VW - 60), y: GROUND_Y - 22, bob: Math.random() * Math.PI * 2 });
}
function castleSpawnPortal() {
  if (castle.portal) return;
  castle.floorCleared = true;
  castle.portal = { x: VW - 56, y: GROUND_Y, r: 30, t: 0 };
  castleToast('🌀 Portal muncul! Masuk portalnya buat lanjut ke lantai berikutnya');
}
function castleAdvanceFloor() {
  castle.floor++;
  castle.score = 0;
  castle.enemies = [];
  castle.boss = null;
  castle.bossActive = false;
  castle.portal = null;
  castle.floorCleared = false;
  bossBarWrap.style.display = 'none';
  castle.spawnTimer = 0;
  if (castle.floor > 4) {
    castleVictory();
    return;
  }
  const f = castleFloorDef();
  castleToast(`🏰 ${f.name}`);
  document.getElementById('castleFloorPill').textContent = `🏰 LANTAI ${castle.floor}`;
  if (f.isBossFloor) castleSpawnBoss(f.bossType);
  data.castleBestFloor = Math.max(data.castleBestFloor || 1, castle.floor);
  saveData();
}
function castleVictory() {
  castle.completed = true;
  state = 'playing';
  data.castleProgress = { completed: true };
  saveData();
  castleStartVictoryCutscene();
}
/* ===================== SINEMATIK KEMENANGAN CHAPTER 1 =====================
   Urutan: Raja Vampir tumbang -> portal raksasa muncul nutupin ruangan ->
   dino kesedot masuk -> animasi terowongan portal -> mendarat di ALAM BAWAH
   SADAR SANG RAJA VAMPIR -> lanjut LANGSUNG ke pertarungan AURELION
   (Chapter 2 Bab 1: Kesombongan). */
function castleStartVictoryCutscene() {
  document.getElementById('castleControls').classList.remove('visible');
  document.getElementById('questHud').style.display = 'none';
  bossBarWrap.style.display = 'none';
  castle.victoryCutscene = {
    phase: 'grow', t: 0,
    portalX: VW / 2, portalY: GROUND_Y - 30,
    dinoStartX: dino.x, dinoStartY: dino.y
  };
  AudioMgr.sfx('unlock');
}
function castleFinishVictoryCutscene() {
  castle.victoryCutscene = null;
  castleStartAurelionFight();
}
function castleStartAurelionFight() {
  castle.floor = 5;
  castle.enemies = [];
  castle.portal = null;
  castle.floorCleared = false;
  castle.ruleEffect = null;
  castle.ruleEffectT = 0;
  castle.ruleTimer = 0;
  document.getElementById('castleFloorPill').textContent = '🌑 ALAM BAWAH SADAR';
  document.getElementById('questHud').style.display = '';
  document.getElementById('castleControls').classList.add('visible');
  castleUpdateHpBar();
  castleToast('👑 AURELION — Manifestasi Kesombongan muncul!');
  castleSpawnBoss('aurelion');
}
function castleStartGoldravenFight() {
  castle.floor = 6;
  castle.enemies = [];
  castle.projectiles = [];
  castle.portal = null;
  castle.floorCleared = false;
  castle.ruleEffect = null;
  castle.ruleEffectT = 0;
  castle.ruleTimer = 0;
  document.getElementById('castleFloorPill').textContent = '🌑 ALAM BAWAH SADAR';
  document.getElementById('questHud').style.display = '';
  document.getElementById('castleControls').classList.add('visible');
  castleUpdateHpBar();
  castleToast('💰 GOLDRAVEN — Manifestasi Ketamakan muncul!');
  castleSpawnBoss('goldraven');
}
function castleShowLore(title, text, onDone) {
  document.getElementById('castleControls').classList.remove('visible');
  document.getElementById('questHud').style.display = 'none';
  bossBarWrap.style.display = 'none';
  storyIcon.textContent = '💭';
  document.getElementById('storyTitle').textContent = title;
  storyText.textContent = text;
  storyOverlay.classList.add('active');
  storyBtn.onclick = () => {
    storyOverlay.classList.remove('active');
    storyBtn.onclick = null;
    if (onDone) onDone();
  };
}
function castleFinishAurelion() {
  castle.boss = null;
  castle.bossActive = false;
  bossBarWrap.style.display = 'none';
  castle.ruleEffect = null;
  AudioMgr.sfx('unlock');
  castleShowLore(
    '💭 KILAS BALIK: KESOMBONGAN',
    'Kesombongan Raja Vampir dimulai saat domain Laut Selatan jatuh ke tangannya. Ia mulai berpikir dirinya telah menjadi penguasa sejati — dan menjadi sombong kepada teman-teman seperjuangannya sendiri.',
    () => {
      castleShowLore(
        '💰 GOLDRAVEN Bangkit!',
        'Manifestasi Ketamakan sang Raja Vampir kini muncul dari bayang-bayang Alam Bawah Sadar...',
        () => { castleStartGoldravenFight(); }
      );
    }
  );
}
function castleFinishGoldraven() {
  castle.boss = null;
  castle.bossActive = false;
  bossBarWrap.style.display = 'none';
  castle.projectiles = [];
  AudioMgr.sfx('unlock');
  castleShowLore(
    '💭 KILAS BALIK: KETAMAKAN',
    'Setelah berhasil menguasai domain selatan, ia menjadi sangat serakah — mengambil semua yang ada di sana, menghancurkannya jika merasa tidak puas, dan selalu mencari yang terbaik.',
    () => {
      castleShowLore(
        '🎭 5 Manifestasi Lain Menanti...',
        'VELARIA (Nafsu) dan 4 manifestasi dosa besar lainnya masih bersembunyi jauh di dalam Alam Bawah Sadar ini.\n\nCOMING SOON — CHAPTER 2 LANJUTAN',
        () => { castleEndGame(true); }
      );
    }
  );
}
function castleUpdateVictoryCutscene() {
  frame++;
  const vc = castle.victoryCutscene;
  vc.t++;
  if (vc.phase === 'grow' && vc.t > 55) { vc.phase = 'suck'; vc.t = 0; }
  else if (vc.phase === 'suck' && vc.t > 50) { vc.phase = 'travel'; vc.t = 0; AudioMgr.sfx('unlock'); }
  else if (vc.phase === 'travel' && vc.t > 100) { vc.phase = 'land'; vc.t = 0; }
  else if (vc.phase === 'land' && vc.t > 65) { vc.phase = 'tomb'; vc.t = 0; }
  else if (vc.phase === 'tomb' && vc.t > 55) { vc.phase = 'text'; vc.t = 0; }
  else if (vc.phase === 'text' && vc.t > 320) { castleFinishVictoryCutscene(); }
}
function castleEaseOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function castleDrawBigPortal(cx, cy, r, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,16,0.4)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.translate(cx, cy);
  const glow = ctx.createRadialGradient(0, 0, Math.max(4, r * 0.2), 0, 0, Math.max(6, r));
  glow.addColorStop(0, 'rgba(184,166,255,0.65)');
  glow.addColorStop(0.7, 'rgba(120,80,220,0.35)');
  glow.addColorStop(1, 'rgba(120,80,220,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const rr = r * (0.9 - i * 0.15);
    if (rr <= 0) continue;
    const ang = t * (i % 2 === 0 ? 0.05 : -0.06) + i;
    ctx.strokeStyle = `rgba(${210 - i * 15},${190 - i * 10},255,${Math.max(0, 0.5 - i * 0.07)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, rr, rr * 0.94, ang, 0, Math.PI * 1.5);
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(4, r * 0.35));
  core.addColorStop(0, '#0d0716');
  core.addColorStop(1, 'rgba(30,18,50,0.85)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(0, 0, Math.max(1, r * 0.35), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function castleDrawVortexTunnel(t) {
  const cx = VW / 2, cy = VH / 2;
  const maxR = Math.max(VW, VH) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, maxR);
  g.addColorStop(0, '#2a1a44'); g.addColorStop(0.5, '#160e28'); g.addColorStop(1, '#050308');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 10; i++) {
    const rr = (t * 3 + i * 38) % maxR;
    const alpha = 0.5 * (1 - rr / maxR);
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(184,166,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.9, t * 0.02, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + t * 0.03;
    const dist = (t * 6 + i * 29) % (maxR * 0.9);
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist * 0.9;
    const alpha = Math.max(0, 1 - dist / (maxR * 0.9));
    ctx.fillStyle = `rgba(230,220,255,${alpha * 0.8})`;
    ctx.beginPath(); ctx.arc(x, y, 2 + alpha * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function castleDrawSubconsciousBackground() {
  // ===== ALAM BAWAH SADAR SANG RAJA VAMPIR =====
  // Latar Chapter 2: bukan makam, tapi ruang batin gelap penuh kabut jiwa &
  // pecahan ingatan. Ada siluet takhta jauh dijaga 6 bayangan (foreshadow
  // 6 manifestasi dosa lain) dan mahkota emas retak melayang (foreshadow AURELION).
  const g = ctx.createRadialGradient(VW * 0.5, VH * 0.35, 10, VW * 0.5, VH * 0.35, Math.max(VW, VH) * 0.9);
  g.addColorStop(0, '#241733'); g.addColorStop(0.55, '#150c20'); g.addColorStop(1, '#050308');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

  // kabut jiwa berlapis, melayang pelan
  for (let layer = 0; layer < 3; layer++) {
    ctx.save();
    ctx.globalAlpha = 0.10 + layer * 0.05;
    ctx.fillStyle = layer % 2 === 0 ? '#7a5bd6' : '#3f2a63';
    const wob = Math.sin(frame * 0.006 + layer) * 20;
    ctx.beginPath();
    ctx.ellipse(VW * 0.5 + wob, GROUND_Y * (0.4 + layer * 0.16), VW * 0.75, 46 + layer * 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // siluet takhta jauh + 6 bayangan penjaga (foreshadow 6 manifestasi dosa lain)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#0a0610';
  roundRectPath(ctx, VW * 0.44, GROUND_Y - 58, VW * 0.12, 50, 4);
  ctx.fill();
  ctx.fillRect(VW * 0.47, GROUND_Y - 78, VW * 0.06, 24);
  for (let i = 0; i < 6; i++) {
    const gx = VW * (0.14 + i * 0.145);
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#0a0610';
    ctx.beginPath();
    ctx.ellipse(gx, GROUND_Y - 20, 9, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.arc(gx, GROUND_Y - 40, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7 + Math.sin(frame * 0.05 + i) * 0.2;
    ctx.fillStyle = '#ff3b4d';
    ctx.beginPath(); ctx.arc(gx - 2, GROUND_Y - 41, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 2, GROUND_Y - 41, 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // mahkota emas retak melayang (foreshadow AURELION - Kesombongan)
  ctx.save();
  const cx = VW * 0.5, cy = VH * 0.15 + Math.sin(frame * 0.02) * 6;
  ctx.globalAlpha = 0.55;
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(frame * 0.008) * 0.06);
  ctx.strokeStyle = '#e8c15c'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-20, 8); ctx.lineTo(-20, -4); ctx.lineTo(-12, -14); ctx.lineTo(-4, -2);
  ctx.lineTo(0, -16); ctx.lineTo(4, -2); ctx.lineTo(12, -14); ctx.lineTo(20, -4); ctx.lineTo(20, 8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,10,10,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(2, 6); ctx.stroke(); // retakan
  ctx.restore();

  // lantai bawah sadar: pecahan kaca ingatan melayang, bukan lantai batu padat
  ctx.fillStyle = 'rgba(10,6,16,0.55)';
  ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
  for (let i = 0; i < 10; i++) {
    const x = (i * 61 + frame * 0.2) % VW;
    const y = GROUND_Y + 10 + (i * 13) % (VH - GROUND_Y - 10);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(x, y);
    ctx.rotate(i);
    ctx.fillStyle = '#b8a6ff';
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // partikel jiwa melayang naik
  ctx.fillStyle = 'rgba(200,190,255,0.25)';
  for (let i = 0; i < 16; i++) {
    const x = (i * 47 + Math.sin(frame * 0.02 + i) * 12) % VW;
    const y = GROUND_Y - ((frame * 0.6 + i * 40) % (GROUND_Y - 10));
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}
function castleDrawLandingDust(x, y, p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - p);
  ctx.fillStyle = 'rgba(200,190,180,0.5)';
  for (let i = 0; i < 8; i++) {
    const dist = p * 30;
    const dx = (i % 2 === 0 ? 1 : -1) * (dist + i * 2);
    ctx.beginPath(); ctx.arc(x + dx, y - p * 8, 3 + p * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function castleDrawComingSoonText(t) {
  const p = Math.min(1, t / 40);
  const ease = castleEaseOutCubic(p);
  ctx.save();
  ctx.globalAlpha = ease;
  ctx.translate(VW / 2, VH * 0.26);
  ctx.scale(0.7 + ease * 0.3, 0.7 + ease * 0.3);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(184,166,255,0.9)'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#e8d9ff';
  ctx.font = "bold 15px 'Baloo 2', sans-serif";
  ctx.fillText('👑 KASTIL TAMAT 👑', 0, -40);
  ctx.font = "11px 'Baloo 2', sans-serif";
  ctx.fillStyle = 'rgba(184,166,255,0.85)';
  ctx.fillText('ALAM BAWAH SADAR SANG RAJA VAMPIR', 0, -20);
  ctx.font = "bold 20px 'Baloo 2', sans-serif";
  ctx.fillStyle = '#fff3b0';
  ctx.fillText('CHAPTER 2 DIMULAI', 0, 8);
  ctx.font = "bold 15px 'Baloo 2', sans-serif";
  ctx.fillStyle = '#ff8a8a';
  ctx.fillText('BAB 1: KESOMBONGAN', 0, 30);
  ctx.restore();
  if (t > 70) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(t * 0.08) * 0.25;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = "11px 'Baloo 2', sans-serif";
    ctx.fillText('(ketuk layar buat lanjut)', VW / 2, VH * 0.26 + 60);
    ctx.restore();
  }
}
function castleDrawVictoryCutscene() {
  const vc = castle.victoryCutscene;
  const s = getSkin(data.selectedSkin);
  if (vc.phase === 'grow') {
    castleDrawBackground();
    const p = Math.min(1, vc.t / 55);
    const r = castleEaseOutCubic(p) * Math.max(VW, VH) * 0.75;
    castleDrawBigPortal(vc.portalX, vc.portalY, r, vc.t);
    drawDinoShape(ctx, dino.x, dino.y, dino.w, dino.h, s, false, frame, 1);
  } else if (vc.phase === 'suck') {
    castleDrawBackground();
    castleDrawBigPortal(vc.portalX, vc.portalY, Math.max(VW, VH) * 0.75, vc.t);
    const p = Math.min(1, vc.t / 50);
    const ease = castleEaseOutCubic(p);
    const dx = vc.dinoStartX + (vc.portalX - dino.w / 2 - vc.dinoStartX) * ease;
    const dy = vc.dinoStartY + (vc.portalY - dino.h / 2 - vc.dinoStartY) * ease;
    const scale = 1 - ease * 0.85;
    const alpha = Math.max(0, 1 - ease * 0.9);
    ctx.save();
    ctx.translate(dx + dino.w / 2, dy + dino.h / 2);
    ctx.scale(scale, scale);
    drawDinoShape(ctx, -dino.w / 2, -dino.h / 2, dino.w, dino.h, s, false, frame, alpha);
    ctx.restore();
  } else if (vc.phase === 'travel') {
    castleDrawVortexTunnel(vc.t);
  } else if (vc.phase === 'land') {
    castleDrawSubconsciousBackground();
    const p = Math.min(1, vc.t / 65);
    if (p < 0.4) {
      ctx.save(); ctx.globalAlpha = 1 - p / 0.4; castleDrawVortexTunnel(999); ctx.restore();
    }
    const fallP = Math.min(1, vc.t / 50);
    const ease = castleEaseOutCubic(fallP);
    const dy = -60 + ease * 60;
    ctx.save();
    ctx.globalAlpha = Math.min(1, vc.t / 15);
    drawDinoShape(ctx, VW / 2 - dino.w / 2, GROUND_Y - dino.h + dy, dino.w, dino.h, s, false, frame, 1);
    ctx.restore();
    if (fallP > 0.85) castleDrawLandingDust(VW / 2, GROUND_Y, (fallP - 0.85) / 0.15);
  } else if (vc.phase === 'tomb') {
    castleDrawSubconsciousBackground();
    drawDinoShape(ctx, VW / 2 - dino.w / 2, GROUND_Y - dino.h, dino.w, dino.h, s, false, frame, 1);
  } else if (vc.phase === 'text') {
    castleDrawSubconsciousBackground();
    drawDinoShape(ctx, VW / 2 - dino.w / 2, GROUND_Y - dino.h, dino.w, dino.h, s, false, frame, 1);
    castleDrawComingSoonText(vc.t);
  }
}
function castleToast(text) {
  skillToast.textContent = text;
  skillToast.classList.add('show');
  clearTimeout(skillToast._t);
  skillToast._t = setTimeout(() => skillToast.classList.remove('show'), 2400);
}
function castleUpdateHpBar() {
  const pct = Math.max(0, castle.hp / castle.maxHp * 100);
  document.getElementById('castleHpFill').style.width = pct + '%';
  document.getElementById('castleHpFill').style.background = pct < 25 ? '#e5484d' : pct < 55 ? '#ffb84d' : '#5cd65c';
  document.getElementById('castleHpText').textContent = `${Math.max(0, Math.round(castle.hp))}/${castle.maxHp}`;
}
function castleUpdateProgress() {
  const f = castleFloorDef();
  const label = document.getElementById('castleProgressLabel');
  const fill = document.getElementById('castleProgressFill');
  if (castle.floorCleared && castle.portal) {
    label.textContent = '🌀 Masuk portal buat lanjut!';
    fill.style.width = '100%';
    return;
  }
  if (f.isBossFloor) {
    label.textContent = castle.boss ? `Kalahkan ${CASTLE_ENEMY_DEFS[f.bossType].name}!` : '';
    fill.style.width = castle.boss ? `${100 - (castle.boss.hp / castle.boss.maxHp * 100)}%` : '0%';
  } else if (castle.floor === 4 && castle.bossActive) {
    label.textContent = 'Kalahkan RAJA VAMPIR!';
    fill.style.width = castle.boss ? `${100 - (castle.boss.hp / castle.boss.maxHp * 100)}%` : '0%';
  } else {
    const target = castle.floor === 4 ? f.kingTarget : f.target;
    label.textContent = `Bertahan: ${Math.min(castle.score, target)}/${target}`;
    fill.style.width = `${Math.min(100, castle.score / target * 100)}%`;
  }
}
function castleUpdateBossBar() {
  if (!castle.boss) return;
  bossBarFill.style.width = Math.max(0, castle.boss.hp / castle.boss.maxHp * 100) + '%';
}
function castleUpdateSkillButtons() {
  for (let i = 0; i < 3; i++) {
    const btn = document.getElementById('castleAtk' + i);
    if (castle.skillsUnlocked[i]) {
      btn.classList.remove('locked');
      btn.textContent = CASTLE_SKILLS[i].icon;
    } else {
      btn.classList.add('locked');
      btn.textContent = '🔒';
    }
  }
}
function castleAttack(slot) {
  if (state !== 'playing' || mode !== 'quest' || paused || castle.victoryCutscene) return;
  if (!castle.skillsUnlocked[slot]) return;
  if (castle.attackCooldowns[slot] > 0) return;
  const sk = CASTLE_SKILLS[slot];
  castle.attackCooldowns[slot] = sk.cooldown;
  AudioMgr.sfx('hit');
  const cx = dino.x + dino.w / 2;
  const targets = castle.boss ? [castle.boss] : castle.enemies;
  let hitAny = false;
  targets.forEach(e => {
    const ecx = e.x + e.w / 2;
    if (Math.abs(ecx - cx) <= sk.range) {
      e.hp -= sk.dmg;
      e.hitFlash = 8;
      hitAny = true;
    }
  });
  if (hitAny) { dino.attackFlashT = 6; }
}
function castleTakeDamage(amount) {
  if (castle.invincible > 0) return;
  castle.hp -= amount;
  castle.invincible = 45;
  castle.shakeT = 10;
  AudioMgr.sfx('hit');
  if (castle.hp <= 0) { castle.hp = 0; castleEndGame(false); }
}
function castleEndGame(victory) {
  state = 'gameover';
  document.getElementById('goStatsNormal').style.display = 'none';
  document.getElementById('goStatsQuest').style.display = '';
  const aurelionDone = victory && castle.floor === 5;
  const goldravenDone = victory && castle.floor === 6;
  document.getElementById('goTitle').textContent = victory ? (goldravenDone ? '💰 GOLDRAVEN TUMBANG!' : aurelionDone ? '👑 AURELION TUMBANG!' : '👑 KASTIL TAMAT!') : '💀 TERTUMBANG DI KASTIL';
  document.getElementById('goTitle').classList.toggle('new-best', victory);
  document.getElementById('goAge').textContent = victory ? (goldravenDone ? '6 (Alam Bawah Sadar)' : aurelionDone ? '5 (Alam Bawah Sadar)' : '4 (Tamat)') : String(castle.floor);
  document.getElementById('goMap').textContent = victory ? (goldravenDone ? 'Manifestasi ke-2 Tumbang!' : aurelionDone ? 'Manifestasi ke-1 Tumbang!' : 'Raja Vampir Tumbang!') : (CASTLE_FLOORS[castle.floor] ? CASTLE_FLOORS[castle.floor].name : '-');
  showScreen('gameover');
}
function castleUpdate() {
  if (castle.victoryCutscene) { castleUpdateVictoryCutscene(); return; }
  frame++;
  const f = castleFloorDef();
  if (castle.invincible > 0) castle.invincible--;
  if (castle.shakeT > 0) castle.shakeT--;
  for (let i = 0; i < 3; i++) if (castle.attackCooldowns[i] > 0) castle.attackCooldowns[i]--;

  // gerak dino via joystick analog — AURELION bisa "membalik" arah kontrol
  const effX = castle.ruleEffect === 'invert' ? -castle.analogX : castle.analogX;
  dino.x += effX * 3.4;
  dino.x = Math.max(8, Math.min(VW - dino.w - 8, dino.x));
  if (effX > 0.05) castle.facing = 1;
  else if (effX < -0.05) castle.facing = -1;
  if (dino.jumping) {
    dino.vy += (castle.ruleEffect === 'heavygrav' ? GRAVITY * 2.2 : GRAVITY);
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - dino.h) { dino.y = GROUND_Y - dino.h; dino.jumping = false; dino.vy = 0; }
  }

  // AURELION: tiap ~5 detik acak 1 "aturan permainan" baru selama boss dia masih hidup
  if (castle.boss && castle.boss.type === 'aurelion') {
    if (castle.ruleEffect) {
      castle.ruleEffectT--;
      if (castle.ruleEffectT <= 0) castle.ruleEffect = null;
    } else {
      castle.ruleTimer++;
      if (castle.ruleTimer > 300) {
        castle.ruleTimer = 0;
        const keys = Object.keys(AURELION_RULES);
        const pick = keys[Math.floor(Math.random() * keys.length)];
        castle.ruleEffect = pick;
        castle.ruleEffectT = 170;
        castleToast(`👑 AURELION mengubah aturan: ${AURELION_RULES[pick].label}`);
        AudioMgr.sfx('unlock');
      }
    }
  }

  // spawn musuh biasa (non-boss floor, atau floor 4 sebelum raja muncul) — berhenti kalau lantai sudah clear/portal aktif
  if (!f.isBossFloor && !castle.bossActive && !castle.floorCleared) {
    castle.spawnTimer++;
    if (castle.spawnTimer > castle.nextSpawnGap) {
      castleSpawnEnemy();
      castle.spawnTimer = 0;
      castle.nextSpawnGap = f.gap[0] + Math.random() * (f.gap[1] - f.gap[0]);
    }
  }
  // spawn mantra (juga berhenti kalau lantai sudah clear)
  if (!castle.floorCleared) {
    castle.mantraTimer++;
    if (castle.mantraTimer > castle.nextMantraGap) {
      castleSpawnMantra();
      castle.mantraTimer = 0;
      castle.nextMantraGap = 300 + Math.random() * 220;
    }
  }

  // update musuh biasa
  const cx = dino.x + dino.w / 2;
  castle.enemies.forEach(e => {
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.atkCooldown > 0) e.atkCooldown--;
    const ecx = e.x + e.w / 2;
    if (Math.abs(ecx - cx) > 22) {
      e.x += ecx < cx ? e.speed : -e.speed;
      e.walkFrame += 0.15;
    } else if (e.atkCooldown <= 0) {
      castleTakeDamage(e.dmg);
      e.atkCooldown = 70;
    }
  });
  const deadEnemies = castle.enemies.filter(e => e.hp <= 0);
  if (deadEnemies.length) {
    deadEnemies.forEach(e => { castle.score += CASTLE_ENEMY_DEFS[e.type].scoreOnKill; AudioMgr.sfx('coin'); });
    castle.enemies = castle.enemies.filter(e => e.hp > 0);
  }

  // update boss
  if (castle.boss) {
    const b = castle.boss;
    if (b.hitFlash > 0) b.hitFlash--;
    if (b.atkCooldown > 0) b.atkCooldown--;
    const bcx = b.x + b.w / 2;
    if (Math.abs(bcx - cx) > 30) {
      b.x += bcx < cx ? b.speed : -b.speed;
      b.walkFrame += 0.1;
    } else if (b.atkCooldown <= 0) {
      castleTakeDamage(b.dmg);
      b.atkCooldown = 85;
    }
    // GOLDRAVEN: menyerap "harta" di sekitar arena, lalu melontarkannya balik
    // sebagai proyektil ke dino — musuh jarak jauh pertama di Kastil.
    if (b.type === 'goldraven') {
      if (b.absorbT > 0) b.absorbT--;
      b.rangedCooldown--;
      if (b.rangedCooldown <= 0) {
        b.rangedCooldown = 210;
        b.absorbT = 26;
        const bx = b.x + b.w / 2, by = b.y + b.h * 0.32;
        const tx = dino.x + dino.w / 2, ty = dino.y + dino.h / 2;
        const dx = tx - bx, dy = ty - by;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const spd = 3.1;
        castle.projectiles.push({ x: bx, y: by, vx: dx / dist * spd, vy: dy / dist * spd, dmg: 14, life: 160 });
        castleToast('💰 GOLDRAVEN melontarkan hartanya!');
        AudioMgr.sfx('coin');
      }
    }
    castleUpdateBossBar();
    if (b.hp <= 0) {
      AudioMgr.sfx('unlock');
      castle.boss = null;
      castle.bossActive = false;
      bossBarWrap.style.display = 'none';
      if (b.type === 'aurelion') {
        castleFinishAurelion();
        castleUpdateHpBar();
        castleUpdateProgress();
        return;
      } else if (b.type === 'goldraven') {
        castleFinishGoldraven();
        castleUpdateHpBar();
        castleUpdateProgress();
        return;
      } else if (f.isBossFloor) {
        castleSpawnPortal();
      } else {
        castleVictory();
        // Stop di sini — kalau lanjut ke bawah, blok "trigger Raja Vampir di lantai 4"
        // bakal langsung ngecek lagi di frame yang SAMA. Karena castle.score masih
        // >= kingTarget (belum direset) dan castle.bossActive baru aja jadi false,
        // kondisinya ke-anggap "belum ada raja" -> RAJA VAMPIR KE-SPAWN ULANG full HP,
        // itu sebabnya HP bar-nya nongol lagi dan gak pernah hilang selama animasi.
        castleUpdateHpBar();
        castleUpdateProgress();
        return;
      }
    }
  }

  // update proyektil (dipakai GOLDRAVEN & boss-boss jarak jauh berikutnya)
  if (castle.projectiles.length) {
    const dcx = dino.x + dino.w / 2, dcy = dino.y + dino.h / 2;
    for (let i = castle.projectiles.length - 1; i >= 0; i--) {
      const p = castle.projectiles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      const dist = Math.hypot(p.x - dcx, p.y - dcy);
      if (dist < 18) {
        castleTakeDamage(p.dmg);
        castle.projectiles.splice(i, 1);
      } else if (p.life <= 0 || p.x < -50 || p.x > VW + 50 || p.y < -50 || p.y > VH + 50) {
        castle.projectiles.splice(i, 1);
      }
    }
  }

  // trigger Raja Vampir di lantai 4 (dijaga: jangan spawn lagi kalau Kastil sudah tamat)
  if (castle.floor === 4 && !castle.completed && !castle.bossActive && castle.score >= f.kingTarget) {
    castle.enemies = [];
    castleSpawnBoss('vampireKing');
  }

  // pickup mantra
  castle.mantras.forEach(m => { m.bob += 0.08; });
  castle.mantras = castle.mantras.filter(m => {
    const dx = (m.x) - cx, dy = (m.y) - (dino.y + dino.h / 2);
    if (Math.sqrt(dx * dx + dy * dy) < 26) {
      if (m.type === 'hp') {
        castle.maxHp += 20;
        castle.hp = Math.min(castle.maxHp, castle.hp + 45);
        castleToast('❤ Mantra Nyawa! Max HP +20');
      } else {
        const idx = castle.skillsUnlocked.indexOf(false);
        if (idx !== -1) {
          castle.skillsUnlocked[idx] = true;
          castleUpdateSkillButtons();
          castleToast(`✨ Mantra Skill! ${CASTLE_SKILLS[idx].name} terbuka!`);
        } else {
          castle.maxHp += 10; castle.hp = Math.min(castle.maxHp, castle.hp + 20);
          castleToast('❤ Mantra Nyawa! Max HP +10');
        }
      }
      data.castleMantraCount = (data.castleMantraCount || 0) + 1;
      saveData();
      AudioMgr.sfx('unlock');
      return false;
    }
    return true;
  });

  // munculkan portal kalau skor target tercapai (bukan boss floor, bukan lagi lawan raja)
  if (!f.isBossFloor && !castle.bossActive && !castle.floorCleared && castle.score >= f.target) {
    castleSpawnPortal();
  }

  // cek dino masuk portal -> baru pindah lantai
  if (castle.portal) {
    castle.portal.t += 0.06;
    const pdx = castle.portal.x - cx, pdy = (castle.portal.y - 30) - (dino.y + dino.h / 2);
    if (Math.sqrt(pdx * pdx + pdy * pdy) < 30) {
      AudioMgr.sfx('unlock');
      castleAdvanceFloor();
    }
  }

  castleUpdateHpBar();
  castleUpdateProgress();
}
function castleDrawZombieBody(e, def, flash) {
  const w = e.w, h = e.h;
  const limp = Math.sin(e.walkFrame) * 0.12; // kepala/badan miring dikit tiap langkah, kesan pincang
  // bayangan tanah
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.42, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  // lengan menjuntai ke depan (khas zombie)
  ctx.strokeStyle = flash ? '#ffdddd' : def.dark;
  ctx.lineWidth = Math.max(3, w * 0.13);
  ctx.lineCap = 'round';
  const armSwing = Math.sin(e.walkFrame * 0.7) * 3;
  ctx.beginPath(); ctx.moveTo(-w * 0.36, -h * 0.62); ctx.lineTo(-w * 0.58, -h * 0.32 + armSwing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.36, -h * 0.62); ctx.lineTo(w * 0.58, -h * 0.3 - armSwing); ctx.stroke();

  // torso robek compang-camping di bagian bawah
  ctx.save();
  ctx.rotate(limp * 0.3);
  ctx.fillStyle = flash ? '#ffdddd' : def.color;
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, -h * 0.72);
  ctx.lineTo(w * 0.46, -h * 0.72);
  ctx.lineTo(w * 0.46, -h * 0.22);
  ctx.lineTo(w * 0.30, -h * 0.02);
  ctx.lineTo(w * 0.12, -h * 0.24);
  ctx.lineTo(-w * 0.04, 0);
  ctx.lineTo(-w * 0.26, -h * 0.2);
  ctx.lineTo(-w * 0.46, -h * 0.02);
  ctx.closePath();
  ctx.fill();
  // bercak luka/decay
  ctx.fillStyle = flash ? '#ffeeee' : 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(-w * 0.14, -h * 0.5, w * 0.09, h * 0.06, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 0.18, -h * 0.35, w * 0.07, h * 0.05, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // kepala miring, rahang menganga
  ctx.save();
  ctx.translate(w * 0.05 * Math.sin(e.walkFrame * 0.5), -h * 0.85);
  ctx.rotate(limp);
  ctx.fillStyle = flash ? '#ffffff' : def.color;
  ctx.beginPath(); ctx.arc(0, 0, w * 0.32, 0.15, Math.PI * 2 - 0.15); ctx.fill();
  // rahang bawah terbuka
  ctx.fillStyle = flash ? '#ffdddd' : def.dark;
  ctx.beginPath(); ctx.ellipse(0, w * 0.2, w * 0.16, w * 0.12, 0, 0, Math.PI); ctx.fill();
  // mata satu sipit satu melotot
  ctx.fillStyle = '#c9ffb0';
  ctx.beginPath(); ctx.arc(-w * 0.12, -w * 0.04, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.13, -w * 0.02, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (def.isBoss) {
    ctx.strokeStyle = '#ffd63c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.34 + 5, 0, Math.PI * 2); ctx.stroke();
  }
}
function castleDrawVampireBody(e, def, flash) {
  const w = e.w, h = e.h;
  const sway = Math.sin(e.walkFrame * 0.5) * 0.08;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.42, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  // jubah lebar mengembang di belakang badan
  ctx.save();
  ctx.rotate(sway * 0.4);
  const capeFlare = 1 + Math.sin(e.walkFrame * 0.6) * 0.06;
  ctx.fillStyle = flash ? '#ffdddd' : def.dark;
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, -h * 0.7);
  ctx.lineTo(-w * 0.98 * capeFlare, -h * 0.15);
  ctx.lineTo(-w * 0.7, h * 0.02);
  ctx.lineTo(-w * 0.2, -h * 0.12);
  ctx.lineTo(-w * 0.2, -h * 0.02);
  ctx.lineTo(0, -h * 0.1);
  ctx.lineTo(w * 0.2, -h * 0.02);
  ctx.lineTo(w * 0.2, -h * 0.12);
  ctx.lineTo(w * 0.7, h * 0.02);
  ctx.lineTo(w * 0.98 * capeFlare, -h * 0.15);
  ctx.lineTo(w * 0.28, -h * 0.7);
  ctx.closePath();
  ctx.fill();
  // lapisan dalam jubah warna merah
  ctx.fillStyle = 'rgba(180,30,50,0.55)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, -h * 0.62); ctx.lineTo(-w * 0.55, -h * 0.1); ctx.lineTo(0, -h * 0.05); ctx.lineTo(w * 0.55, -h * 0.1); ctx.lineTo(w * 0.22, -h * 0.62);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // badan ramping berjas
  ctx.fillStyle = flash ? '#ffffff' : def.color;
  roundRectPath(ctx, -w * 0.3, -h * 0.75, w * 0.6, h * 0.55, w * 0.16);
  ctx.fill();
  // kerah tinggi runcing di leher
  ctx.fillStyle = flash ? '#ffdddd' : def.dark;
  ctx.beginPath(); ctx.moveTo(-w * 0.28, -h * 0.7); ctx.lineTo(-w * 0.08, -h * 0.92); ctx.lineTo(-w * 0.08, -h * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.28, -h * 0.7); ctx.lineTo(w * 0.08, -h * 0.92); ctx.lineTo(w * 0.08, -h * 0.6); ctx.closePath(); ctx.fill();

  // kepala pucat + rambut klimis poni-V + mata merah menyala + taring
  ctx.save();
  ctx.translate(0, -h * 0.88);
  ctx.rotate(sway);
  ctx.fillStyle = flash ? '#ffffff' : '#e8d6d0';
  ctx.beginPath(); ctx.arc(0, 0, w * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffdddd' : def.dark;
  ctx.beginPath();
  ctx.arc(0, -w * 0.02, w * 0.32, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -w * 0.06); ctx.lineTo(-w * 0.05, w * 0.06); ctx.lineTo(w * 0.05, w * 0.06); ctx.closePath(); ctx.fill();
  ctx.shadowColor = '#ff3b4d'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ff3b4d';
  ctx.beginPath(); ctx.arc(-w * 0.11, -w * 0.02, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.11, -w * 0.02, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-w * 0.08, w * 0.1); ctx.lineTo(-w * 0.05, w * 0.18); ctx.lineTo(-w * 0.02, w * 0.1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.08, w * 0.1); ctx.lineTo(w * 0.05, w * 0.18); ctx.lineTo(w * 0.02, w * 0.1); ctx.closePath(); ctx.fill();
  ctx.restore();

  if (def.isBoss) {
    ctx.strokeStyle = '#ffd63c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -h * 0.85, w * 0.34 + 5, 0, Math.PI * 2); ctx.stroke();
  }
}
function castleDrawAurelionBody(e, def, flash) {
  const w = e.w, h = e.h;
  const sway = Math.sin(e.walkFrame * 0.4) * 0.05;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.44, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  // jubah hitam panjang mengembang di belakang
  ctx.save();
  ctx.rotate(sway * 0.3);
  ctx.fillStyle = flash ? '#ffdddd' : '#0d0710';
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, -h * 0.66);
  ctx.lineTo(-w * 0.64, h * 0.04);
  ctx.lineTo(-w * 0.2, -h * 0.1);
  ctx.lineTo(0, -h * 0.02);
  ctx.lineTo(w * 0.2, -h * 0.1);
  ctx.lineTo(w * 0.64, h * 0.04);
  ctx.lineTo(w * 0.34, -h * 0.66);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // pedang besar "Vanity" terselip di punggung
  ctx.save();
  ctx.translate(w * 0.36, -h * 0.55);
  ctx.rotate(0.55);
  ctx.fillStyle = '#cfd6e0';
  ctx.fillRect(-3, -h * 0.5, 6, h * 0.5);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(-10, -2, 20, 6);
  ctx.restore();

  // armor putih-keemasan
  ctx.fillStyle = flash ? '#ffffff' : '#eee6d2';
  roundRectPath(ctx, -w * 0.3, -h * 0.78, w * 0.6, h * 0.58, w * 0.14);
  ctx.fill();
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2;
  ctx.strokeRect(-w * 0.3 + 3, -h * 0.78 + 4, w * 0.6 - 6, h * 0.58 - 8);

  // kepala datar sombong + mahkota emas retak
  ctx.save();
  ctx.translate(0, -h * 0.9);
  ctx.rotate(sway);
  ctx.fillStyle = flash ? '#ffffff' : '#e8d6c8';
  ctx.beginPath(); ctx.arc(0, 0, w * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2e26'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-w * 0.08, w * 0.1); ctx.lineTo(w * 0.08, w * 0.1); ctx.stroke();
  ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ff3b3b';
  ctx.beginPath(); ctx.arc(-w * 0.1, -w * 0.02, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.1, -w * 0.02, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8c15c';
  ctx.beginPath();
  ctx.moveTo(-w * 0.26, -w * 0.22); ctx.lineTo(-w * 0.26, -w * 0.34); ctx.lineTo(-w * 0.14, -w * 0.44);
  ctx.lineTo(-w * 0.05, -w * 0.3); ctx.lineTo(0, -w * 0.48); ctx.lineTo(w * 0.05, -w * 0.3);
  ctx.lineTo(w * 0.14, -w * 0.44); ctx.lineTo(w * 0.26, -w * 0.34); ctx.lineTo(w * 0.26, -w * 0.22);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-w * 0.05, -w * 0.36); ctx.lineTo(w * 0.03, -w * 0.24); ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = '#ffd63c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -h * 0.9, w * 0.34 + 6, 0, Math.PI * 2); ctx.stroke();
}
function castleDrawGoldravenBody(e, def, flash) {
  const w = e.w, h = e.h;
  const sway = Math.sin(e.walkFrame * 0.3) * 0.04;
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.46, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  // tubuh besar berarmor kerajaan
  ctx.save();
  ctx.rotate(sway * 0.2);
  ctx.fillStyle = flash ? '#ffffff' : '#5a2f0a';
  roundRectPath(ctx, -w * 0.4, -h * 0.76, w * 0.8, h * 0.6, w * 0.16);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#e8c15c'; ctx.lineWidth = 3;
  ctx.strokeRect(-w * 0.4 + 4, -h * 0.76 + 5, w * 0.8 - 8, h * 0.6 - 10);

  // perhiasan: koin, permata, emas nempel di sekujur badan
  const jewelColors = ['#ff5d5d', '#5dc7ff', '#7ee696', '#ffd63c'];
  for (let i = 0; i < 7; i++) {
    const jx = -w * 0.3 + (i % 3) * w * 0.3 + (i >= 3 ? w * 0.06 : 0);
    const jy = -h * 0.6 + Math.floor(i / 3) * h * 0.2;
    ctx.fillStyle = jewelColors[i % jewelColors.length];
    ctx.beginPath(); ctx.arc(jx, jy, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  // pundak emas besar (pauldron)
  ctx.fillStyle = '#e8c15c';
  ctx.beginPath(); ctx.arc(-w * 0.4, -h * 0.72, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.4, -h * 0.72, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5d5d';
  ctx.beginPath(); ctx.arc(-w * 0.4, -h * 0.72, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.4, -h * 0.72, 3, 0, Math.PI * 2); ctx.fill();

  // kepala tamak + mahkota kecil bergerigi emas
  ctx.save();
  ctx.translate(0, -h * 0.9);
  ctx.rotate(sway);
  ctx.fillStyle = flash ? '#ffffff' : '#c88a52';
  ctx.beginPath(); ctx.arc(0, 0, w * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff3b3b';
  ctx.beginPath(); ctx.arc(-w * 0.09, -w * 0.02, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.09, -w * 0.02, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c15c';
  ctx.fillRect(-w * 0.2, -w * 0.32, w * 0.4, 6);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.16 + i * w * 0.16, -w * 0.32);
    ctx.lineTo(-w * 0.16 + i * w * 0.16 + w * 0.05, -w * 0.44);
    ctx.lineTo(-w * 0.16 + i * w * 0.16 + w * 0.1, -w * 0.32);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // efek "menyerap harta" — cincin cahaya emas berkedip pas dia mau nembak
  if (e.absorbT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, e.absorbT / 26) * 0.7;
    ctx.strokeStyle = '#ffd63c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -h * 0.5, w * 0.55 + (26 - e.absorbT) * 1.8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = '#ffd63c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -h * 0.9, w * 0.34 + 8, 0, Math.PI * 2); ctx.stroke();
}
function castleDrawProjectile(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(frame * 0.25);
  ctx.shadowColor = 'rgba(255,214,60,0.8)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffd63c';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff8d0';
  ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function castleDrawEnemy(e) {
  const def = CASTLE_ENEMY_DEFS[e.type];
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  const bob = Math.sin(e.walkFrame) * 2;
  ctx.translate(0, bob);
  const flash = e.hitFlash > 0;
  if (e.type === 'aurelion') {
    castleDrawAurelionBody(e, def, flash);
  } else if (e.type === 'goldraven') {
    castleDrawGoldravenBody(e, def, flash);
  } else if (e.type === 'vampire' || e.type === 'vampireKing') {
    castleDrawVampireBody(e, def, flash);
  } else {
    castleDrawZombieBody(e, def, flash);
  }
  // health mini-bar per musuh biasa (bukan boss, boss pakai bar besar terpisah)
  if (!def.isBoss) {
    const bw = e.w;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-bw / 2, -e.h - 10, bw, 3);
    ctx.fillStyle = '#5cd65c'; ctx.fillRect(-bw / 2, -e.h - 10, bw * Math.max(0, e.hp / e.maxHp), 3);
  }
  ctx.restore();
}
function castleDrawMantra(m) {
  ctx.save();
  ctx.translate(m.x, m.y + Math.sin(m.bob) * 4);
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = m.type === 'hp' ? 'rgba(255,90,110,0.8)' : 'rgba(184,166,255,0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText(m.type === 'hp' ? '❤' : '✨', 0, 0);
  ctx.restore();
}
function castleDrawPortal(p) {
  ctx.save();
  ctx.translate(p.x, p.y - 36);
  const pulse = 1 + Math.sin(p.t * 3) * 0.06;
  ctx.scale(pulse, pulse);
  // cahaya luar
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  glow.addColorStop(0, 'rgba(184,166,255,0.55)');
  glow.addColorStop(1, 'rgba(184,166,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
  // gerbang batu
  ctx.strokeStyle = '#2a1f38'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 36, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#4a3860'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 36, 0, 0, Math.PI * 2); ctx.stroke();
  // pusaran ungu berputar
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 32, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#160e22'; ctx.fillRect(-24, -34, 48, 68);
  for (let i = 0; i < 4; i++) {
    const ang = p.t * (i % 2 === 0 ? 1.4 : -1.6) + i * 1.6;
    const grd = ctx.createLinearGradient(-22, 0, 22, 0);
    grd.addColorStop(0, 'rgba(184,166,255,0)');
    grd.addColorStop(0.5, `rgba(${190 - i * 15},${170 - i * 10},255,0.55)`);
    grd.addColorStop(1, 'rgba(184,166,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22 - i * 3, 32 - i * 5, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.shadowColor = 'rgba(230,220,255,0.9)'; ctx.shadowBlur = 14;
  ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🌀', 0, 0);
  ctx.restore();
}
function castleDrawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#241a2e'); g.addColorStop(1, '#100a16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // dinding batu bata sederhana
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  const brickH = 26;
  for (let y = 0; y < GROUND_Y; y += brickH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
  }
  // obor menyala
  [0.1, 0.5, 0.9].forEach((fx, i) => {
    const tx = VW * fx, ty = GROUND_Y * 0.35;
    const fl = ctx.createRadialGradient(tx, ty, 0, tx, ty, 55);
    fl.addColorStop(0, 'rgba(255,150,60,0.5)'); fl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(tx, ty, 55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(tx - 3, ty, 6, 30);
    ctx.fillStyle = '#ffb84d'; ctx.beginPath(); ctx.ellipse(tx, ty - 6, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
  });
  // lantai batu
  ctx.fillStyle = '#332740'; ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let x = 0; x < VW; x += 34) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, VH); ctx.stroke(); }
}
function castleDraw() {
  if (castle.victoryCutscene) { castleDrawVictoryCutscene(); return; }
  if (castleFloorDef() && castleFloorDef().subconscious) {
    castleDrawSubconsciousBackground();
  } else {
    castleDrawBackground();
  }
  if (castle.portal) castleDrawPortal(castle.portal);
  castle.mantras.forEach(castleDrawMantra);
  castle.enemies.slice().sort((a, b) => a.y - b.y).forEach(castleDrawEnemy);
  if (castle.boss) castleDrawEnemy(castle.boss);
  castle.projectiles.forEach(castleDrawProjectile);
  const s = getSkin(data.selectedSkin);
  let alpha = 1;
  if (castle.invincible > 0 && Math.floor(frame / 4) % 2 === 0) alpha = 0.4;
  ctx.save();
  if (castle.facing < 0) {
    ctx.translate(dino.x + dino.w, 0); ctx.scale(-1, 1);
    drawDinoShape(ctx, 0, dino.y, dino.w, dino.h, s, dino.jumping, frame, alpha);
  } else {
    drawDinoShape(ctx, dino.x, dino.y, dino.w, dino.h, s, dino.jumping, frame, alpha);
  }
  ctx.restore();
}
function startQuest() {
  mode = 'quest';
  castleResetRun();
  document.getElementById('castleFloorPill').textContent = '🏰 LANTAI 1';
  castleUpdateSkillButtons();
  castleUpdateHpBar();
  castleUpdateProgress();
  dino.w = 40; dino.h = 40;
  resetDino();
  showScreen('playing');
  castleToast('🏰 Lantai 1 — Aula Bawah. Bertahan dari zombie!');
}

/* ===================== STATE ===================== */
let state = 'menu'; // menu | shop | playing | gameover
let frame = 0;
let score = 0;
let runStartMs = 0; // waktu mulai lari mode Biasa (buat misi event "bertahan 6 menit")
let ghostMission2AlertShown = false;
let runCoins = 0;
let runDiamonds = 0;
let coinStreak = 0;
let runBestStreak = 0;
let lives = 3;
let invincible = 0;
let gameSpeed = 6;

/* Weather: 'clear' | 'rain' | 'wind' | 'kabut' */
let weather = 'clear';
let weatherScoreMark = 0;
const WEATHER_INTERVAL = 220;

/* Biome: 'padang' | 'gurun' | 'salju' | 'malam' */
const BIOMES = {
  padang: { sky: ['#8ec9f2', '#eaf7ff'], ground: { grass: '#6fbf4f', grassDark: '#4f9c36', dirt: '#c9a06b', dirtDark: '#a67c4a' }, hill: { back: '#9fd88a', front: '#7fc766' }, label: '🌾 PADANG RUMPUT' },
  gurun:  { sky: ['#f3c988', '#ffe9c2'], ground: { grass: '#d9b06a', grassDark: '#b98c46', dirt: '#e0c48a', dirtDark: '#c2a06a' }, hill: { back: '#e3c07a', front: '#d2a85f' }, label: '🏜 GURUN PASIR' },
  salju:  { sky: ['#c9e4f2', '#f2fbff'], ground: { grass: '#e8f3f8', grassDark: '#c7dde6', dirt: '#dceaf0', dirtDark: '#b9d0da' }, hill: { back: '#eef6fa', front: '#d8e9f0' }, label: '❄ DATARAN SALJU' },
  malam:  { sky: ['#1c2440', '#3c4d7a'], ground: { grass: '#2e3a2e', grassDark: '#1e281e', dirt: '#332a24', dirtDark: '#241d18' }, hill: { back: '#2a3350', front: '#212a44' }, label: '🌙 MALAM HARI' },
  hutan:  { sky: ['#6fa88a', '#cfe8d6'], ground: { grass: '#356b3d', grassDark: '#254c2b', dirt: '#4a3d2a', dirtDark: '#372c1e' }, hill: { back: '#3f7a4a', front: '#2f5f38' }, label: '🌲 HUTAN LEBAT' },
  pantai: { sky: ['#7ec8e3', '#eaf9ff'], ground: { grass: '#e8d9a0', grassDark: '#d1bd7c', dirt: '#f0e2b8', dirtDark: '#dcc98f' }, hill: { back: '#8fd0d8', front: '#6fbcc7' }, label: '🏖 PANTAI' }
};

/* ===================== EVENT SPESIAL: HANTU ===================== =
   Event terbatas waktu. Selama aktif: biome Padang Rumput "disamarkan"
   jadi Padang Hantu (warna ungu/kelabu berkabut), muncul buff Hantu baru,
   dan ada 2 misi dengan hadiah skin & jejak kaki bertema hantu. Semua
   dicek murni dari tanggal perangkat (Date.now()) — begitu lewat tanggal
   berakhir, tema & buff otomatis hilang sendiri tanpa perlu update lagi. */
const GHOST_EVENT = {
  name: 'Event Hantu',
  endTime: new Date('2026-09-15T00:00:00').getTime()
};
function ghostEventActive() { return Date.now() < GHOST_EVENT.endTime; }
function ghostEventTimeLeft() { return Math.max(0, GHOST_EVENT.endTime - Date.now()); }
const GHOST_MISSION1_TARGET = 3;
const GHOST_MISSION2_TARGET_MS = 6 * 60 * 1000; // 6 menit
// Misi 1: "lewati biome malam hari sebanyak 3 kali" — dihitung SETIAP KALI
// biome berubah masuk ke 'malam' (akumulasi lintas sesi main, tersimpan permanen).
function ghostToast(text) {
  const el = document.getElementById('ghostToast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function onEnterNightBiome() {
  if (!ghostEventActive() || data.eventGhost.mission1Done) return;
  data.eventGhost.nightPasses = (data.eventGhost.nightPasses || 0) + 1;
  if (data.eventGhost.nightPasses >= GHOST_MISSION1_TARGET) {
    data.eventGhost.mission1Done = true;
    if (!data.unlockedTrails.includes(8)) data.unlockedTrails.push(8);
    ghostToast('👻 MISI 1 SELESAI!\nJejak Kaki Hantu terbuka di Toko!');
    AudioMgr.sfx('unlock');
  }
  saveData();
}
// Misi 2: "bertahan 6 menit di game" — dicek tiap frame selama mode Biasa berjalan.
function checkGhostMission2() {
  if (data.eventGhost.mission2Done || ghostMission2AlertShown) return;
  if (!ghostEventActive()) return;
  if (mode !== 'normal' || state !== 'playing') return;
  if (Date.now() - runStartMs >= GHOST_MISSION2_TARGET_MS) {
    data.eventGhost.mission2Done = true;
    ghostMission2AlertShown = true;
    if (!data.unlocked.includes(10)) data.unlocked.push(10);
    spawnPopup(dino.x + dino.w / 2, dino.y - 30, '👻 SKIN TERBUKA!', '#b8a6ff');
    ghostToast('👻 MISI 2 SELESAI!\nSkin Hantu Kelana terbuka di Toko!');
    AudioMgr.sfx('unlock');
    saveData();
  }
}
const GHOST_PADANG = {
  sky: ['#4a3d70', '#8b7bc0'],
  ground: { grass: '#4a3d66', grassDark: '#332950', dirt: '#5c4a75', dirtDark: '#40324f' },
  hill: { back: '#5d4c85', front: '#453868' },
  label: '👻 PADANG HANTU'
};
// Dipakai skyColors/groundColors/hillColor/setBiome supaya "padang" tampil
// bertema hantu selama event aktif, dan otomatis balik normal begitu event usai.
function activeBiomeDef(b) {
  return (b === 'padang' && ghostEventActive()) ? GHOST_PADANG : BIOMES[b];
}
let biome = 'padang';
let biomeScoreMark = 0;
const BIOME_INTERVAL = 500;

/* ===================== DINO ===================== */
const dino = {
  x: 0, y: 0, w: 40, h: 40,
  vy: 0, jumping: false
};

function resizeCanvas() {
  VW = window.innerWidth;
  VH = window.innerHeight;
  const dpr = effectiveDPR();
  canvas.width = Math.round(VW * dpr);
  canvas.height = Math.round(VH * dpr);
  canvas.style.width = VW + 'px';
  canvas.style.height = VH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = gfxQuality !== 'rendah';
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = gfxQuality === '4k' ? 'high' : gfxQuality === 'rendah' ? 'low' : 'medium';
  GROUND_Y = Math.floor(VH * 0.68);
  dino.x = Math.floor(VW * 0.12);
  if (state !== 'playing') resetDino();
}
function resetDino() {
  dino.y = GROUND_Y - dino.h;
  dino.vy = 0;
  dino.jumping = false;
}

/* ===================== SHARED DINO SPRITE ===================== */
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawDinoShape(c, x, y, w, h, skin, jumping, walkFrame, alpha) {
  c.save();
  let finalAlpha = alpha !== undefined ? alpha : 1;
  if (skin.ghostly) finalAlpha *= 0.8; // skin bertema hantu: badan sedikit tembus pandang secara permanen
  c.globalAlpha = finalAlpha;

  // legs
  c.fillStyle = skin.head;
  if (!jumping) {
    const phase = Math.floor(walkFrame / 10) % 2 === 0;
    if (phase) {
      roundRectPath(c, x + 6, y + h - 8, 8, 14, 3); c.fill();
      roundRectPath(c, x + 23, y + h - 8, 8, 9, 3); c.fill();
    } else {
      roundRectPath(c, x + 6, y + h - 8, 8, 9, 3); c.fill();
      roundRectPath(c, x + 23, y + h - 8, 8, 14, 3); c.fill();
    }
  } else {
    roundRectPath(c, x + 6, y + h - 8, 8, 11, 3); c.fill();
    roundRectPath(c, x + 23, y + h - 8, 8, 11, 3); c.fill();
  }

  // tail
  c.fillStyle = skin.body;
  c.beginPath();
  c.moveTo(x - 2, y + h - 20);
  c.quadraticCurveTo(x - 18, y + h - 24, x - 15, y + h - 8);
  c.quadraticCurveTo(x - 8, y + h - 12, x + 3, y + h - 15);
  c.closePath();
  c.fill();
  drawTailExtra(c, x, y, h, skin);

  // sayap (hanya skin bertipe naga, digambar di belakang badan)
  drawWings(c, x, y, w, h, skin);

  // body
  if (skin.shimmer) {
    const bg = c.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, skin.shimmerColor || '#fff3b0');
    bg.addColorStop(0.5, skin.body);
    bg.addColorStop(1, skin.shimmerDark || skin.head);
    c.fillStyle = bg;
  } else {
    c.fillStyle = skin.body;
  }
  roundRectPath(c, x, y + 4, w - 4, h - 12, 13);
  c.fill();

  // body pattern (differentiates skins beyond color)
  drawBodyPattern(c, x, y, w, h, skin);

  // belly
  c.fillStyle = skin.belly || '#fff';
  roundRectPath(c, x + 5, y + h - 18, w - 18, 11, 7);
  c.fill();

  // arm
  c.fillStyle = skin.body;
  c.save();
  c.translate(x + w - 14, y + h - 16);
  c.rotate(0.55);
  roundRectPath(c, -3, 0, 6, 11, 3);
  c.fill();
  c.restore();

  // back spikes (shape depends on skin)
  drawSpikes(c, x, y, skin);

  // head
  c.fillStyle = skin.head;
  roundRectPath(c, x + w - 22, y - 8, 26, 22, 9);
  c.fill();
  // snout
  roundRectPath(c, x + w, y - 1, 10, 12, 4);
  c.fill();

  // horn (only some skins)
  if (skin.hornStyle === 'twin') {
    // tanduk ganda melengkung ala naga
    c.save();
    c.fillStyle = skin.hornColor || '#8a5a10';
    c.strokeStyle = 'rgba(60,35,0,0.7)';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x + w - 19, y - 7);
    c.quadraticCurveTo(x + w - 10, y - 22, x + w - 14, y - 28);
    c.quadraticCurveTo(x + w - 15, y - 16, x + w - 22, y - 6);
    c.closePath();
    c.fill(); c.stroke();
    c.beginPath();
    c.moveTo(x + w - 9, y - 7);
    c.quadraticCurveTo(x + w + 2, y - 20, x + w - 1, y - 26);
    c.quadraticCurveTo(x + w - 3, y - 15, x + w - 12, y - 6);
    c.closePath();
    c.fill(); c.stroke();
    c.restore();
  } else if (skin.horn) {
    c.fillStyle = skin.eye === '#3a2a00' ? '#3a2a00' : '#fff8e0';
    c.beginPath();
    c.moveTo(x + w - 16, y - 8);
    c.lineTo(x + w - 12, y - 17);
    c.lineTo(x + w - 8, y - 8);
    c.closePath();
    c.fill();
  }

  // eye
  c.fillStyle = skin.eye || '#fff';
  c.beginPath(); c.arc(x + w - 6, y + 1, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#222';
  c.beginPath(); c.arc(x + w - 4.5, y + 1, 2, 0, Math.PI * 2); c.fill();

  // Lencana buff di badan dino — INI penanda utama biar keliatan langsung
  // buff apa yang dimiliki skin ini, bukan sekadar detail kecil yang gampang
  // kelewat. Lingkaran warna ikut warna buff-nya + ikon lebih besar & tebal.
  if (skin.affinity) {
    const info = skin.affinity === 'all' ? { icon: '★', color: '#8a4fd9' } : BUFF_TYPES[skin.affinity];
    const bx = x + w * 0.42, by = y + h * 0.42, br = w * 0.24;
    c.save();
    // ring luar warna buff (glow lembut)
    c.fillStyle = info.color;
    c.globalAlpha = 0.28;
    c.beginPath(); c.arc(bx, by, br + 3, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    // piringan putih
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
    // cincin warna buff
    c.strokeStyle = info.color;
    c.lineWidth = 2;
    c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.stroke();
    // ikon buff
    c.fillStyle = info.color;
    c.font = `bold ${Math.round(br * 1.25)}px sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(info.icon, bx, by + br * 0.06);
    c.restore();
  }

  c.restore();
}

/* ---- shape helpers so each skin looks structurally different ---- */
function drawWings(c, x, y, w, h, skin) {
  if (!skin.wings) return;
  c.save();
  c.globalAlpha = 0.95;
  const wingColor = skin.wingColor || skin.body;
  const wingLight = skin.wingLight || skin.belly || '#fff6c9';
  // sayap kiri (dengan gradasi selaput + rusuk sayap)
  const lg = c.createLinearGradient(x - w * 0.3, y, x + w * 0.22, y + h * 0.6);
  lg.addColorStop(0, wingLight);
  lg.addColorStop(1, wingColor);
  c.fillStyle = lg;
  c.strokeStyle = 'rgba(90,60,10,0.55)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + w * 0.22, y + h * 0.18);
  c.quadraticCurveTo(x - w * 0.58, y - h * 0.2, x - w * 0.3, y + h * 0.62);
  c.quadraticCurveTo(x - w * 0.02, y + h * 0.4, x + w * 0.22, y + h * 0.42);
  c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(x + w * 0.2, y + h * 0.22);
    c.lineTo(x - w * (0.1 + i * 0.13), y + h * (0.12 + i * 0.18));
    c.stroke();
  }
  // cakar ujung sayap kiri
  c.fillStyle = skin.hornColor || '#5a3a08';
  c.beginPath();
  c.moveTo(x + w * 0.19, y + h * 0.16);
  c.lineTo(x + w * 0.1, y + h * 0.06);
  c.lineTo(x + w * 0.26, y + h * 0.14);
  c.closePath();
  c.fill();

  // sayap kanan (dengan gradasi selaput + rusuk sayap)
  const rg = c.createLinearGradient(x + w * 0.5, y, x + w * 1.35, y + h * 0.6);
  rg.addColorStop(0, wingColor);
  rg.addColorStop(1, wingLight);
  c.fillStyle = rg;
  c.strokeStyle = 'rgba(90,60,10,0.55)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + w * 0.5, y + h * 0.18);
  c.quadraticCurveTo(x + w * 1.38, y - h * 0.2, x + w * 1.08, y + h * 0.62);
  c.quadraticCurveTo(x + w * 0.76, y + h * 0.4, x + w * 0.5, y + h * 0.42);
  c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(x + w * 0.52, y + h * 0.22);
    c.lineTo(x + w * (0.62 + i * 0.15), y + h * (0.12 + i * 0.18));
    c.stroke();
  }
  // cakar ujung sayap kanan
  c.fillStyle = skin.hornColor || '#5a3a08';
  c.beginPath();
  c.moveTo(x + w * 0.53, y + h * 0.16);
  c.lineTo(x + w * 0.62, y + h * 0.06);
  c.lineTo(x + w * 0.46, y + h * 0.14);
  c.closePath();
  c.fill();
  c.restore();
}
function drawSpikes(c, x, y, skin) {
  const style = skin.spikeStyle || 'normal';
  c.fillStyle = skin.head;
  if (style === 'normal') {
    for (let i = 0; i < 3; i++) {
      const sx = x + 6 + i * 7;
      c.beginPath();
      c.moveTo(sx, y + 4); c.lineTo(sx + 4, y - 5); c.lineTo(sx + 9, y + 4);
      c.closePath(); c.fill();
    }
  } else if (style === 'flame') {
    for (let i = 0; i < 3; i++) {
      const sx = x + 5 + i * 7.5;
      c.beginPath();
      c.moveTo(sx, y + 4);
      c.quadraticCurveTo(sx - 3, y - 6, sx + 3, y - 11);
      c.quadraticCurveTo(sx + 7, y - 4, sx + 9, y + 4);
      c.closePath(); c.fill();
      c.fillStyle = '#ffcf6b';
      c.beginPath(); c.arc(sx + 3.5, y - 8, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = skin.head;
    }
  } else if (style === 'fin') {
    c.beginPath();
    c.moveTo(x + 4, y + 6);
    c.quadraticCurveTo(x + 12, y - 10, x + 22, y + 2);
    c.quadraticCurveTo(x + 14, y - 1, x + 6, y + 8);
    c.closePath(); c.fill();
  } else if (style === 'round') {
    for (let i = 0; i < 3; i++) {
      const sx = x + 9 + i * 7;
      c.beginPath(); c.arc(sx, y - 1, 4, 0, Math.PI * 2); c.fill();
    }
  } else if (style === 'double') {
    for (let i = 0; i < 4; i++) {
      const sx = x + 4 + i * 6;
      const tall = i % 2 === 0;
      c.beginPath();
      c.moveTo(sx, y + 4);
      c.lineTo(sx + 3, tall ? y - 8 : y - 3);
      c.lineTo(sx + 6, y + 4);
      c.closePath(); c.fill();
    }
  } else if (style === 'crown') {
    for (let i = 0; i < 3; i++) {
      const sx = x + 6 + i * 7.5;
      c.beginPath();
      c.moveTo(sx, y + 4); c.lineTo(sx + 4, y - 9); c.lineTo(sx + 9, y + 4);
      c.closePath(); c.fill();
      c.fillStyle = '#e8d3ff';
      c.beginPath(); c.arc(sx + 4, y - 9, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = skin.head;
    }
  }
}

function drawBodyPattern(c, x, y, w, h, skin) {
  const pat = skin.pattern || 'plain';
  if (pat === 'plain') return;
  c.save();
  if (pat === 'flame') {
    c.fillStyle = 'rgba(255,207,107,0.55)';
    for (let i = 0; i < 2; i++) {
      const px = x + 8 + i * 12, py = y + h - 26;
      c.beginPath();
      c.moveTo(px, py + 8);
      c.quadraticCurveTo(px - 3, py, px, py - 7);
      c.quadraticCurveTo(px + 4, py, px, py + 8);
      c.closePath(); c.fill();
    }
  } else if (pat === 'scales') {
    c.strokeStyle = 'rgba(20,50,80,0.35)';
    c.lineWidth = 1.4;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 3; i++) {
        const px = x + 6 + i * 8, py = y + h - 24 + row * 8;
        c.beginPath(); c.arc(px, py, 4, Math.PI, 0); c.stroke();
      }
    }
  } else if (pat === 'spots') {
    c.fillStyle = 'rgba(184,148,31,0.6)';
    const spots = [[6, -18], [16, -10], [9, -6], [20, -20]];
    spots.forEach(([dx, dy]) => { c.beginPath(); c.arc(x + dx, y + h + dy, 2.6, 0, Math.PI * 2); c.fill(); });
  } else if (pat === 'stars') {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    const stars = [[7, -20], [18, -12], [11, -6]];
    stars.forEach(([dx, dy]) => drawTinyStar(c, x + dx, y + h + dy, 3));
  } else if (pat === 'stripes') {
    c.strokeStyle = 'rgba(230,210,255,0.55)';
    c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(x + 2 + i * 7, y + h - 8);
      c.lineTo(x + 8 + i * 7, y + h - 26);
      c.stroke();
    }
  }
  c.restore();
}

function drawTinyStar(c, cx, cy, r) {
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.lineTo(cx + Math.cos(a + Math.PI / 4) * (r * 0.35), cy + Math.sin(a + Math.PI / 4) * (r * 0.35));
  }
  c.closePath(); c.fill();
}

function drawTailExtra(c, x, y, h, skin) {
  if (skin.tailStyle === 'fin') {
    c.fillStyle = skin.head;
    c.beginPath();
    c.moveTo(x - 8, y + h - 18);
    c.lineTo(x - 16, y + h - 26);
    c.lineTo(x - 6, y + h - 16);
    c.closePath(); c.fill();
  } else if (skin.tailStyle === 'spiked') {
    c.fillStyle = skin.head;
    c.beginPath();
    c.moveTo(x - 14, y + h - 10);
    c.lineTo(x - 22, y + h - 12);
    c.lineTo(x - 13, y + h - 6);
    c.closePath(); c.fill();
  } else if (skin.tailStyle === 'wisp') {
    // Ekor kabut hantu: bukan ekor padat, tapi 3 gumpalan asap yang menipis ke ujung.
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = skin.body;
    c.beginPath(); c.arc(x - 6, y + h - 14, 6.5, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.55;
    c.beginPath(); c.arc(x - 15, y + h - 12, 5, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.3;
    c.beginPath(); c.arc(x - 22, y + h - 9, 3.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}

/* ===================== LOBBY PREVIEW (adegan penuh layar: lari & lompat rintangan) ===================== */
const lobbyCanvas = document.getElementById('lobbyDinoCanvas');
const lobbyCtx = lobbyCanvas.getContext('2d');
let lpFrame = 0;
let lpDino = { x: 0, y: 0, w: 32, h: 32, vy: 0, jumping: false };
let lpObstacles = [];
let lpSpawnTimer = 40;
const LP_SPEED = 2.6;

function lpResizeCanvas() {
  const w = Math.round(lobbyCanvas.clientWidth);
  const h = Math.round(lobbyCanvas.clientHeight);
  if (w > 0 && h > 0 && (lobbyCanvas.width !== w || lobbyCanvas.height !== h)) {
    lobbyCanvas.width = w;
    lobbyCanvas.height = h;
    lpDino.h = Math.max(28, Math.round(h * 0.09));
    lpDino.w = lpDino.h;
    lpDino.x = Math.max(24, Math.round(w * 0.1));
    if (!lpDino.jumping) lpDino.y = lpGroundY() - lpDino.h;
  }
}
function lpGroundY() { return lobbyCanvas.height - Math.round(lobbyCanvas.height * 0.16); }
window.addEventListener('resize', lpResizeCanvas);

function lpUpdate() {
  lpFrame++;
  const groundY = lpGroundY();
  // AI lompat otomatis: begitu rintangan terdekat mendekat, dino melompat menghindarinya
  if (!lpDino.jumping) {
    const next = lpObstacles.find(o => o.x > lpDino.x);
    if (next && next.x - (lpDino.x + lpDino.w) < lpDino.w * 1.5 && next.x - (lpDino.x + lpDino.w) > 4) {
      lpDino.jumping = true;
      lpDino.vy = -lpDino.h * 0.34;
    }
  }
  if (lpDino.jumping) {
    lpDino.vy += 0.5;
    lpDino.y += lpDino.vy;
    if (lpDino.y >= groundY - lpDino.h) {
      lpDino.y = groundY - lpDino.h;
      lpDino.jumping = false;
      lpDino.vy = 0;
    }
  } else {
    lpDino.y = groundY - lpDino.h;
  }
  lpSpawnTimer--;
  if (lpSpawnTimer <= 0) {
    lpObstacles.push({ x: lobbyCanvas.width + 12, w: 14 + Math.random() * 8, h: 18 + Math.random() * 12 });
    lpSpawnTimer = 90 + Math.random() * 60;
  }
  lpObstacles.forEach(o => o.x -= LP_SPEED);
  lpObstacles = lpObstacles.filter(o => o.x + o.w > -10);
}
function renderLobbyDino() {
  lpResizeCanvas();
  const w = lobbyCanvas.width, h = lobbyCanvas.height;
  if (!w || !h) return;
  const groundY = lpGroundY();
  const s = getSkin(data.selectedSkin);
  const ghostTheme = ghostEventActive();
  lpUpdate();
  lobbyCtx.clearRect(0, 0, w, h);
  // langit senja lembut (atau tema hantu ungu selama Event Hantu)
  const g = lobbyCtx.createLinearGradient(0, 0, 0, h);
  if (ghostTheme) {
    g.addColorStop(0, '#332358'); g.addColorStop(0.55, '#6a5296'); g.addColorStop(1, '#a08cc7');
  } else {
    g.addColorStop(0, '#a8ddf0'); g.addColorStop(0.55, '#cdeeb0'); g.addColorStop(1, '#eaffe0');
  }
  lobbyCtx.fillStyle = g;
  lobbyCtx.fillRect(0, 0, w, h);
  // matahari (atau bulan pucat pas tema hantu)
  lobbyCtx.save();
  const sx = w * 0.82, sy = h * 0.16, sr = Math.max(20, w * 0.05);
  const sg = lobbyCtx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
  if (ghostTheme) {
    sg.addColorStop(0, 'rgba(220,215,255,0.9)');
    sg.addColorStop(1, 'rgba(220,215,255,0)');
  } else {
    sg.addColorStop(0, 'rgba(255,244,190,0.95)');
    sg.addColorStop(1, 'rgba(255,244,190,0)');
  }
  lobbyCtx.fillStyle = sg;
  lobbyCtx.beginPath(); lobbyCtx.arc(sx, sy, sr * 2.4, 0, Math.PI * 2); lobbyCtx.fill();
  lobbyCtx.fillStyle = ghostTheme ? '#e8e2ff' : '#fff3c0';
  lobbyCtx.beginPath(); lobbyCtx.arc(sx, sy, sr, 0, Math.PI * 2); lobbyCtx.fill();
  lobbyCtx.restore();
  // bukit jauh (parallax statis, dekorasi)
  lobbyCtx.fillStyle = ghostTheme ? 'rgba(90,70,140,0.45)' : 'rgba(80,150,80,0.28)';
  lobbyCtx.beginPath();
  lobbyCtx.moveTo(0, groundY);
  lobbyCtx.quadraticCurveTo(w * 0.2, groundY - h * 0.14, w * 0.42, groundY);
  lobbyCtx.quadraticCurveTo(w * 0.68, groundY - h * 0.1, w * 0.85, groundY);
  lobbyCtx.lineTo(w, groundY);
  lobbyCtx.lineTo(w, h); lobbyCtx.lineTo(0, h);
  lobbyCtx.closePath(); lobbyCtx.fill();
  // awan (atau kabut hantu)
  lobbyCtx.fillStyle = ghostTheme ? 'rgba(220,210,255,0.5)' : 'rgba(255,255,255,0.75)';
  [[0.13, 0.18, 1], [0.5, 0.12, 0.8], [0.32, 0.28, 0.65]].forEach(([fx, fy, scale]) => {
    const cx = w * fx, cy = h * fy, r = Math.max(10, w * 0.032) * scale;
    lobbyCtx.beginPath(); lobbyCtx.arc(cx, cy, r, 0, Math.PI * 2); lobbyCtx.fill();
    lobbyCtx.beginPath(); lobbyCtx.arc(cx + r * 0.85, cy + 3, r * 0.7, 0, Math.PI * 2); lobbyCtx.fill();
    lobbyCtx.beginPath(); lobbyCtx.arc(cx - r * 0.75, cy + 4, r * 0.6, 0, Math.PI * 2); lobbyCtx.fill();
  });
  // tanah
  const gg = lobbyCtx.createLinearGradient(0, groundY, 0, h);
  if (ghostTheme) { gg.addColorStop(0, '#4a3a70'); gg.addColorStop(1, '#251c42'); }
  else { gg.addColorStop(0, '#4f9c36'); gg.addColorStop(1, '#33691f'); }
  lobbyCtx.fillStyle = gg;
  lobbyCtx.fillRect(0, groundY, w, h - groundY);
  lobbyCtx.strokeStyle = 'rgba(0,0,0,0.2)';
  lobbyCtx.lineWidth = 2;
  lobbyCtx.beginPath(); lobbyCtx.moveTo(0, groundY); lobbyCtx.lineTo(w, groundY); lobbyCtx.stroke();
  // rumput dekoratif di garis tanah
  lobbyCtx.strokeStyle = 'rgba(255,255,255,0.18)';
  lobbyCtx.lineWidth = 1;
  for (let gx = -((lpFrame * LP_SPEED) % 26); gx < w; gx += 26) {
    lobbyCtx.beginPath();
    lobbyCtx.moveTo(gx, groundY + 5); lobbyCtx.lineTo(gx + 4, groundY - 2); lobbyCtx.lineTo(gx + 8, groundY + 5);
    lobbyCtx.stroke();
  }
  // rintangan (batu, atau nisan pas tema hantu)
  lpObstacles.forEach(o => {
    if (ghostTheme) {
      lobbyCtx.fillStyle = '#8a7fae';
      roundRectPath(lobbyCtx, o.x, groundY - o.h, o.w, o.h, o.w * 0.4);
      lobbyCtx.fill();
      lobbyCtx.strokeStyle = 'rgba(255,255,255,0.3)'; lobbyCtx.lineWidth = 1.5;
      lobbyCtx.beginPath(); lobbyCtx.moveTo(o.x + o.w * 0.3, groundY - o.h + 4); lobbyCtx.lineTo(o.x + o.w * 0.3, groundY - 3); lobbyCtx.stroke();
      lobbyCtx.beginPath(); lobbyCtx.moveTo(o.x + o.w * 0.15, groundY - o.h * 0.55); lobbyCtx.lineTo(o.x + o.w * 0.55, groundY - o.h * 0.55); lobbyCtx.stroke();
    } else {
      lobbyCtx.fillStyle = '#6b5a45';
      roundRectPath(lobbyCtx, o.x, groundY - o.h, o.w, o.h, 3);
      lobbyCtx.fill();
      lobbyCtx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRectPath(lobbyCtx, o.x + 2, groundY - o.h + 2, o.w - 6, 3, 2);
      lobbyCtx.fill();
    }
  });
  // dino sedang lari & melompati rintangan
  drawDinoShape(lobbyCtx, lpDino.x, lpDino.y, lpDino.w, lpDino.h, s, lpDino.jumping, lpFrame, 1);
}
function lobbyPreviewLoop() {
  if (state === 'menu') renderLobbyDino();
  requestAnimationFrame(lobbyPreviewLoop);
}

/* ===================== OBSTACLES / COINS / PARTICLES ===================== */
let obstacles = [];
let coins = [];
let buffs = [];
let diamonds = [];
let obstacleTimer = 0;
let coinTimer = 0;
let buffTimer = 0;
let diamondTimer = 0;
let nextObstacleGap = 70;
let nextBuffGap = 480 + Math.random() * 260;
let nextDiamondGap = 700 + Math.random() * 400;

let clouds = [];
function initClouds() {
  clouds = [];
  const n = Math.round((weather === 'rain' ? 7 : 4) * gfxParticleMul());
  for (let i = 0; i < n; i++) {
    clouds.push({ x: Math.random() * VW, y: 20 + Math.random() * (GROUND_Y * 0.3), w: 34 + Math.random() * 30 });
  }
}

let hillsBack = [];
let hillsFront = [];
function initHills() {
  hillsBack = []; hillsFront = [];
  for (let i = 0; i < 6; i++) {
    hillsBack.push({ x: i * 220 + Math.random() * 40, w: 200 + Math.random() * 80, h: 40 + Math.random() * 30 });
    hillsFront.push({ x: i * 260 + Math.random() * 40, w: 220 + Math.random() * 90, h: 26 + Math.random() * 22 });
  }
}
let hillOffsetBack = 0, hillOffsetFront = 0;

let rainDrops = [];
function initRain() {
  rainDrops = [];
  const n = Math.round(60 * gfxParticleMul());
  const blizzard = isBlizzard();
  for (let i = 0; i < n; i++) {
    if (blizzard) {
      // Kepingan salju: jatuh lebih pelan, ukurannya bervariasi, ada goyangan.
      rainDrops.push({
        x: Math.random() * VW, y: Math.random() * VH,
        len: 2 + Math.random() * 2.5,
        speed: 1.5 + Math.random() * 2,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.03
      });
    } else {
      rainDrops.push({ x: Math.random() * VW, y: Math.random() * VH, len: 10 + Math.random() * 10, speed: 8 + Math.random() * 6 });
    }
  }
}

let fogPatches = [];
function initFog() {
  fogPatches = [];
  const n = Math.round(10 * gfxParticleMul());
  for (let i = 0; i < n; i++) {
    fogPatches.push({
      x: Math.random() * VW,
      y: GROUND_Y - 10 - Math.random() * 160,
      w: 120 + Math.random() * 160,
      speed: 0.5 + Math.random() * 0.9,
      alpha: 0.14 + Math.random() * 0.18
    });
  }
}

let windLines = [];
let windLeaves = [];
const LEAF_COLORS = ['#c98f3f', '#d9a94f', '#b5762f', '#e0b95e'];
function initWind() {
  windLines = [];
  const nLines = Math.round(18 * gfxParticleMul());
  for (let i = 0; i < nLines; i++) {
    windLines.push({ x: Math.random() * VW, y: Math.random() * GROUND_Y, len: 20 + Math.random() * 30, speed: 10 + Math.random() * 8 });
  }
  windLeaves = [];
  const nLeaves = Math.round(14 * gfxParticleMul());
  for (let i = 0; i < nLeaves; i++) {
    windLeaves.push({
      x: Math.random() * VW,
      y: Math.random() * GROUND_Y,
      size: 5 + Math.random() * 5,
      speed: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      bob: Math.random() * Math.PI * 2,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]
    });
  }
}

function spawnObstacle() {
  const groundTypes = ['cactusSmall', 'cactusBig', 'cactusGroup', 'rockPile', 'logObstacle'];
  let pool = [...groundTypes, ...groundTypes];

  if (biome === 'salju') pool.push('snowMound', 'snowMound');
  if (weather === 'rain') pool.push('lightning');
  if (weather === 'wind') pool.push('flyingLow', 'flyingHigh', 'flyingDebris');
  if (weather === 'kabut') pool.push('batuKabut', 'batuKabut');
  if (weather === 'clear') pool.push('beehive');

  const type = pool[Math.floor(Math.random() * pool.length)];
  let obs = { type, x: VW + 30 };

  if (type === 'cactusSmall') {
    obs.w = 18; obs.h = 36; obs.y = GROUND_Y - obs.h;
  } else if (type === 'cactusBig') {
    obs.w = 26; obs.h = 52; obs.y = GROUND_Y - obs.h;
  } else if (type === 'cactusGroup') {
    obs.w = 52; obs.h = 36; obs.y = GROUND_Y - obs.h;
  } else if (type === 'rockPile') {
    obs.w = 40; obs.h = 30; obs.y = GROUND_Y - obs.h;
  } else if (type === 'logObstacle') {
    obs.w = 46; obs.h = 20; obs.y = GROUND_Y - obs.h;
  } else if (type === 'snowMound') {
    obs.w = 38; obs.h = 26; obs.y = GROUND_Y - obs.h;
  } else if (type === 'beehive') {
    obs.w = 32; obs.h = 32; obs.y = GROUND_Y - 60 - Math.random() * 50; obs.swing = Math.random() * Math.PI * 2;
  } else if (type === 'lightning') {
    obs.w = 24; obs.h = 60; obs.y = GROUND_Y - obs.h;
    obs.state = 'warning'; obs.timer = 0; obs.warnFrames = 45;
  } else if (type === 'flyingLow') {
    obs.w = 44; obs.h = 28; obs.y = GROUND_Y - 46; obs.flap = Math.random() * 10;
  } else if (type === 'flyingHigh') {
    obs.w = 52; obs.h = 24; obs.y = GROUND_Y - dino.h - 95; obs.flap = Math.random() * 10;
  } else if (type === 'flyingDebris') {
    obs.w = 30; obs.h = 30; obs.y = GROUND_Y - 40 - Math.random() * 70; obs.rot = 0;
    obs.rotSpeed = 0.12 + Math.random() * 0.1;
  } else if (type === 'batuKabut') {
    obs.w = 30; obs.h = 24; obs.y = GROUND_Y - obs.h;
  }
  obstacles.push(obs);
}

function spawnCoin() {
  const highChance = Math.random() < 0.4;
  const y = highChance ? GROUND_Y - 95 : GROUND_Y - 34;
  coins.push({ x: VW + 30, y, r: 12, collected: false, spin: 0 });
}

function spawnBuff() {
  const pool = ['speed', 'speed', 'jump', 'jump', 'coin2x', 'coin2x', 'shield', 'shield', 'magnet', 'magnet', 'slowmo', 'slowmo', 'life'];
  // Buff Hantu cuma nongol selama Event Hantu aktif — hilang otomatis begitu event lewat.
  if (ghostEventActive()) pool.push('ghost', 'ghost');
  const type = pool[Math.floor(Math.random() * pool.length)];
  const highChance = Math.random() < 0.5;
  const y = highChance ? GROUND_Y - 100 : GROUND_Y - 38;
  buffs.push({ x: VW + 30, y, r: 16, type, collected: false, bob: Math.random() * Math.PI * 2 });
}

function spawnDiamond() {
  const highChance = Math.random() < 0.5;
  const y = highChance ? GROUND_Y - 105 : GROUND_Y - 34;
  diamonds.push({ x: VW + 30, y, r: 11, collected: false, spin: 0 });
}

/* ===================== WEATHER LOGIC ===================== */
let weatherSeen = new Set();
function setWeather(w) {
  weather = w;
  weatherSeen.add(w);
  initClouds();
  if (w === 'rain') initRain();
  if (w === 'wind') initWind();
  if (w === 'kabut') initFog();
  updateWeatherLabel();
}
// BUGFIX (biome vs cuaca): sebelumnya cuaca "hujan" nampilin tetesan air BIRU
// jatuh lurus walau lagi di biome salju — keliatan aneh (masa di salju ujan
// air?). Sekarang kalau lagi hujan DAN biome-nya salju, otomatis jadi BADAI
// SALJU: partikelnya jadi kepingan salju putih yang jatuh pelan & melayang
// ke samping, bukan tetesan air. Label cuaca di HUD juga ikut berubah.
function isBlizzard() { return weather === 'rain' && biome === 'salju'; }
function updateWeatherLabel() {
  weatherPill.textContent = weather === 'rain' ? (isBlizzard() ? '❄ BADAI SALJU' : '🌧 HUJAN')
    : (weather === 'wind' ? '💨 ANGIN' : (weather === 'kabut' ? '🌫 BERKABUT' : '☀ CERAH'));
}
function maybeChangeWeather() {
  if (score - weatherScoreMark >= WEATHER_INTERVAL) {
    weatherScoreMark = score;
    const options = ['clear', 'rain', 'wind', 'kabut'].filter(w => w !== weather);
    setWeather(options[Math.floor(Math.random() * options.length)]);
  }
}

/* ===================== BIOME LOGIC ===================== */
let biomeSeen = new Set();
function setBiome(b) {
  if (b === 'malam' && biome !== 'malam' && mode === 'normal') {
    onEnterNightBiome();
  }
  biome = b;
  biomeSeen.add(b);
  biomePill.textContent = activeBiomeDef(b).label;
  // Kalau lagi hujan dan biome berubah masuk/keluar dari salju, langsung
  // sesuaikan partikel (hujan ⇄ badai salju) dan label cuaca-nya juga.
  if (weather === 'rain') initRain();
  updateWeatherLabel();
}
function maybeChangeBiome() {
  if (score - biomeScoreMark >= BIOME_INTERVAL) {
    biomeScoreMark = score;
    const options = Object.keys(BIOMES).filter(b => b !== biome);
    setBiome(options[Math.floor(Math.random() * options.length)]);
  }
}

/* ===================== INPUT ===================== */
function jump() {
  if (state !== 'playing' || qPaused || paused) return;
  if (mode === 'quest' && castle.victoryCutscene) return;
  if (mode === 'quest' && castle.ruleEffect === 'nojump' && castle.boss && castle.boss.type === 'aurelion') return;
  if (!dino.jumping) {
    dino.jumping = true;
    dino.vy = mode === 'quest' ? JUMP_FORCE : currentJumpForce();
    AudioMgr.sfx('jump');
  }
}
function releaseFlight() {
}
// Tap-di-canvas buat lompat cuma berlaku di Mode Biasa — di Story Mode (Kastil) ini
// dimatikan karena lompat sudah ada tombol sendiri, kalau dibiarkan aktif tiap
// sentuhan di layar (termasuk gak sengaja pas narik joystick) bikin dino lompat sendiri.
// Tap di layar juga dipakai buat "skip" nunggu di sinematik kemenangan Chapter 1.
function handleCanvasTap() {
  if (mode !== 'quest') { jump(); return; }
  if (castle.victoryCutscene && castle.victoryCutscene.phase === 'text' && castle.victoryCutscene.t > 70) {
    castleFinishVictoryCutscene();
  }
}
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleCanvasTap(); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); releaseFlight(); }, { passive: false });
canvas.addEventListener('mousedown', handleCanvasTap);
canvas.addEventListener('mouseup', releaseFlight);

/* ===================== JEDA (PAUSE) MANUAL ===================== */
let paused = false;
function openPause() {
  if (state !== 'playing' || paused) return;
  paused = true;
  AudioMgr.pauseAudio();
  document.getElementById('pauseOverlay').classList.add('active');
}
function closePause() {
  paused = false;
  AudioMgr.resumeAudio();
  document.getElementById('pauseOverlay').classList.remove('active');
}
document.getElementById('pauseBtn').addEventListener('click', () => {
  AudioMgr.sfx('click');
  openPause();
});
document.getElementById('pauseResumeBtn').addEventListener('click', () => {
  AudioMgr.sfx('click');
  closePause();
});
document.getElementById('pauseRestartBtn').addEventListener('click', () => {
  AudioMgr.sfx('click');
  closePause();
  if (mode === 'quest') { startQuest(false); }
  else startGame();
});
document.getElementById('pauseMenuBtn').addEventListener('click', () => {
  AudioMgr.sfx('click');
  closePause();
  showScreen('menu');
});

/* ===================== KONTROL CASTLE MODE ===================== */
(function setupCastleControls() {
  const stick = document.getElementById('castleJoystick');
  const knob = document.getElementById('castleJoystickKnob');
  const maxR = 32;
  let stickPointerId = null;
  function setKnob(dx) {
    const dist = Math.min(maxR, Math.abs(dx));
    const kx = Math.sign(dx) * dist;
    knob.style.transform = `translate(${kx}px, 0)`;
    castle.analogX = kx / maxR;
  }
  function resetKnob() {
    knob.style.transform = 'translate(0,0)';
    castle.analogX = 0;
  }
  function handleMove(clientX) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    setKnob(clientX - cx);
  }
  // Pakai Pointer Events (bukan click/touchstart biasa) supaya joystick dan
  // tombol lompat/serang bisa dipencet BARENGAN oleh jari berbeda tanpa saling
  // "rebutan" satu sentuhan — ini yang bikin dulu kerasa cuma bisa 1 tombol aktif.
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickPointerId = e.pointerId;
    if (stick.setPointerCapture) stick.setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointerId) return;
    e.preventDefault();
    handleMove(e.clientX);
  });
  function endStick(e) {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    resetKnob();
  }
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('pointerleave', (e) => { if (e.pointerId === stickPointerId) endStick(e); });

  document.getElementById('castleJumpBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
  [0, 1, 2].forEach(i => {
    document.getElementById('castleAtk' + i).addEventListener('pointerdown', (e) => { e.preventDefault(); castleAttack(i); });
  });
})();

/* ===================== SCREEN MANAGEMENT ===================== */
function showScreen(name) {
  lobby.classList.remove('active');
  modeSelect.classList.remove('active');
  shop.classList.remove('active');
  account.classList.remove('active');
  gameover.classList.remove('active');
  hud.style.display = 'none';
  questHud.style.display = 'none';
  document.getElementById('castleControls').classList.remove('visible');
  if (name !== 'playing') bossBarWrap.style.display = 'none';
  if (name !== 'playing') { document.getElementById('pauseBtn').classList.remove('visible'); paused = false; document.getElementById('pauseOverlay').classList.remove('active'); }
  else { document.getElementById('pauseBtn').classList.add('visible'); }
  if (name === 'menu') { dino.w = 40; dino.h = 40; resetDino(); lobby.classList.add('active'); refreshLobbyStats(); }
  if (name === 'modeSelect') { modeSelect.classList.add('active'); refreshLobbyStats(); }
  if (name === 'shop') { shop.classList.add('active'); renderShop(); }
  if (name === 'account') { account.classList.add('active'); renderAccountScreen(); }
  if (name === 'gameover') { gameover.classList.add('active'); }
  if (name === 'playing') {
    if (mode === 'quest') {
      questHud.style.display = 'flex';
      document.getElementById('castleControls').classList.add('visible');
      if (castle.bossActive) bossBarWrap.style.display = 'block';
    } else {
      hud.style.display = 'flex';
    }
  }
  state = name;
}

function refreshLobbyStats() {
  document.getElementById('statBest').textContent = String(data.highScore).padStart(4, '0');
  document.getElementById('statCoins').textContent = data.coins;
  document.getElementById('statDiamonds').textContent = data.diamonds;
  renderDailyChallenge();
  renderLobbyDino();
  updateGhostEventButtonVisibility();
  const profile = getActiveProfile();
  document.getElementById('profilePillName').textContent = profile ? profile.name : 'Pemain';
  const continueBtn = document.getElementById('questContinueBtn');
  const badge = document.getElementById('questStatusBadge');
  const questBtn = document.getElementById('modeQuestBtn');
  continueBtn.style.display = 'none';
  if (data.castleProgress && data.castleProgress.completed) {
    questBtn.textContent = '🏰 KASTIL TUA — TAMAT';
    badge.style.display = 'block';
    badge.textContent = `🏆 Story Mode tamat — Total mantra: ${data.castleMantraCount || 0}`;
  } else {
    questBtn.textContent = '🏰 STORY MODE: KASTIL TUA';
    badge.style.display = 'none';
  }
}

function renderShop() {
  document.getElementById('shopCoins').innerHTML = `🪙 ${data.coins} KOIN &nbsp;·&nbsp; 💎 ${data.diamonds} BERLIAN`;
  const grid = document.getElementById('skinGrid');
  grid.innerHTML = '';
  SKINS.forEach(s => {
    const unlocked = data.unlocked.includes(s.id);
    const selected = data.selectedSkin === s.id;
    const costType = s.costType || 'coin';
    const wallet = costType === 'diamond' ? data.diamonds : data.coins;
    const icon = costType === 'diamond' ? '💎' : '🪙';
    const card = document.createElement('div');
    card.className = 'skin-card' + (selected ? ' selected' : '');
    let btnHtml;
    if (selected) {
      btnHtml = `<button class="skin-btn selected" disabled>DIPAKAI</button>`;
    } else if (unlocked) {
      btnHtml = `<button class="skin-btn select" data-id="${s.id}" data-action="select">PILIH</button>`;
    } else if (s.rewardOnly) {
      btnHtml = `<button class="skin-btn locked" disabled>🔒 ${s.rewardLabel || 'HADIAH KHUSUS'}</button>`;
    } else {
      const afford = wallet >= s.cost;
      btnHtml = `<button class="skin-btn ${afford ? 'buy' : 'locked'}${costType === 'diamond' ? ' buy-diamond' : ''}" data-id="${s.id}" data-action="buy" ${afford ? '' : 'disabled'}>BELI ${icon}${s.cost}</button>`;
    }
    const swatchCanvas = document.createElement('canvas');
    swatchCanvas.width = 112; swatchCanvas.height = 88;
    swatchCanvas.className = 'skin-swatch';
    const affinityTag = s.affinity ? `<div class="skin-affinity-tag">${skinAffinityLabel(s.affinity)}</div>` : '';
    card.innerHTML = `<div class="skin-name">${s.name}</div>${affinityTag}${btnHtml}`;
    card.prepend(swatchCanvas);
    grid.appendChild(card);
    const sctx = swatchCanvas.getContext('2d');
    sctx.save();
    sctx.scale(2, 2);
    drawDinoShape(sctx, 4, 16, 40, 34, s, false, 0, 1);
    sctx.restore();
  });
  grid.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;
      if (action === 'buy') {
        const s = getSkin(id);
        const costType = s.costType || 'coin';
        if (costType === 'diamond') {
          if (data.diamonds >= s.cost) {
            data.diamonds -= s.cost;
            data.unlocked.push(id);
            data.selectedSkin = id;
            AudioMgr.sfx('buy');
            saveData();
            renderShop();
          }
        } else if (data.coins >= s.cost) {
          data.coins -= s.cost;
          data.unlocked.push(id);
          data.selectedSkin = id;
          AudioMgr.sfx('buy');
          saveData();
          renderShop();
        }
      } else if (action === 'select') {
        data.selectedSkin = id;
        AudioMgr.sfx('click');
        saveData();
        renderShop();
      }
    });
  });
  renderTrailShop();
}

function renderTrailShop() {
  const grid = document.getElementById('trailGrid');
  if (!grid) return;
  grid.innerHTML = '';
  TRAIL_EFFECTS.forEach(t => {
    const unlocked = data.unlockedTrails.includes(t.id);
    const selected = data.selectedTrail === t.id;
    const costType = t.costType || 'coin';
    const wallet = costType === 'diamond' ? data.diamonds : data.coins;
    const icon = costType === 'diamond' ? '💎' : '🪙';
    const card = document.createElement('div');
    card.className = 'skin-card' + (selected ? ' selected' : '');
    let btnHtml;
    if (selected) {
      btnHtml = `<button class="skin-btn selected" disabled>DIPAKAI</button>`;
    } else if (unlocked) {
      btnHtml = `<button class="skin-btn select" data-id="${t.id}" data-action="select">PILIH</button>`;
    } else if (t.rewardOnly) {
      btnHtml = `<button class="skin-btn locked" disabled>🔒 ${t.rewardLabel || 'HADIAH KHUSUS'}</button>`;
    } else {
      const afford = wallet >= t.cost;
      btnHtml = `<button class="skin-btn ${afford ? 'buy' : 'locked'}${costType === 'diamond' ? ' buy-diamond' : ''}" data-id="${t.id}" data-action="buy" ${afford ? '' : 'disabled'}>BELI ${icon}${t.cost}</button>`;
    }
    const swatchCanvas = document.createElement('canvas');
    swatchCanvas.width = 112; swatchCanvas.height = 60;
    swatchCanvas.className = 'skin-swatch';
    card.innerHTML = `<div class="skin-name">${t.name}</div>${btnHtml}`;
    card.prepend(swatchCanvas);
    grid.appendChild(card);
    const sctx = swatchCanvas.getContext('2d');
    sctx.fillStyle = t.color2 || t.color;
    for (let i = 0; i < 8; i++) {
      const px = 10 + i * 13, py = 30 + Math.sin(i) * 10;
      sctx.globalAlpha = 0.5 + (i / 8) * 0.5;
      sctx.beginPath();
      sctx.arc(px, py, 3 + (i / 8) * 4, 0, Math.PI * 2);
      sctx.fillStyle = t.type === 'rainbow' ? RAINBOW_COLORS[i % RAINBOW_COLORS.length] : (i % 2 === 0 ? t.color : (t.color2 || t.color));
      sctx.fill();
    }
    sctx.globalAlpha = 1;
  });
  grid.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;
      const t = getTrail(id);
      if (action === 'buy') {
        const costType = t.costType || 'coin';
        if (costType === 'diamond' && data.diamonds >= t.cost) {
          data.diamonds -= t.cost;
          data.unlockedTrails.push(id);
          data.selectedTrail = id;
          AudioMgr.sfx('buy'); saveData(); renderShop();
        } else if (costType !== 'diamond' && data.coins >= t.cost) {
          data.coins -= t.cost;
          data.unlockedTrails.push(id);
          data.selectedTrail = id;
          AudioMgr.sfx('buy'); saveData(); renderShop();
        }
      } else if (action === 'select') {
        data.selectedTrail = id;
        AudioMgr.sfx('click'); saveData(); renderShop();
      }
    });
  });
}

document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('modeBiasaBtn').addEventListener('click', startGame);
document.getElementById('modeQuestBtn').addEventListener('click', () => {
  if (data.castleProgress && data.castleProgress.completed) {
    alert('Kamu sudah menamatkan Story Mode: Kastil Tua! Total mantra terkumpul: ' + (data.castleMantraCount || 0) + '. Nantikan babak selanjutnya!');
    return;
  }
  startQuest(true);
});
document.getElementById('questContinueBtn').addEventListener('click', () => startQuest(true));
document.getElementById('shopBtnLobby').addEventListener('click', () => showScreen('shop'));
document.getElementById('modeFabBtn').addEventListener('click', () => showScreen('modeSelect'));
document.getElementById('modeSelectBackBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('shopBackBtn').addEventListener('click', () => showScreen('menu'));
document.querySelectorAll('.shop-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.shop-tab-panel').forEach(p => {
      p.style.display = p.dataset.panel === btn.dataset.tab ? '' : 'none';
    });
    AudioMgr.sfx('click');
  });
});
document.getElementById('retryBtn').addEventListener('click', () => {
  if (mode === 'quest') { startQuest(false); }
  else startGame();
});
document.getElementById('goLobbyBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('profilePillBtn').addEventListener('click', () => showScreen('account'));
document.getElementById('accountBackBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('serverLoginBtn').addEventListener('click', handleServerLogin);
document.getElementById('serverRegisterBtn').addEventListener('click', handleServerRegister);
document.getElementById('serverLogoutBtn').addEventListener('click', handleServerLogout);
document.getElementById('createProfileBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('newProfileName');
  const pinInput = document.getElementById('newProfilePin');
  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();
  if (pin && !/^\d{4,6}$/.test(pin)) { alert('PIN harus 4-6 digit angka, atau kosongkan saja.'); return; }
  createProfile(name, pin || null);
  nameInput.value = ''; pinInput.value = '';
  data = loadData();
  refreshLobbyStats();
  renderAccountScreen();
});
document.getElementById('exportSaveBtn').addEventListener('click', exportSave);
document.getElementById('importSaveBtn').addEventListener('click', () => {
  document.getElementById('importSaveFile').click();
});
document.getElementById('importSaveFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleImportSaveFile(file);
  e.target.value = '';
});
document.getElementById('resetDataBtn').addEventListener('click', () => {
  const profile = getActiveProfile();
  const label = profile ? `profil "${profile.name}"` : 'profil ini';
  if (confirm(`Hapus semua data tersimpan pada ${label} (koin, skin, progres story mode)? Tindakan ini tidak bisa dibatalkan.`)) {
    PROFILE_KEYS.forEach(k => localStorage.removeItem(profileStorageKey(getActiveProfileId(), k)));
    data = loadData();
    refreshLobbyStats();
    renderAccountScreen();
  }
});

/* ===================== GAME FLOW ===================== */
function startGame() {
  mode = 'normal';
  dino.w = 40; dino.h = 40;
  obstacles = [];
  coins = [];
  buffs = [];
  popups = [];
  dinoTrail = [];
  dustParticles = [];
  sparkles = [];
  activeBuffs = { speed: 0, jump: 0, coin2x: 0, shield: 0, magnet: 0, slowmo: 0, ghost: 0 };
  score = 0;
  runCoins = 0;
  runDiamonds = 0;
  coinStreak = 0;
  runBestStreak = 0;
  diamonds = [];
  lives = 3;
  invincible = 0;
  gameSpeed = 6;
  frame = 0;
  obstacleTimer = 0;
  coinTimer = 0;
  buffTimer = 0;
  diamondTimer = 0;
  nextBuffGap = 480 + Math.random() * 260;
  nextDiamondGap = 700 + Math.random() * 400;
  weatherScoreMark = 0;
  biomeScoreMark = 0;
  weatherSeen = new Set();
  biomeSeen = new Set();
  runStartMs = Date.now();
  ghostMission2AlertShown = false;
  resetDino();
  setWeather('clear');
  setBiome('padang');
  updateHud();
  showScreen('playing');
  // Ingetin pemain bonus skin yang lagi dipakai (biar kerasa "ngefek",
  // bukan cuma tersembunyi di balik layar) — cuma muncul kalau skin
  // yang dipakai memang punya bonus (skin gratis default tidak punya).
  const equippedAffinity = getSkin(data.selectedSkin).affinity;
  if (equippedAffinity) {
    setTimeout(() => {
      spawnPopup(dino.x + dino.w / 2, dino.y - 26, skinAffinityShortLabel(equippedAffinity), '#ffd63c');
    }, 200);
  }
}

function loseLife() {
  if (invincible > 0) return;
  lives--;
  invincible = 90;
  coinStreak = 0;
  AudioMgr.sfx('hit');
  flashRed();
  triggerShake();
  if (lives <= 0) endGame();
}

function registerStreak() {
  coinStreak++;
  if (coinStreak > data.bestStreak) data.bestStreak = coinStreak;
  if (coinStreak > runBestStreak) runBestStreak = coinStreak;
  if (coinStreak > 0 && coinStreak % 10 === 0) {
    const bonus = 5 * (coinStreak / 10);
    runCoins += bonus;
    spawnPopup(dino.x + dino.w / 2, dino.y - 26, `STREAK x${coinStreak}! +${bonus}`, '#ff9f43');
    spawnSparkles(dino.x + dino.w / 2, dino.y - 10, '#ff9f43', 16);
  }
}

function triggerShake() {
  canvas.classList.remove('shake');
  void canvas.offsetWidth;
  canvas.classList.add('shake');
}

function flashRed() {
  flashEl.style.background = '#ff4d4d';
  flashEl.style.opacity = '0.5';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 150);
}
function flashWhite() {
  flashEl.style.background = '#fff';
  flashEl.style.opacity = '0.85';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 120);
}

/* ===================== ACHIEVEMENTS ===================== */
const ACHIEVEMENTS = [
  { id: 'coin100',    icon: '🪙', label: 'Kolektor Koin',      check: d => d.coins >= 100 },
  { id: 'coin500',    icon: '💰', label: 'Sultan Koin',        check: d => d.coins >= 500 },
  { id: 'diamond25',  icon: '💎', label: 'Pemburu Berlian',    check: d => d.diamonds >= 25 },
  { id: 'diamond100', icon: '💠', label: 'Sultan Berlian',     check: d => d.diamonds >= 100 },
  { id: 'score1000',  icon: '🏁', label: 'Pelari Andal',       check: d => d.highScore >= 1000 },
  { id: 'score5000',  icon: '🚀', label: 'Pelari Legendaris',  check: d => d.highScore >= 5000 },
  { id: 'streak30',   icon: '🔥', label: 'Raja Combo',         check: d => d.bestStreak >= 30 },
  { id: 'allWeather', icon: '🌈', label: 'Penakluk Cuaca',     check: () => weatherSeen.size >= 4 },
  { id: 'allBiome',   icon: '🗺',  label: 'Penjelajah Dunia',   check: () => biomeSeen.size >= Object.keys(BIOMES).length }
];
function checkAchievements() {
  const unlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (!data.achievements.includes(a.id) && a.check(data)) {
      data.achievements.push(a.id);
      unlocked.push(a);
    }
  });
  return unlocked;
}
function renderAchievements() {
  const wrap = document.getElementById('achievementList');
  if (!wrap) return;
  wrap.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const isUnlocked = data.achievements.includes(a.id);
    const el = document.createElement('div');
    el.className = 'badge' + (isUnlocked ? ' unlocked' : '');
    el.innerHTML = `<div class="b-icon">${a.icon}</div><div class="b-label">${a.label}</div>`;
    wrap.appendChild(el);
  });
}

/* ===================== TANTANGAN HARIAN ===================== */
const DAILY_CHALLENGES = [
  { id: 'score300',  icon: '🏁', desc: 'Capai skor 300 dalam satu lari',              reward: 40, check: st => st.score >= 300 },
  { id: 'coins25',   icon: '🪙', desc: 'Kumpulkan 25 koin dalam satu lari',            reward: 40, check: st => st.coins >= 25 },
  { id: 'diamonds3', icon: '💎', desc: 'Kumpulkan 3 berlian dalam satu lari',          reward: 50, check: st => st.diamonds >= 3 },
  { id: 'streak15',  icon: '🔥', desc: 'Capai combo streak 15 tanpa kena rintangan',   reward: 45, check: st => st.streak >= 15 },
  { id: 'noHit',     icon: '🛡', desc: 'Capai skor 200+ tanpa kehilangan nyawa',       reward: 60, check: st => st.score >= 200 && st.noHit }
];
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function getDailyChallenge() {
  const t = todayString();
  if (data.dailyDate !== t) {
    data.dailyDate = t;
    let hash = 0;
    for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) >>> 0;
    data.dailyChallengeId = DAILY_CHALLENGES[hash % DAILY_CHALLENGES.length].id;
    data.dailyDone = false;
    data.dailyClaimed = false;
    saveData();
  }
  return DAILY_CHALLENGES.find(c => c.id === data.dailyChallengeId) || DAILY_CHALLENGES[0];
}
function checkDailyChallenge(runStats) {
  if (data.dailyDone) return false;
  const challenge = getDailyChallenge();
  if (challenge.check(runStats)) {
    data.dailyDone = true;
    return true;
  }
  return false;
}
function renderDailyChallenge() {
  const card = document.getElementById('dailyCard');
  if (!card) return;
  const challenge = getDailyChallenge();
  document.getElementById('dailyIcon').textContent = challenge.icon;
  document.getElementById('dailyDesc').textContent = challenge.desc;
  const claimBtn = document.getElementById('dailyClaimBtn');
  const badge = document.getElementById('dailyStatusBadge');
  const rewardLine = document.getElementById('dailyRewardLine');
  const iconBtn = document.getElementById('dailyIconBtn');
  card.classList.toggle('done', data.dailyDone);
  if (data.dailyClaimed) {
    claimBtn.style.display = 'none';
    card.classList.add('claimed');
    badge.textContent = '✅ SUDAH DIKLAIM';
    rewardLine.textContent = `🪙 +${challenge.reward} (terklaim)`;
    if (iconBtn) iconBtn.classList.remove('has-reward');
  } else if (data.dailyDone) {
    card.classList.remove('claimed');
    claimBtn.style.display = 'block';
    claimBtn.textContent = `KLAIM 🪙+${challenge.reward}`;
    badge.textContent = '✅ SELESAI';
    rewardLine.textContent = `Hadiah: 🪙 ${challenge.reward} koin`;
    if (iconBtn) iconBtn.classList.add('has-reward');
  } else {
    card.classList.remove('claimed');
    claimBtn.style.display = 'none';
    badge.textContent = '⏳ BELUM SELESAI';
    rewardLine.textContent = `Hadiah: 🪙 ${challenge.reward} koin`;
    if (iconBtn) iconBtn.classList.remove('has-reward');
  }
}
document.getElementById('dailyClaimBtn').addEventListener('click', () => {
  const challenge = getDailyChallenge();
  if (data.dailyDone && !data.dailyClaimed) {
    data.coins += challenge.reward;
    data.dailyClaimed = true;
    AudioMgr.sfx('claim');
    saveData();
    renderDailyChallenge();
    refreshLobbyStats();
  }
});
document.getElementById('dailyIconBtn').addEventListener('click', () => {
  renderDailyChallenge();
  document.getElementById('dailyOverlay').classList.add('active');
});
document.getElementById('dailyOverlayCloseBtn').addEventListener('click', () => {
  document.getElementById('dailyOverlay').classList.remove('active');
});
document.getElementById('dailyOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'dailyOverlay') e.target.classList.remove('active');
});

/* ===================== PENGATURAN (musik & suara) ===================== */
let hudScale = Math.min(1.3, Math.max(0.8, parseFloat(localStorage.getItem('dino_hudScale') || '1')));
let hudOpacity = parseFloat(localStorage.getItem('dino_hudOpacity') || '1');
let hudSide = localStorage.getItem('dino_hudSide') || 'left'; // posisi joystick: 'left' atau 'right'
function applyHudSettings() {
  const targets = [document.getElementById('castleControls'), document.getElementById('hudPreviewControls')];
  targets.forEach(el => {
    if (!el) return;
    el.style.setProperty('--hud-scale', hudScale);
    el.style.setProperty('--hud-opacity', hudOpacity);
    el.classList.toggle('hud-swap', hudSide === 'right');
  });
}
function setHudScale(v) { hudScale = v; localStorage.setItem('dino_hudScale', String(v)); applyHudSettings(); }
function setHudOpacity(v) { hudOpacity = v; localStorage.setItem('dino_hudOpacity', String(v)); applyHudSettings(); }
function setHudSide(v) { hudSide = v; localStorage.setItem('dino_hudSide', v); applyHudSettings(); }
applyHudSettings();
function refreshSettingsUI() {
  const musicBtn = document.getElementById('musicToggleBtn');
  const sfxBtn = document.getElementById('sfxToggleBtn');
  if (!musicBtn || !sfxBtn) return;
  musicBtn.textContent = AudioMgr.musicOn ? 'AKTIF' : 'NONAKTIF';
  musicBtn.classList.toggle('off', !AudioMgr.musicOn);
  sfxBtn.textContent = AudioMgr.sfxOn ? 'AKTIF' : 'NONAKTIF';
  sfxBtn.classList.toggle('off', !AudioMgr.sfxOn);
  document.getElementById('musicVolSlider').value = AudioMgr.musicVol;
  document.getElementById('sfxVolSlider').value = AudioMgr.sfxVol;
  document.querySelectorAll('.gfx-q-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.q === gfxQuality);
  });
  document.getElementById('hudScaleSlider').value = hudScale;
  document.getElementById('hudOpacitySlider').value = hudOpacity;
  const hudSideBtn = document.getElementById('hudSideToggleBtn');
  hudSideBtn.textContent = hudSide === 'left' ? 'KIRI' : 'KANAN';
  hudSideBtn.classList.toggle('off', hudSide === 'right');
}
document.querySelectorAll('.gfx-q-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setGfxQuality(btn.dataset.q);
    refreshSettingsUI();
    AudioMgr.sfx('click');
  });
});
document.getElementById('settingsIconBtn').addEventListener('click', () => {
  refreshSettingsUI();
  document.getElementById('settingsOverlay').classList.add('active');
});
document.getElementById('settingsCloseBtn').addEventListener('click', () => {
  document.getElementById('settingsOverlay').classList.remove('active');
});
document.getElementById('settingsOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'settingsOverlay') e.target.classList.remove('active');
});
document.getElementById('musicToggleBtn').addEventListener('click', () => {
  AudioMgr.setMusicOn(!AudioMgr.musicOn);
  refreshSettingsUI();
});
document.getElementById('sfxToggleBtn').addEventListener('click', () => {
  const turningOn = !AudioMgr.sfxOn;
  AudioMgr.setSfxOn(turningOn);
  refreshSettingsUI();
  if (turningOn) AudioMgr.sfx('click');
});
document.getElementById('musicVolSlider').addEventListener('input', (e) => {
  AudioMgr.setMusicVol(parseFloat(e.target.value));
});
document.getElementById('sfxVolSlider').addEventListener('input', (e) => {
  AudioMgr.setSfxVol(parseFloat(e.target.value));
});
document.getElementById('hudScaleSlider').addEventListener('input', (e) => {
  setHudScale(parseFloat(e.target.value));
});
document.getElementById('hudOpacitySlider').addEventListener('input', (e) => {
  setHudOpacity(parseFloat(e.target.value));
});
document.getElementById('hudSideToggleBtn').addEventListener('click', () => {
  setHudSide(hudSide === 'left' ? 'right' : 'left');
  refreshSettingsUI();
  AudioMgr.sfx('click');
});

/* ===================== BERITA / UPDATE LOG =====================
   Setiap kali game ini dirilis dengan fitur/perbaikan baru, cukup tambah
   satu entri baru di paling atas array NEWS_LIST (dan naikkan APP_VERSION).
   Pemain yang sebelumnya sudah main versi lama otomatis akan melihat
   titik notifikasi merah di ikon 📰 begitu mereka buka game versi baru ini. */
const APP_VERSION = '5.8';
const NEWS_LIST = [
  {
    version: '5.8',
    date: '30 Agu 2026',
    title: '💰 GOLDRAVEN Bangkit — Manifestasi Ketamakan!',
    items: [
      '🆕 Setelah AURELION tumbang, dino langsung lanjut lawan GOLDRAVEN — manifestasi Ketamakan sang Raja Vampir!',
      '💰 GOLDRAVEN: tubuh besar dipenuhi perhiasan (emas, permata, koin), pakai armor kerajaan lengkap dengan mahkota bergerigi.',
      '🎯 Kekuatan uniknya — "menyerap & melontarkan harta": tiap ~3.5 detik dia berkedip cincin emas lalu melontarkan proyektil harta ke arah dino. Ini boss jarak jauh pertama di Kastil, jadi harus pintar gerak/lompat buat ngehindar!',
      '💭 Setelah GOLDRAVEN tumbang, muncul kilas balik cerita soal keserakahannya usai menguasai domain selatan.',
      '🌑 4 manifestasi dosa lainnya (VELARIA, MIRRORA, GORGATH, RAVAGOR) + boss akhir SOMNARA masih coming soon, dibangun satu-satu di update berikutnya.'
    ]
  },
  {
    version: '5.7',
    date: '30 Agu 2026',
    title: '👑 CHAPTER 2 DIMULAI: AURELION — Manifestasi Kesombongan!',
    items: [
      '🆕 Chapter 2 gak lagi cuma "coming soon" — begitu Raja Vampir tumbang & animasi Alam Bawah Sadar selesai, dino LANGSUNG lawan AURELION, manifestasi pertama dari 7 dosa besar!',
      '👑 AURELION: mahkota emas retak, jubah hitam panjang, armor putih-keemasan, mata merah menyala, membawa pedang besar berukir "Vanity".',
      '🎲 Kekuatan unik AURELION — "ubah aturan permainan": tiap ~5 detik dia acak 1 efek (kontrol dibalik / gravitasi berat / lompat dikunci) yang aktif ~3 detik. Baca toast peringatannya biar gak kena jebak!',
      '💭 Setelah AURELION tumbang, muncul kilas balik cerita kenapa Raja Vampir jadi sombong (jatuhnya domain Laut Selatan) — lewat panel cerita baru.',
      '🌑 5 manifestasi dosa lainnya (GOLDRAVEN, VELARIA, MIRRORA, GORGATH, RAVAGOR) + boss akhir SOMNARA masih coming soon, dibangun satu-satu di update berikutnya.'
    ]
  },
  {
    version: '5.6',
    date: '30 Agu 2026',
    title: '🌑 Landing Akhir Chapter 1 Diganti: Alam Bawah Sadar!',
    items: [
      '🌑 Setelah Raja Vampir tumbang, dino sekarang jatuh ke ALAM BAWAH SADAR SANG RAJA VAMPIR — bukan makam kuno lagi. Kabut jiwa, pecahan kaca ingatan melayang, siluet takhta jauh dijaga 6 bayangan, dan mahkota emas retak melayang — semua nge-foreshadow cerita Chapter 2.',
      '📖 Lore lengkap 7 manifestasi dosa besar Raja Vampir (AURELION, GOLDRAVEN, VELARIA, MIRRORA, GORGATH, RAVAGOR, SOMNARA) sudah disimpan sebagai dokumen desain — siap dibangun jadi boss fight satu-satu di update berikutnya.'
    ]
  },
  {
    version: '5.5',
    date: '30 Agu 2026',
    title: '🏰 Story Mode: Portal Lantai, Sinematik Kemenangan & HUD Custom!',
    items: [
      '🐞 BUG FIX: kontrol Kastil (joystick, lompat, serang) kadang cuma bisa dipencet satu-satu — sekarang semua tombol bisa dipencet BARENGAN pakai jari beda.',
      '🐞 BUG FIX: dino suka lompat sendiri di Story Mode kalau layar kesentuh dikit (misal pas narik joystick) — sekarang tap-lompat cuma aktif di Mode Biasa.',
      '🐞 BUG FIX: cegah munculnya menu "copy/share" nempel pas nahan tombol kontrol kelamaan di iPhone.',
      '🐞 BUG FIX: HP bar "darah" Raja Vampir gak ilang pas animasi kemenangan Chapter 1 — ternyata Raja Vampir sempet ke-spawn ulang sepersekian detik gara-gara skor lantai belum direset pas cutscene mulai. Sekarang bener-bener hilang total begitu dia tumbang.',
      '🌀 Naik lantai sekarang lewat PORTAL — begitu target lantai selesai, portal muncul dan kamu harus masuk dulu baru pindah lantai.',
      '👑 SINEMATIK BARU begitu Raja Vampir tumbang di Lantai 4: portal raksasa muncul nutupin ruangan, dino kesedot masuk, animasi terowongan portal, lalu mendarat di makam kuno — ditutup teks "COMING SOON CHAPTER 2"!',
      '🧟 Model zombie & 🧛 vampir dirombak total — lebih detail & seram.',
      '🕹️ Kontrol Kastil dirapikan & diperbesar, 3 tombol serang disusun busur biar jempol gak perlu geser-geser.',
      '🎮 Pengaturan HUD Kastil baru: atur ukuran, transparansi, posisi joystick (kiri/kanan) — lengkap kotak PRATINJAU LIVE.',
      '🗑️ Skin "Naga Emas" dihapus dari hadiah tamat Chapter 1.'
    ]
  },
  {
    version: '5.0',
    date: '29 Agu 2026',
    title: '🏰 Story Mode Baru Total: Kastil Tua!',
    items: [
      '🧟 Story Mode dirombak total — dino terjebak di kastil tua berisi zombie & vampir!',
      '🕹️ Kontrol penuh: joystick analog + tombol lompat + 3 slot serangan.',
      '❤️ Sistem nyawa baru: HP bar 150, bisa nambah lewat Mantra Nyawa.',
      '✨ Mantra Skill membuka slot serangan baru (awalnya cuma 1 dari 3 yang aktif).',
      '🏰 4 lantai: zombie biasa → zombie mutasi → boss zombie raksasa → campuran + Raja Vampir!',
      '⚠️ Chapter 2 lama (naga terbang) sudah dihapus, digantikan cerita baru ini.'
    ]
  },
  {
    version: '4.2',
    date: '28 Agu 2026',
    title: 'Update 4.2 — Tab Shop Special',
    items: [
      '✨ Tab baru "SPECIAL" di Toko — segera hadir 20 September!'
    ]
  },
  {
    version: '4.1',
    date: '27 Agu 2026',
    title: 'Update 4.1 — Rintangan Tema Hantu',
    items: [
      '🪦 Selama Event Hantu, semua kaktus diganti jadi nisan bersalib — di SEMUA biome (gurun, salju, malam, dll), warnanya otomatis menyesuaikan biome-nya, bukan cuma satu warna dipaksain sama.'
    ]
  },
  {
    version: '4.0',
    date: '26 Agu 2026',
    title: '🎃 EVENT HANTU + Perbaikan Grafis & Profil — Update Besar!',
    items: [
      '🐞 Bug macet total di Kualitas Grafis Tinggi/4K — diperbaiki.',
      '🖼️ Posisi HUD disempurnakan: Cuaca sebaris Koin, Buff di bawah Cuaca.',
      '🦖 Bonus buff tiap skin sekarang jelas terlihat — ditandai di Toko & HUD.',
      '👤 Halaman Profil dapat panel "Skin Aktif" baru, section lebih rapi.',
      '📊 Kartu profil sekarang menampilkan skor tertinggi & koin.',
      '❄️ Hujan di biome Salju sekarang jadi Badai Salju (kepingan salju), bukan tetesan air.',
      '👻 EVENT HANTU dimulai! Lobby & Padang Rumput bertema hantu selama event, terbatas sampai 15 Sept 2026.',
      '🎯 2 misi baru — cek lewat ikon 👻 di lobby buat lihat progress & hadiahnya.',
      '🦴 Buff baru "Hantu": tembus pandang & bisa terobos rintangan sementara.',
      '🎁 Hadiah eksklusif: Skin "Hantu Kelana" & Jejak Kaki Hantu — cuma bisa didapat selama event.',
      '🖼️ Icon aplikasi juga ikut bertema hantu selama event berlangsung.'
    ]
  },
  {
    version: '2.9',
    date: '25 Agu 2026',
    title: 'Update Besar — Perbaikan & Fitur Baru',
    items: [
      '🐞 Bug macet total di Mode Biasa — diperbaiki.',
      '🔊 Suara tidak lagi jalan terus saat app ditutup.',
      '⏸️ Fitur baru: tombol Jeda saat main.',
      '⚙️ Fitur baru: Kualitas Grafis (Rendah–4K).',
      '👣 8 varian efek Jejak Kaki + rintangan baru.',
      '🛍️ Toko & tampilan HUD dirombak lebih modern.'
    ]
  },
  {
    version: '2.6',
    date: '23 Agu 2026',
    title: 'Update 2.6 — Musik & Pengaturan',
    items: [
      '🎵 Musik latar & efek suara baru di seluruh game.',
      '⚙️ Menu PENGATURAN baru: atur musik & efek suara (nyala/mati + volume).',
      '📰 Fitur BERITA baru (ini!) yang otomatis memberi tahu update terbaru.',
      '🎯 Tantangan Harian sekarang tampil lewat jendela popup tersendiri.',
      '🌈 Perbaikan tampilan judul lobi supaya benar-benar di tengah layar.',
      '🏷️ Nama studio diperbarui menjadi KyznStudio.'
    ]
  },
  {
    version: '2.5',
    date: '1 Agu 2026',
    title: 'Update 2.5 — Tantangan Harian',
    items: [
      '🎯 Tantangan Harian baru yang berganti otomatis setiap hari.',
      '🛍️ Perbaikan tampilan toko & lobi.'
    ]
  }
];
function renderNews() {
  const wrap = document.getElementById('newsList');
  if (!wrap) return;
  wrap.innerHTML = NEWS_LIST.map((n, i) => `
    <div class="news-entry${i === 0 ? ' latest' : ''}">
      <div class="news-entry-head">
        ${i === 0 ? '<span class="news-badge-new">BARU</span>' : ''}
        <span class="news-entry-title">${n.title}</span>
      </div>
      <div class="news-entry-date">v${n.version} · ${n.date}</div>
      <ul class="news-entry-items">${n.items.map(it => `<li>${it}</li>`).join('')}</ul>
    </div>
  `).join('');
}
function checkNewsUnread() {
  const lastSeen = localStorage.getItem('dino_lastSeenNews') || '';
  const latest = NEWS_LIST[0].version;
  const btn = document.getElementById('newsIconBtn');
  const unread = lastSeen !== latest;
  if (btn) btn.classList.toggle('has-reward', unread);
  return unread;
}
function markNewsRead() {
  localStorage.setItem('dino_lastSeenNews', NEWS_LIST[0].version);
  checkNewsUnread();
}
document.getElementById('newsIconBtn').addEventListener('click', () => {
  renderNews();
  document.getElementById('newsOverlay').classList.add('active');
  markNewsRead();
});
document.getElementById('newsCloseBtn').addEventListener('click', () => {
  document.getElementById('newsOverlay').classList.remove('active');
});
document.getElementById('newsOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'newsOverlay') e.target.classList.remove('active');
});
document.getElementById('introVersion').textContent = 'v' + APP_VERSION;
document.getElementById('titleVersionText').textContent = 'KyznStudio · v' + APP_VERSION;
checkNewsUnread();

/* ===================== PANEL EVENT HANTU ===================== */
function formatGhostCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}h ${h}j ${m}m lagi`;
  if (h > 0) return `${h}j ${m}m ${s}d lagi`;
  return `${m}m ${s}d lagi`;
}
function renderGhostEventPanel() {
  const countdownEl = document.getElementById('ghostCountdown');
  if (!ghostEventActive()) {
    countdownEl.textContent = 'Event sudah berakhir';
  } else {
    countdownEl.textContent = '⏳ Berakhir dalam: ' + formatGhostCountdown(ghostEventTimeLeft());
  }
  const eg = data.eventGhost;
  const m1Done = !!eg.mission1Done, m2Done = !!eg.mission2Done;
  const m1Progress = Math.min(eg.nightPasses || 0, GHOST_MISSION1_TARGET);
  const list = document.getElementById('ghostMissionList');
  list.innerHTML = `
    <div class="ghost-mission-item${m1Done ? ' done' : ''}">
      <div class="ghost-mission-title">${m1Done ? '✅' : '1️⃣'} Lewati Biome Malam Hari sebanyak ${GHOST_MISSION1_TARGET}x</div>
      <div class="ghost-mission-reward">🎁 Hadiah: Jejak Kaki Hantu</div>
      <div class="ghost-mission-bar-track"><div class="ghost-mission-bar-fill" style="width:${(m1Progress / GHOST_MISSION1_TARGET) * 100}%"></div></div>
      <div class="ghost-mission-progress-text">${m1Progress} / ${GHOST_MISSION1_TARGET}</div>
    </div>
    <div class="ghost-mission-item${m2Done ? ' done' : ''}">
      <div class="ghost-mission-title">${m2Done ? '✅' : '2️⃣'} Bertahan 6 menit dalam 1x main</div>
      <div class="ghost-mission-reward">🎁 Hadiah: Skin Hantu Kelana</div>
      <div class="ghost-mission-bar-track"><div class="ghost-mission-bar-fill" style="width:${m2Done ? 100 : 0}%"></div></div>
      <div class="ghost-mission-progress-text">${m2Done ? 'Selesai!' : 'Belum selesai'}</div>
    </div>`;
}
function updateGhostEventButtonVisibility() {
  const btn = document.getElementById('ghostEventBtn');
  const active = ghostEventActive();
  btn.classList.toggle('visible', active);
  if (active) {
    const bothDone = data.eventGhost.mission1Done && data.eventGhost.mission2Done;
    btn.classList.toggle('has-reward', !bothDone);
  }
}
document.getElementById('ghostEventBtn').addEventListener('click', () => {
  renderGhostEventPanel();
  document.getElementById('ghostEventOverlay').classList.add('active');
  AudioMgr.sfx('click');
});
document.getElementById('ghostEventCloseBtn').addEventListener('click', () => {
  document.getElementById('ghostEventOverlay').classList.remove('active');
});
document.getElementById('ghostEventOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'ghostEventOverlay') e.target.classList.remove('active');
});
// Countdown di-refresh tiap detik SELAMA panelnya lagi kebuka, biar hitung mundurnya jalan live.
setInterval(() => {
  if (document.getElementById('ghostEventOverlay').classList.contains('active')) {
    renderGhostEventPanel();
  }
}, 1000);
updateGhostEventButtonVisibility();

function endGame() {
  AudioMgr.sfx('gameover');
  const isNewBest = Math.floor(score) > data.highScore;
  if (isNewBest) data.highScore = Math.floor(score);
  data.coins += runCoins;
  data.diamonds += runDiamonds;
  const newlyUnlocked = checkAchievements();
  if (newlyUnlocked.length) AudioMgr.sfx('unlock');
  const dailyJustDone = checkDailyChallenge({ score: Math.floor(score), coins: runCoins, diamonds: runDiamonds, streak: runBestStreak, noHit: lives === 3 });
  saveData();
  document.getElementById('goStatsNormal').style.display = '';
  document.getElementById('goStatsQuest').style.display = 'none';
  document.getElementById('goTitle').textContent = isNewBest ? '🏆 SKOR TERBAIK BARU!' : 'GAME OVER';
  document.getElementById('goTitle').classList.toggle('new-best', isNewBest);
  document.getElementById('goScore').textContent = Math.floor(score);
  document.getElementById('goCoinsRun').textContent = runCoins;
  document.getElementById('goCoinsTotal').textContent = data.coins;
  document.getElementById('goDiamondsRun').textContent = runDiamonds;
  document.getElementById('goDiamondsTotal').textContent = data.diamonds;
  document.getElementById('goBest').textContent = data.highScore;
  document.getElementById('goBest').parentElement.classList.toggle('highlight-row', isNewBest);
  const achEl = document.getElementById('goAchievements');
  if (achEl) {
    const lines = [];
    if (newlyUnlocked.length) {
      lines.push('🏆 PRESTASI BARU: ' + newlyUnlocked.map(a => `${a.icon} ${a.label}`).join(' &nbsp;·&nbsp; '));
    }
    if (dailyJustDone) {
      const c = getDailyChallenge();
      lines.push(`🎯 TANTANGAN HARIAN SELESAI! Klaim 🪙+${c.reward} di lobby.`);
    }
    if (lines.length) {
      achEl.style.display = '';
      achEl.innerHTML = lines.join('<br>');
    } else {
      achEl.style.display = 'none';
    }
  }
  showScreen('gameover');
}

function updateHud() {
  hudScore.textContent = String(Math.floor(score)).padStart(4, '0');
  hudCoins.textContent = runCoins;
  hudDiamonds.textContent = runDiamonds;
  if (coinStreak >= 3) {
    streakPill.style.display = 'flex';
    hudStreak.textContent = coinStreak;
  } else {
    streakPill.style.display = 'none';
  }
  livesEl.innerHTML = '❤'.repeat(Math.max(lives, 0)) + '<span style="opacity:0.25">' + '❤'.repeat(Math.max(3 - lives, 0)) + '</span>';
  updateBuffRow();
}

/* ===================== DRAW HELPERS ===================== */
function drawDino() {
  const s = getSkin(data.selectedSkin);
  if (activeBuffs.speed > 0 && dinoTrail.length) {
    dinoTrail.forEach((t, i) => {
      drawDinoShape(ctx, t.x - (dinoTrail.length - i) * 6, t.y, dino.w, dino.h, s, t.jumping, t.frame, 0.12 + i * 0.05);
    });
  }
  // Bayangan lembut di bawah dino — cuma tampil di kualitas Tinggi/4K,
  // jadi perbedaan Rendah vs Tinggi kelihatan jelas dari sini.
  if (gfxQuality === 'tinggi' || gfxQuality === '4k') {
    const jumpH = Math.max(0, GROUND_Y - (dino.y + dino.h));
    const shrink = Math.max(0.35, 1 - jumpH / 140);
    ctx.save();
    ctx.globalAlpha = 0.28 * shrink;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(dino.x + dino.w / 2, GROUND_Y + 2, (dino.w * 0.5) * shrink, 5 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  let alpha = 1;
  if (invincible > 0 && Math.floor(frame / 5) % 2 === 0) alpha = 0.35;
  // Buff Hantu: badan dino jadi tembus pandang + kabut ungu tipis melayang di sekitarnya.
  if (activeBuffs.ghost > 0) {
    alpha *= 0.55;
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(frame * 0.15) * 0.08;
    ctx.fillStyle = '#b8a6ff';
    ctx.beginPath();
    ctx.ellipse(dino.x + dino.w / 2, dino.y + dino.h / 2, dino.w * 0.85, dino.h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (activeBuffs.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(94,200,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(dino.x + dino.w / 2, dino.y + dino.h / 2, dino.w * 0.75, dino.h * 0.75, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawDinoShape(ctx, dino.x, dino.y, dino.w, dino.h, s, dino.jumping, frame, alpha);
}

function cactusColors() {
  if (weather === 'rain') return { main: '#3d6b45', dark: '#28492e' };
  if (weather === 'wind') return { main: '#8a9a4f', dark: '#68762f' };
  return { main: '#3f9e4a', dark: '#2c7434' };
}
// Warna nisan/salib buat reskin Event Hantu — beda-beda ikut biome yang lagi
// aktif, jadi tetap "nyambung" walau lagi di gurun/salju/malam/dll, bukan
// cuma satu warna generik yang dipaksain sama di semua biome.
function ghostObstacleColors() {
  switch (biome) {
    case 'gurun': return { main: '#c9b088', dark: '#9a8058' };
    case 'salju': return { main: '#eef6fb', dark: '#b9cdda' };
    case 'malam': return { main: '#565668', dark: '#34343f' };
    case 'hutan': return { main: '#7f8f76', dark: '#4f5c48' };
    case 'pantai': return { main: '#cdbb9c', dark: '#a08e70' };
    default: return { main: '#9a95a6', dark: '#6b6678' }; // padang / default
  }
}

function drawObstacle(o) {
  if (o.type === 'lightning') {
    if (o.state === 'warning') {
      const pulse = Math.floor(frame / 6) % 2 === 0;
      ctx.fillStyle = pulse ? 'rgba(255, 210, 60, 0.85)' : 'rgba(255, 210, 60, 0.25)';
      ctx.fillRect(o.x, GROUND_Y - 4, o.w, 4);
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, 0);
      ctx.lineTo(o.x + o.w / 2, GROUND_Y - 4);
      ctx.strokeStyle = pulse ? 'rgba(255,210,60,0.4)' : 'rgba(255,210,60,0.1)';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.6, o.y);
      ctx.lineTo(o.x + o.w * 0.15, o.y + o.h * 0.55);
      ctx.lineTo(o.x + o.w * 0.45, o.y + o.h * 0.55);
      ctx.lineTo(o.x + o.w * 0.1, o.y + o.h);
      ctx.lineTo(o.x + o.w * 0.85, o.y + o.h * 0.4);
      ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  if (o.type === 'flyingLow') {
    // gagak: badan gelap, sayap runcing, paruh
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const wingPhase = Math.sin((frame + o.flap) * 0.35);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#3a3a42';
    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, o.w * 0.28, o.h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // head + beak
    ctx.beginPath();
    ctx.arc(o.w * 0.26, -o.h * 0.06, o.h * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b23c';
    ctx.beginPath();
    ctx.moveTo(o.w * 0.42, -o.h * 0.06);
    ctx.lineTo(o.w * 0.58, -o.h * 0.02);
    ctx.lineTo(o.w * 0.42, o.h * 0.06);
    ctx.closePath(); ctx.fill();
    // wings (flap)
    ctx.fillStyle = '#2b2b32';
    const wy = wingPhase * (o.h * 0.35);
    ctx.beginPath();
    ctx.moveTo(-o.w * 0.05, 0);
    ctx.lineTo(-o.w * 0.55, -wy - o.h * 0.1);
    ctx.lineTo(-o.w * 0.4, wy * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(o.w * 0.02, 0);
    ctx.lineTo(o.w * 0.4, wy + o.h * 0.1);
    ctx.lineTo(o.w * 0.3, -wy * 0.2);
    ctx.closePath(); ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(-o.w * 0.26, 0);
    ctx.lineTo(-o.w * 0.42, -o.h * 0.18);
    ctx.lineTo(-o.w * 0.42, o.h * 0.18);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }

  if (o.type === 'flyingHigh') {
    // elang: sayap lebar melayang, badan terang
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const glide = Math.sin((frame + o.flap) * 0.15) * (o.h * 0.15);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#9a7a4f';
    ctx.beginPath();
    ctx.ellipse(0, 0, o.w * 0.16, o.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a25c';
    // wide wings, mostly gliding with slight flap
    ctx.beginPath();
    ctx.moveTo(0, -o.h * 0.1);
    ctx.quadraticCurveTo(-o.w * 0.3, -o.h * 0.5 - glide, -o.w * 0.5, -o.h * 0.1 - glide * 0.4);
    ctx.quadraticCurveTo(-o.w * 0.22, o.h * 0.05, 0, o.h * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -o.h * 0.1);
    ctx.quadraticCurveTo(o.w * 0.3, -o.h * 0.5 + glide, o.w * 0.5, -o.h * 0.1 + glide * 0.4);
    ctx.quadraticCurveTo(o.w * 0.22, o.h * 0.05, 0, o.h * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a4326';
    ctx.beginPath(); ctx.arc(0, -o.h * 0.32, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  if (o.type === 'flyingDebris') {
    // dahan/ranting berputar tertiup angin
    o.rot += o.rotSpeed;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(o.rot);
    ctx.fillStyle = '#8a6a3f';
    roundRectPath(ctx, -o.w * 0.4, -3, o.w * 0.8, 6, 3); ctx.fill();
    ctx.fillStyle = '#6b4f2c';
    roundRectPath(ctx, -o.w * 0.1, -o.h * 0.32, 5, o.h * 0.3, 2); ctx.fill();
    ctx.fillStyle = '#7fa04a';
    ctx.beginPath(); ctx.ellipse(o.w * 0.22, -o.h * 0.1, 6, 3.5, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-o.w * 0.28, o.h * 0.12, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  if (o.type === 'batuKabut') {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#6b7478';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h * 0.6, o.w * 0.52, o.h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#565f63';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.35, o.y + o.h * 0.35, o.w * 0.3, o.h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (o.type === 'rockPile') {
    ctx.save();
    ctx.fillStyle = '#8a8a86';
    ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.28, o.y + o.h * 0.65, o.w * 0.3, o.h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9c9c96';
    ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.62, o.y + o.h * 0.55, o.w * 0.36, o.h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6f6f6a';
    ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.5, o.y + o.h * 0.8, o.w * 0.46, o.h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.5, o.y + o.h * 0.3); ctx.lineTo(o.x + o.w * 0.55, o.y + o.h * 0.55); ctx.stroke();
    ctx.restore();
    return;
  }

  if (o.type === 'logObstacle') {
    ctx.save();
    ctx.fillStyle = '#7a5233';
    roundRectPath(ctx, o.x, o.y, o.w, o.h, o.h * 0.45); ctx.fill();
    ctx.fillStyle = '#5c3c22';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(o.x + (o.w / 4) * i, o.y + o.h / 2, 2, o.h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8d3a8';
    ctx.beginPath(); ctx.ellipse(o.x + o.w - 4, o.y + o.h / 2, o.h * 0.4, o.h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9a25c';
    ctx.beginPath(); ctx.ellipse(o.x + o.w - 4, o.y + o.h / 2, o.h * 0.22, o.h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  if (o.type === 'snowMound') {
    ctx.save();
    ctx.fillStyle = '#eef6fa';
    roundRectPath(ctx, o.x, o.y + o.h * 0.25, o.w, o.h * 0.75, 10); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.5, o.y + o.h * 0.28, o.w * 0.42, o.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,210,225,0.55)';
    ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.3, o.y + o.h * 0.75, o.w * 0.28, o.h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(o.x + o.w * 0.65, o.y + o.h * 0.18, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  if (o.type === 'beehive') {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    o.swing += 0.06;
    const sway = Math.sin(o.swing) * 6;
    ctx.save();
    ctx.strokeStyle = 'rgba(90,70,40,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, o.y - 12); ctx.lineTo(cx + sway * 0.3, o.y); ctx.stroke();
    ctx.translate(cx + sway * 0.3, cy);
    ctx.fillStyle = '#e0a838';
    ctx.beginPath(); ctx.moveTo(0, -o.h / 2);
    ctx.lineTo(o.w * 0.4, -o.h * 0.15); ctx.lineTo(o.w * 0.34, o.h * 0.35);
    ctx.lineTo(0, o.h / 2); ctx.lineTo(-o.w * 0.34, o.h * 0.35);
    ctx.lineTo(-o.w * 0.4, -o.h * 0.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,20,0.5)'; ctx.lineWidth = 1;
    [-0.25, 0, 0.25].forEach(f => { ctx.beginPath(); ctx.moveTo(-o.w * 0.35, o.h * f); ctx.lineTo(o.w * 0.35, o.h * f); ctx.stroke(); });
    for (let i = 0; i < 3; i++) {
      const a = o.swing * 2 + i * 2.1;
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath(); ctx.arc(Math.cos(a) * (o.w * 0.7), Math.sin(a) * (o.h * 0.55), 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Selama Event Hantu: kaktus diganti jadi nisan bersalib, warnanya ikut
  // biome yang lagi aktif (gurun=batu pasir, salju=batu es, malam=batu gelap,
  // dll) — jadi tetap nyambung ke tema biome, bukan cuma "kaktus" yang aneh
  // kalau muncul di tengah salju.
  if (ghostEventActive()) {
    const gc = ghostObstacleColors();
    const drawTombstone = (tx, ty, tw, th) => {
      ctx.fillStyle = gc.main;
      roundRectPath(ctx, tx, ty + th * 0.12, tw, th * 0.88, tw * 0.35);
      ctx.fill();
      // salib kecil di atas nisan
      ctx.fillStyle = gc.dark;
      const cx = tx + tw / 2;
      ctx.fillRect(cx - Math.max(1.5, tw * 0.08), ty - th * 0.22, Math.max(3, tw * 0.16), th * 0.3);
      ctx.fillRect(cx - tw * 0.28, ty - th * 0.1, tw * 0.56, Math.max(3, tw * 0.16));
      // garis retak dekoratif di badan nisan
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx + tw * 0.3, ty + th * 0.5); ctx.lineTo(tx + tw * 0.42, ty + th * 0.75); ctx.stroke();
    };
    if (o.type === 'cactusGroup') {
      drawTombstone(o.x, o.y + 6, 14, o.h - 6);
      drawTombstone(o.x + 18, o.y - 4, 16, o.h + 4);
      drawTombstone(o.x + 37, o.y + 6, 15, o.h - 6);
    } else {
      drawTombstone(o.x, o.y, o.w, o.h);
    }
    return;
  }

  const cc = cactusColors();
  ctx.fillStyle = cc.main;
  if (o.type === 'cactusGroup') {
    roundRectPath(ctx, o.x, o.y, 12, o.h, 4); ctx.fill();
    roundRectPath(ctx, o.x + 18, o.y - 8, 12, o.h + 8, 4); ctx.fill();
    roundRectPath(ctx, o.x + 36, o.y, 14, o.h, 4); ctx.fill();
    ctx.fillStyle = cc.dark;
    ctx.fillRect(o.x + 4, o.y + 4, 3, o.h - 8);
    ctx.fillRect(o.x + 22, o.y, 3, o.h);
    ctx.fillRect(o.x + 41, o.y + 4, 3, o.h - 8);
  } else {
    roundRectPath(ctx, o.x, o.y, o.w, o.h, 6); ctx.fill();
    roundRectPath(ctx, o.x - 6, o.y + 8, 6, 10, 3); ctx.fill();
    roundRectPath(ctx, o.x + o.w, o.y + 14, 6, 10, 3); ctx.fill();
    ctx.fillStyle = cc.dark;
    ctx.fillRect(o.x + o.w / 2 - 2, o.y + 4, 3, o.h - 8);
  }
}

function drawCoin(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  const scaleX = Math.abs(Math.cos(c.spin));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c.r * 2.1);
  g.addColorStop(0, 'rgba(255,210,60,0.45)');
  g.addColorStop(1, 'rgba(255,210,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, c.r * 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.scale(Math.max(scaleX, 0.15), 1);
  const cg = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.3, 0, 0, 0, c.r);
  cg.addColorStop(0, '#fff2b8');
  cg.addColorStop(0.55, '#ffd23c');
  cg.addColorStop(1, '#e0a91f');
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = '#c9971f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(-3, -3, c.r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSparkle(s) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.size * (s.life / s.maxLife), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiamond(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  const scaleX = Math.abs(Math.cos(d.spin));
  ctx.scale(Math.max(scaleX, 0.2), 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.r * 1.8);
  g.addColorStop(0, 'rgba(126,227,255,0.55)');
  g.addColorStop(1, 'rgba(126,227,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, d.r * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -d.r);
  ctx.lineTo(d.r * 0.8, -d.r * 0.15);
  ctx.lineTo(0, d.r);
  ctx.lineTo(-d.r * 0.8, -d.r * 0.15);
  ctx.closePath();
  ctx.fillStyle = '#5ec8ff';
  ctx.fill();
  ctx.strokeStyle = '#2a8bc9';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -d.r);
  ctx.lineTo(d.r * 0.3, -d.r * 0.2);
  ctx.lineTo(0, d.r * 0.1);
  ctx.lineTo(-d.r * 0.3, -d.r * 0.2);
  ctx.closePath();
  ctx.fillStyle = '#cdf3ff';
  ctx.fill();
  ctx.restore();
}

function drawBuffItem(b) {
  const info = BUFF_TYPES[b.type];
  const by = b.y + Math.sin(b.bob) * 4;
  ctx.save();
  ctx.translate(b.x, by);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r * 2);
  g.addColorStop(0, info.color + 'aa');
  g.addColorStop(1, info.color + '00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, b.r * 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = info.color;
  ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(info.icon, 0, 1);
  ctx.restore();
  if (b.type === 'coin2x') {
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7a5a00';
    ctx.fillText('×2', b.x, by + b.r + 11);
    ctx.restore();
  }
}

function drawPopups() {
  popups.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / 55);
    const scale = p.life > 48 ? 1 + (55 - p.life) * 0.06 : 1;
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  });
}

/* BUGFIX (peta ikut biome asli saat cuaca berubah):
   Sebelumnya tiap cuaca (hujan/angin/kabut) punya set warna sendiri yang
   MENIMPA TOTAL warna biome — jadi mau lagi di gurun, salju, atau hutan,
   begitu hujan turun semua map keliatan sama semua (kaya map padang rumput
   default). Sekarang cuaca cuma "menoning" warna biome asli (blend ringan),
   jadi ciri khas tiap biome tetap kelihatan walau lagi hujan/berangin/berkabut. */
function hexToRgb(color) {
  // BUGFIX: fungsi ini dulu cuma bisa baca format '#rrggbb'. Padahal warna
  // biome yang sudah "dicampur" cuaca (lewat blendHex juga) keluarnya dalam
  // format 'rgb(r,g,b)', bukan hex — jadi kalau dipakai lagi ke blendHex
  // (misalnya di kualitas grafis Tinggi/4K), parsing-nya gagal total (NaN)
  // dan bikin game CRASH/macet. Sekarang fungsi ini bisa baca DUA format.
  if (color.startsWith('rgb')) {
    const m = color.match(/[\d.]+/g);
    return [parseInt(m[0], 10), parseInt(m[1], 10), parseInt(m[2], 10)];
  }
  const h = color.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}
function blendHex(hex, tintHex, amount) {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(tintHex);
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return `rgb(${r},${g},${b})`;
}
const WEATHER_TINT = {
  rain:  { color: '#3f4d5c', amount: 0.40 },
  wind:  { color: '#e8b96a', amount: 0.26 },
  kabut: { color: '#cdd4d6', amount: 0.55 }
};
function skyColors() {
  const base = activeBiomeDef(biome).sky;
  const tint = WEATHER_TINT[weather];
  if (!tint) return base;
  return [blendHex(base[0], tint.color, tint.amount), blendHex(base[1], tint.color, tint.amount * 0.7)];
}
function groundColors() {
  const g = activeBiomeDef(biome).ground;
  const tint = WEATHER_TINT[weather];
  if (!tint) return g;
  return {
    grass: blendHex(g.grass, tint.color, tint.amount),
    grassDark: blendHex(g.grassDark, tint.color, tint.amount),
    dirt: blendHex(g.dirt, tint.color, tint.amount * 0.8),
    dirtDark: blendHex(g.dirtDark, tint.color, tint.amount * 0.8)
  };
}
function hillColor(layer) {
  const h = activeBiomeDef(biome).hill;
  const base = layer === 'back' ? h.back : h.front;
  const tint = WEATHER_TINT[weather];
  if (!tint) return base;
  return blendHex(base, tint.color, tint.amount);
}

function drawBackground() {
  const [top, bottom] = skyColors();
  if (gfxQuality === 'rendah') {
    // Mode Rendah: langit warna FLAT (tanpa gradasi) — sengaja dibuat polos & tegas biar beda jauh sama mode lain.
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 0, VW, VH);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, top);
    if (gfxQuality === '4k' || gfxQuality === 'tinggi') g.addColorStop(0.55, blendHex(top, bottom, 0.5));
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  // sun / moon
  if (weather !== 'rain' && weather !== 'kabut') {
    const sx = VW * 0.82, sy = VH * 0.16, sr = 34;
    if (gfxQuality === 'rendah') {
      // Mode Rendah: matahari cuma lingkaran polos, tanpa glow sama sekali.
      ctx.fillStyle = weather === 'wind' ? '#ffcf6b' : (biome === 'malam' ? '#eef1ff' : '#ffe36b');
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    } else {
      const glowMul = gfxQuality === '4k' ? 3.1 : gfxQuality === 'tinggi' ? 2.6 : 2.2;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * glowMul);
      if (weather === 'wind') {
        sg.addColorStop(0, 'rgba(255,200,120,0.9)');
        sg.addColorStop(1, 'rgba(255,200,120,0)');
      } else if (biome === 'malam') {
        sg.addColorStop(0, 'rgba(210,220,255,0.85)');
        sg.addColorStop(1, 'rgba(210,220,255,0)');
      } else {
        sg.addColorStop(0, 'rgba(255,235,140,0.95)');
        sg.addColorStop(1, 'rgba(255,235,140,0)');
      }
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sx, sy, sr * glowMul, 0, Math.PI * 2); ctx.fill();
      // Mode 4K: tambahan lapisan bloom ekstra biar makin "menyala".
      if (gfxQuality === '4k') {
        const sg2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.5);
        sg2.addColorStop(0, 'rgba(255,255,255,0.55)');
        sg2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg2;
        ctx.beginPath(); ctx.arc(sx, sy, sr * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = weather === 'wind' ? '#ffcf6b' : (biome === 'malam' ? '#eef1ff' : '#ffe36b');
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      if (biome === 'malam' && weather === 'clear') {
        ctx.fillStyle = BIOMES.malam.sky[1];
        ctx.beginPath(); ctx.arc(sx - 10, sy - 8, sr * 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawFog() {
  fogPatches.forEach(f => {
    ctx.save();
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.w * 0.5, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawHillsLayer(list, offset, baseY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  const totalW = list.reduce((a, h) => a + h.w, 0) + list.length * 40 || 1;
  list.forEach(h => {
    let hx = (h.x - offset) % (totalW);
    if (hx < -h.w) hx += totalW;
    ctx.moveTo(hx, baseY);
    ctx.quadraticCurveTo(hx + h.w / 2, baseY - h.h, hx + h.w, baseY);
  });
  ctx.lineTo(VW, baseY + 200);
  ctx.lineTo(0, baseY + 200);
  ctx.closePath();
  ctx.fill();
}

function drawHills() {
  drawHillsLayer(hillsBack, hillOffsetBack, GROUND_Y - 6, hillColor('back'));
  drawHillsLayer(hillsFront, hillOffsetFront, GROUND_Y - 2, hillColor('front'));
}

function drawClouds() {
  ctx.fillStyle = weather === 'rain' ? 'rgba(70,70,80,0.75)' : 'rgba(255,255,255,0.9)';
  clouds.forEach(c => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.28, c.y - 6, c.w * 0.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRain() {
  if (isBlizzard()) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    rainDrops.forEach(d => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }
  ctx.strokeStyle = 'rgba(170,200,235,0.7)';
  ctx.lineWidth = 2;
  rainDrops.forEach(d => {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - 4, d.y + d.len);
    ctx.stroke();
  });
}

function drawWind() {
  ctx.strokeStyle = 'rgba(140,110,60,0.3)';
  ctx.lineWidth = 2;
  windLines.forEach(l => {
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x - l.len, l.y);
    ctx.stroke();
  });
  windLeaves.forEach(lf => {
    ctx.save();
    ctx.translate(lf.x, lf.y + Math.sin(lf.bob) * 6);
    ctx.rotate(lf.rot);
    ctx.fillStyle = lf.color;
    ctx.beginPath();
    ctx.moveTo(0, -lf.size);
    ctx.quadraticCurveTo(lf.size * 0.9, 0, 0, lf.size);
    ctx.quadraticCurveTo(-lf.size * 0.9, 0, 0, -lf.size);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -lf.size); ctx.lineTo(0, lf.size);
    ctx.stroke();
    ctx.restore();
  });
}

let groundOffset = 0;
function drawGround() {
  const gc = groundColors();
  // dirt
  const dg = ctx.createLinearGradient(0, GROUND_Y, 0, VH);
  dg.addColorStop(0, gc.dirt);
  dg.addColorStop(1, gc.dirtDark);
  ctx.fillStyle = dg;
  ctx.fillRect(0, GROUND_Y + 6, VW, VH - GROUND_Y - 6);

  // grass strip
  ctx.fillStyle = gc.grass;
  ctx.fillRect(0, GROUND_Y - 2, VW, 8);

  // grass tufts + pebbles — kerapatan ikut kualitas grafis biar bedanya kelihatan jelas:
  // Rendah = polos tanpa rumput sama sekali, 4K = paling rimbun & detail.
  if (gfxQuality === 'rendah') return;
  const spacing = gfxQuality === '4k' ? 12 : gfxQuality === 'tinggi' ? 16 : 22;
  const count = Math.ceil(VW / spacing) + 2;
  for (let i = 0; i < count; i++) {
    const x = (i * spacing - groundOffset % spacing);
    const variant = i % 3;
    if (variant !== 2) {
      ctx.fillStyle = gc.grassDark;
      ctx.fillRect(x, GROUND_Y - 6, 3, 6);
      ctx.fillRect(x + 5, GROUND_Y - 8, 3, 8);
      if (gfxQuality === '4k') { ctx.fillRect(x - 4, GROUND_Y - 5, 2, 5); }
    } else {
      ctx.fillStyle = gc.dirtDark;
      ctx.beginPath();
      ctx.ellipse(x + 4, GROUND_Y + 14, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ===================== COLLISION ===================== */
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh, pad) {
  return ax + pad < bx + bw - pad &&
         ax + aw - pad > bx + pad &&
         ay + pad < by + bh - pad &&
         ay + ah - pad > by + pad;
}

/* ===================== UPDATE ===================== */
function update() {
  frame++;
  if (frame % 30 === 0) checkGhostMission2(); // cek tiap ~0.5 detik, gak perlu tiap frame

  if (dino.jumping) {
    dino.vy += GRAVITY;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - dino.h) {
      dino.y = GROUND_Y - dino.h;
      dino.jumping = false;
      dino.vy = 0;
    }
  }

  if (invincible > 0) invincible--;

  const effSpeed = gameSpeed * (activeBuffs.slowmo > 0 ? 0.55 : 1);

  obstacleTimer++;
  if (obstacleTimer > nextObstacleGap) {
    spawnObstacle();
    obstacleTimer = 0;
    nextObstacleGap = 65 + Math.random() * 55 - Math.min(gameSpeed * 2, 28);
  }

  coinTimer++;
  if (coinTimer > 110) {
    if (Math.random() < 0.65) spawnCoin();
    coinTimer = 0;
  }

  buffTimer++;
  if (buffTimer > nextBuffGap) {
    spawnBuff();
    buffTimer = 0;
    nextBuffGap = 480 + Math.random() * 260;
  }

  diamondTimer++;
  if (diamondTimer > nextDiamondGap) {
    spawnDiamond();
    diamondTimer = 0;
    nextDiamondGap = 700 + Math.random() * 400;
  }

  obstacles.forEach(o => {
    o.x -= effSpeed;
    if (o.type === 'lightning' && o.state === 'warning') {
      o.timer++;
      if (o.timer >= o.warnFrames) {
        o.state = 'strike';
        o.strikeLife = 20;
        if (o.x < VW && o.x + o.w > 0) flashWhite();
      }
    }
    if (o.type === 'lightning' && o.state === 'strike') o.strikeLife--;
  });
  obstacles = obstacles.filter(o => {
    if (o.type === 'lightning' && o.state === 'strike' && o.strikeLife <= 0) return false;
    return o.x + o.w > -30;
  });

  coins.forEach(c => {
    c.x -= effSpeed; c.spin += 0.15;
    if (activeBuffs.magnet > 0) {
      const dx = (dino.x + dino.w / 2) - c.x, dy = (dino.y + dino.h / 2) - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 260) { c.x += dx * 0.18; c.y += dy * 0.18; }
    }
  });
  coins = coins.filter(c => !c.collected && c.x > -30);

  for (const o of obstacles) {
    if (o.type === 'lightning' && o.state !== 'strike') continue;
    if (activeBuffs.speed > 0) continue; // buff kecepatan = terobos rintangan sementara
    if (activeBuffs.ghost > 0) continue; // buff hantu = badan jadi tembus pandang, terobos rintangan
    if (rectOverlap(dino.x, dino.y, dino.w, dino.h, o.x, o.y, o.w, o.h, 6)) {
      if (activeBuffs.shield > 0) {
        activeBuffs.shield = 0;
        invincible = 60;
        flashWhite();
        spawnPopup(dino.x + dino.w / 2, dino.y - 10, 'PERISAI PECAH!', '#5ec8ff');
      } else {
        loseLife();
      }
    }
  }

  for (const c of coins) {
    if (c.collected) continue;
    const dx = (dino.x + dino.w / 2) - c.x;
    const dy = (dino.y + dino.h / 2) - c.y;
    if (Math.sqrt(dx * dx + dy * dy) < c.r + 18) {
      c.collected = true;
      runCoins += coinMultiplier();
      AudioMgr.sfx('coin');
      registerStreak();
      spawnSparkles(c.x, c.y, '#ffd23c', 7);
    }
  }

  buffs.forEach(b => { b.x -= effSpeed; b.bob += 0.08; });
  buffs = buffs.filter(b => !b.collected && b.x > -30);
  for (const b of buffs) {
    if (b.collected) continue;
    const dx = (dino.x + dino.w / 2) - b.x;
    const dy = (dino.y + dino.h / 2) - b.y;
    if (Math.sqrt(dx * dx + dy * dy) < b.r + 18) {
      b.collected = true;
      applyBuff(b.type);
      AudioMgr.sfx('unlock');
      spawnSparkles(b.x, b.y, BUFF_TYPES[b.type].color, 10);
    }
  }

  diamonds.forEach(dm => {
    dm.x -= effSpeed; dm.spin += 0.1;
    if (activeBuffs.magnet > 0) {
      const dx = (dino.x + dino.w / 2) - dm.x, dy = (dino.y + dino.h / 2) - dm.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 260) { dm.x += dx * 0.18; dm.y += dy * 0.18; }
    }
  });
  diamonds = diamonds.filter(dm => !dm.collected && dm.x > -30);
  for (const dm of diamonds) {
    if (dm.collected) continue;
    const dx = (dino.x + dino.w / 2) - dm.x;
    const dy = (dino.y + dino.h / 2) - dm.y;
    if (Math.sqrt(dx * dx + dy * dy) < dm.r + 18) {
      dm.collected = true;
      runDiamonds += 1;
      AudioMgr.sfx('diamond');
      spawnPopup(dino.x + dino.w / 2, dino.y - 10, '+1 💎', '#7fe3ff');
      registerStreak();
      spawnSparkles(dm.x, dm.y, '#7fe3ff', 12);
    }
  }

  sparkles.forEach(s => {
    s.x += s.vx; s.y += s.vy; s.vy += 0.08; s.life--;
  });
  sparkles = sparkles.filter(s => s.life > 0);

  ['speed', 'jump', 'coin2x', 'shield', 'magnet', 'slowmo', 'ghost'].forEach(k => { if (activeBuffs[k] > 0) activeBuffs[k]--; });

  if (activeBuffs.speed > 0) {
    dinoTrail.push({ x: dino.x, y: dino.y, jumping: dino.jumping, frame });
    if (dinoTrail.length > 4) dinoTrail.shift();
  } else if (dinoTrail.length) {
    dinoTrail = [];
  }

  if (!dino.jumping && frame % 6 === 0) {
    spawnTrailParticle(effSpeed);
  }
  dustParticles.forEach(d => { d.x += d.vx; d.life--; if (d.vy !== undefined) { d.y += d.vy; d.vy += (d.grav || 0); } if (d.rot !== undefined) d.rot += d.rotSpeed || 0; });
  dustParticles = dustParticles.filter(d => d.life > 0);

  popups.forEach(p => { p.y -= 0.6; p.life--; });
  popups = popups.filter(p => p.life > 0);

  if (weather === 'rain') {
    if (isBlizzard()) {
      rainDrops.forEach(d => {
        d.y += d.speed;
        d.swayPhase += d.swaySpeed;
        d.x += Math.sin(d.swayPhase) * 1.4 - effSpeed * 0.55; // melayang + tertiup angin badai
        if (d.y > VH) { d.y = -10; d.x = Math.random() * VW; }
        if (d.x < -10) d.x = VW + 10;
      });
    } else {
      rainDrops.forEach(d => {
        d.y += d.speed;
        d.x -= effSpeed * 0.3;
        if (d.y > VH) { d.y = -10; d.x = Math.random() * VW; }
        if (d.x < 0) d.x = VW;
      });
    }
  }
  if (weather === 'wind') {
    windLines.forEach(l => {
      l.x -= l.speed;
      if (l.x < -l.len) { l.x = VW + Math.random() * 100; l.y = Math.random() * GROUND_Y; }
    });
    windLeaves.forEach(lf => {
      lf.x -= lf.speed;
      lf.rot += lf.rotSpeed;
      lf.bob += 0.07;
      if (lf.x < -20) {
        lf.x = VW + Math.random() * 100;
        lf.y = Math.random() * GROUND_Y;
      }
    });
  }

  if (weather === 'kabut') {
    fogPatches.forEach(f => {
      f.x -= effSpeed * 0.2 + f.speed;
      if (f.x < -f.w) { f.x = VW + Math.random() * 100; f.y = GROUND_Y - 10 - Math.random() * 160; }
    });
  }

  groundOffset += effSpeed;
  hillOffsetBack += effSpeed * 0.2;
  hillOffsetFront += effSpeed * 0.4;
  clouds.forEach(c => {
    c.x -= effSpeed * (weather === 'wind' ? 0.9 : 0.3);
    if (c.x < -60) { c.x = VW + Math.random() * 100; c.y = 20 + Math.random() * (GROUND_Y * 0.3); }
  });

  score += 0.15;
  gameSpeed = Math.min(6 + score / 180, 13);

  maybeChangeWeather();
  maybeChangeBiome();
  updateHud();
}

/* ===================== DRAW ===================== */
function spawnTrailParticle(effSpeed) {
  const t = getTrail(data.selectedTrail);
  const baseX = dino.x + dino.w * 0.25, baseY = GROUND_Y - 2;
  const life = 16 + (t.type === 'leaf' || t.type === 'bubble' ? 10 : 0);
  const p = { x: baseX, y: baseY, life, maxLife: life, vx: -effSpeed * 0.5 - 1, vy: 0, type: t.type, color: t.color, color2: t.color2 };
  if (t.type === 'flame') { p.vy = -0.6; p.grav = -0.02; }
  else if (t.type === 'ice' || t.type === 'star') { p.vy = -0.3 - Math.random() * 0.3; }
  else if (t.type === 'leaf') { p.vy = -0.8; p.grav = 0.03; p.rot = Math.random() * Math.PI * 2; p.rotSpeed = (Math.random() - 0.5) * 0.25; }
  else if (t.type === 'electric') { p.vy = (Math.random() - 0.5) * 1.2; }
  else if (t.type === 'bubble') { p.vy = -0.9 - Math.random() * 0.4; }
  else if (t.type === 'rainbow') { p.color = RAINBOW_COLORS[Math.floor(Math.random() * RAINBOW_COLORS.length)]; p.vy = -0.4; }
  else if (t.type === 'ghost') { p.vy = -0.45; p.swayPhase = Math.random() * Math.PI * 2; }
  dustParticles.push(p);
}
function drawDust() {
  dustParticles.forEach(d => {
    ctx.save();
    const k = Math.max(0, d.life / d.maxLife);
    const age = d.maxLife - d.life;
    ctx.globalAlpha = k * 0.75;
    switch (d.type) {
      case 'flame': {
        const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 6 + age * 0.3);
        grad.addColorStop(0, d.color2); grad.addColorStop(1, d.color);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(d.x, d.y, 4 + age * 0.25, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ice': {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const r = 3 + age * 0.15;
          const px = d.x + Math.cos(a) * r, py = d.y + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'star': case 'rainbow': {
        ctx.fillStyle = d.color;
        ctx.translate(d.x, d.y);
        ctx.rotate(age * 0.15);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? 4 : 2;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'leaf': {
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot || 0);
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'electric': {
        ctx.strokeStyle = d.color; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(d.x - 4, d.y - 3);
        ctx.lineTo(d.x, d.y);
        ctx.lineTo(d.x - 3, d.y + 1);
        ctx.lineTo(d.x + 3, d.y + 4);
        ctx.stroke();
        break;
      }
      case 'bubble': {
        ctx.strokeStyle = d.color; ctx.fillStyle = d.color2; ctx.lineWidth = 1;
        ctx.globalAlpha = k * 0.35;
        ctx.beginPath(); ctx.arc(d.x, d.y, 3 + age * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'ghost': {
        // Gumpalan kabut hantu mini: lingkaran lembut dengan pinggir bawah
        // bergelombang, meniru siluet hantu kecil, melayang & memudar ke atas.
        if (d.swayPhase !== undefined) d.swayPhase += 0.12;
        const sway = Math.sin(d.swayPhase || 0) * 2;
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = d.color2 || d.color;
        ctx.beginPath();
        const r = 4 + age * 0.12;
        ctx.arc(d.x + sway, d.y, r, Math.PI, 0);
        for (let i = 0; i <= 3; i++) {
          const wx = d.x + sway - r + (i * (r * 2 / 3));
          const wy = d.y + (i % 2 === 0 ? r * 0.5 : r * 0.9);
          ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      default: {
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = d.color || '#a08a6a';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - (16 - d.life) * 0.4, 5 + (16 - d.life) * 0.3, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}
function draw() {
  drawBackground();
  drawClouds();
  if (weather === 'wind') drawWind();
  drawHills();
  drawGround();
  drawDust();
  coins.forEach(drawCoin);
  diamonds.forEach(drawDiamond);
  buffs.forEach(drawBuffItem);
  obstacles.forEach(drawObstacle);
  drawDino();
  sparkles.forEach(drawSparkle);
  drawPopups();
  if (weather === 'rain') drawRain();
  if (weather === 'kabut') drawFog();
}

/* ===================== LOOP ===================== */
function loop() {
  if (state === 'playing' && !paused) {
    if (mode === 'quest') {
      castleUpdate();
      castleDraw();
    } else {
      update();
      draw();
    }
  }
  requestAnimationFrame(loop);
}

/* ===================== INIT ===================== */
document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.classList.contains('skin-btn') || el.id === 'dailyClaimBtn') return;
  AudioMgr.sfx('click');
}, true);

document.body.dataset.gfx = gfxQuality;
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initClouds();
initHills();
resetDino();
showScreen('menu');
requestAnimationFrame(loop);
requestAnimationFrame(lobbyPreviewLoop);

/* ===================== INTRO / SPLASH ===================== */
(function initIntroScreen() {
  const introEl = document.getElementById('intro');
  if (!introEl) return;
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    AudioMgr.unlock();
    introEl.classList.add('hide');
    setTimeout(() => { introEl.style.display = 'none'; }, 650);
  };
  introEl.addEventListener('click', dismiss);
  introEl.addEventListener('touchend', (e) => { e.preventDefault(); dismiss(); }, { passive: false });
  setTimeout(dismiss, 4200);
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
