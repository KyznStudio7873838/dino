/* ===================== SETUP ===================== */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lobby = document.getElementById('lobby');
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
const qAgeLabel = document.getElementById('qAgeLabel');
const qAgeVal = document.getElementById('qAgeVal');
const qMapNameEl = document.getElementById('qMapName');
const qLivesEl = document.getElementById('qLives');
const bossBarWrap = document.getElementById('bossBarWrap');
const bossBarFill = document.getElementById('bossBarFill');
const bossNameEl = document.getElementById('bossName');
const attackBtn = document.getElementById('attackBtn');
const skillToast = document.getElementById('skillToast');
const storyOverlay = document.getElementById('storyOverlay');
const storyIcon = document.getElementById('storyIcon');
const storyComic = document.getElementById('storyComic');
const storyComicCtx = storyComic.getContext('2d');
const storyTitle = document.getElementById('storyTitle');
const storyText = document.getElementById('storyText');
const storyDots = document.getElementById('storyDots');
const storyBtn = document.getElementById('storyBtn');

let GROUND_Y = 0;
const GRAVITY = 0.6;
const JUMP_FORCE = -12.5;

/* ===================== SISTEM AKUN LOKAL (PROFIL + BACKUP) =====================
   Catatan jujur: game ini file HTML tunggal yang berjalan 100% offline tanpa
   server, jadi tidak memungkinkan login online/cloud sungguhan. Yang dibangun
   di sini untuk membuat data "lebih aman" adalah:
   1) Profil lokal bernama (bisa lebih dari satu di HP/browser yang sama) supaya
      data antar pemain tidak tercampur.
   2) Kunci PIN opsional per profil — pembatas ringan, BUKAN enkripsi sungguhan.
   3) Export/Import save ke file .json — ini cara paling nyata untuk menyelamatkan
      data kalau ganti HP, uninstall, atau membersihkan data browser.
================================================================================ */
const PROFILE_KEYS = ['highScore', 'coins', 'diamonds', 'unlocked', 'selectedSkin', 'questProgress', 'questCompleted', 'mantraCount', 'chapter2StageDone', 'chapter2IntroSeen', 'achievements', 'bestStreak'];
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
      achievements: data.achievements, bestStreak: data.bestStreak
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
    data = loadData();
    refreshLobbyStats();
    renderAccountScreen();
    alert('Save berhasil dipulihkan sebagai profil baru.');
  };
  reader.onerror = () => alert('Gagal membaca file save.');
  reader.readAsText(file);
}
function renderAccountScreen() {
  const activeId = getActiveProfileId();
  const list = loadProfileList();
  const wrap = document.getElementById('profileList');
  wrap.innerHTML = '';
  list.forEach(p => {
    const isActive = p.id === activeId;
    const row = document.createElement('div');
    row.className = 'profile-item' + (isActive ? ' active' : '');
    row.innerHTML = `
      <div class="p-avatar">${isActive ? '👑' : '🦖'}</div>
      <div class="p-info">
        <div class="p-name">${p.name}${p.pinHash ? ' 🔒' : ''}</div>
        <div class="p-meta">${isActive ? 'Profil aktif' : 'Tap untuk pindah'}</div>
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
    bestStreak: parseInt(get('bestStreak', '0'), 10)
  };
}
let data = loadData();
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
    // Buka semua skin hadiah (misal Naga Emas) begitu story mode tamat
    SKINS.filter(s => s.rewardOnly).forEach(s => {
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
  { id: 6, name: 'Naga Emas', cost: 0, rewardOnly: true, rewardLabel: 'Hadiah tamat Chapter 1',
    body: '#f2c33c', head: '#a9720f', belly: '#fff6c9', eye: '#ff5722',
    spikeStyle: 'flame', pattern: 'stars', tailStyle: 'spiked', horn: true, hornStyle: 'twin', hornColor: '#8a5a10',
    wings: true, wingColor: '#e8ac1f', wingLight: '#fff3b0',
    shimmer: true, shimmerColor: '#fff6cf', shimmerDark: '#c98a12', affinity: 'all' },
];
function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }

/* ===================== BUFFS ===================== */
const BUFF_TYPES = {
  speed:  { icon: '⚡', label: 'KECEPATAN',  color: '#ffb238', duration: 300 },
  jump:   { icon: '🦘', label: 'LOMPAT TINGGI', color: '#4fd6c8', duration: 360 },
  coin2x: { icon: '🪙', label: '2X KOIN',    color: '#ffd23c', duration: 420 },
  shield: { icon: '🛡',  label: 'PERISAI',    color: '#5ec8ff', duration: 400 },
  magnet: { icon: '🧲', label: 'MAGNET',     color: '#b06fff', duration: 360 },
  slowmo: { icon: '🐌', label: 'PERLAMBAT WAKTU', color: '#4fe0a0', duration: 260 },
  life:   { icon: '❤',  label: 'NYAWA',      color: '#ff5d7a', duration: 0 }
};
let activeBuffs = { speed: 0, jump: 0, coin2x: 0, shield: 0, magnet: 0, slowmo: 0 };
let dinoTrail = [];
let dustParticles = [];
let popups = [];

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
  for (const key in activeBuffs) {
    if (activeBuffs[key] > 0) {
      const info = BUFF_TYPES[key];
      const full = key === 'coin2x' ? 420 : info.duration;
      const pct = Math.max(0, Math.min(100, (activeBuffs[key] / full) * 100));
      html += `<div class="buff-chip">${info.icon}<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${info.color}"></div></div></div>`;
    }
  }
  buffRow.innerHTML = html;
}

/* ===================== QUEST MODE ===================== */
/* Kisah asal-usul si dino: dari kecil menetas di hutan purba, tumbuh besar
   menjelajahi gurun, dataran es, reruntuhan kota, hingga desa terpencil,
   menghadapi bos penguasa tiap wilayah untuk membuktikan dirinya. */
const MAPS = [
  {
    id: 'forest', name: 'Hutan Purba', ageStart: 0, ageEnd: 20,
    sky: ['#bfe6a0', '#eaffe0'], ground: '#4f9c36', groundDark: '#3a7326', dirt: '#6b4f2c',
    enemyName: 'Serigala Hutan', bossName: 'Raja Serigala', enemyColor: '#6b5a45', bossColor: '#4a3a28',
    introTitle: 'TELUR YANG MENETAS', introIcon: '🥚',
    introText: 'Di tengah rimbunnya Hutan Purba, sebutir telur retak perlahan.\nSeekor dino kecil menetas, sendirian, lemah, dan penuh rasa ingin tahu.\n\nIa belum tahu siapa dirinya — tapi hutan ini akan menjadi awal perjalanannya.',
    victoryText: 'Raja Serigala tumbang. Hutan Purba kini tenang.\nSang dino kecil merasakan sesuatu tumbuh dalam dirinya: keberanian.\n\nIa melangkah keluar dari rimbunnya pepohonan, menuju cakrawala baru...'
  },
  {
    id: 'desert', name: 'Gurun Tandus', ageStart: 20, ageEnd: 40,
    sky: ['#f2c98a', '#fdeccb'], ground: '#c9a870', groundDark: '#a8875a', dirt: '#b5915c',
    enemyName: 'Kalajengking Pasir', bossName: 'Kalajengking Purba', enemyColor: '#c98f3f', bossColor: '#8a5a1f',
    introTitle: 'MELINTASI GURUN', introIcon: '🏜️',
    introText: 'Dino kini lebih besar, langkahnya makin mantap.\nPasir panas terbentang luas, dan di baliknya bersembunyi\nmakhluk-makhluk pasir yang tak ramah.\n\nIa harus terus berjalan mencari asal-usulnya.',
    victoryText: 'Kalajengking Purba akhirnya kalah, terkubur pasirnya sendiri.\nDino merasakan tubuhnya makin kuat.\n\nDi kejauhan, ia melihat puncak putih menjulang: dataran es menantinya.'
  },
  {
    id: 'snow', name: 'Dataran Es', ageStart: 40, ageEnd: 60,
    sky: ['#c7dcec', '#eef6fb'], ground: '#e8f1f7', groundDark: '#c3d6e2', dirt: '#aebfcb',
    enemyName: 'Beruang Es', bossName: 'Beruang Es Raksasa', enemyColor: '#eaf3f8', bossColor: '#bcd6e6',
    introTitle: 'DINGINNYA DATARAN ES', introIcon: '❄️',
    introText: 'Udara dingin menusuk, namun dino tak gentar.\nSetengah perjalanan telah ia lalui, tubuhnya kini jauh lebih besar\ndari saat pertama menetas.\n\nDi balik badai salju, sesuatu yang besar sedang mengintai.',
    victoryText: 'Beruang Es Raksasa akhirnya tunduk.\nDino berdiri gagah di atas salju, bekas luka menjadi bukti perjuangannya.\n\nDi kejauhan, asap kelabu membumbung — reruntuhan sebuah kota tua.'
  },
  {
    id: 'city', name: 'Reruntuhan Kota', ageStart: 60, ageEnd: 80,
    sky: ['#9aa3b0', '#c9d0d8'], ground: '#6b6f75', groundDark: '#4a4d52', dirt: '#5a5d62',
    enemyName: 'Robot Penjaga', bossName: 'Robot Komandan', enemyColor: '#4a4d52', bossColor: '#2e3033',
    introTitle: 'KOTA YANG TERLUPAKAN', introIcon: '🏚️',
    introText: 'Reruntuhan kota tua berdiri sunyi, dijaga mesin-mesin tua\nyang masih beroperasi entah untuk siapa.\n\nDino kini hampir dewasa. Jawaban tentang asal-usulnya\nterasa semakin dekat.',
    victoryText: 'Robot Komandan runtuh berkeping-keping.\nDi antara reruntuhan, dino menemukan jejak purba — gambar dino lain\nseperti dirinya, digambar oleh tangan-tangan kuno.\n\nJejak itu menuntunnya ke sebuah desa kecil di ujung jalan.'
  },
  {
    id: 'village', name: 'Desa Terpencil', ageStart: 80, ageEnd: 100,
    sky: ['#f2b28a', '#ffe0c2'], ground: '#7fa04a', groundDark: '#5c7d33', dirt: '#8a6a3f',
    enemyName: 'Bandit Tombak', bossName: 'Kepala Bandit', enemyColor: '#5a4630', bossColor: '#3a2c1a',
    introTitle: 'DESA TERAKHIR', introIcon: '🏘️',
    introText: 'Di desa terpencil ini, penduduk bercerita tentang dino purba\nyang dulu menjaga tanah mereka — sebelum diusir para bandit.\n\nDino kini dewasa sepenuhnya. Inilah tempat ia berasal.',
    victoryText: 'Kepala Bandit kalah, dan desa kembali damai.\nPara penduduk mengenali sorot mata sang dino —\nia adalah keturunan penjaga tanah mereka yang telah lama hilang.\n\nPerjalanan dari telur kecil di hutan, hingga menjadi penjaga sejati,\nakhirnya sampai pada tujuannya.'
  }
];

const SKILLS = [
  { age: 10, name: 'Gigitan Kecil', dmg: 1, icon: '🦷' },
  { age: 20, name: 'Cakar Tajam', dmg: 1, icon: '🐾' },
  { age: 30, name: 'Sabetan Ekor', dmg: 2, icon: '💫' },
  { age: 40, name: 'Aum Kejut', dmg: 2, icon: '📢' },
  { age: 50, name: 'Serangan Purba', dmg: 3, icon: '🔥' },
];

let mode = 'normal'; // 'normal' | 'quest'
let qAge = 0;
let qMapIndex = 0;
let qLives = 3;
let qInvincible = 0;
let qSpeed = 5;
let qFrame = 0;
let qEntities = [];
let qEntityTimer = 0;
let qNextEntityGap = 80;
let qUnlockedSkills = [];
let qBossActive = false;
let qBoss = null;
let qBossDefeatedForMap = {};
let qAttackCooldown = 0;
let qAttackFlash = 0;
let qGroundOffset = 0;
let qPopups = [];
let qClouds = [];
let qPaused = false;
let storyQueue = [];
let inChapter2 = false;
let q2Y = 0;
let q2Vy = 0;
let q2Thrust = false;
let q2Entities = [];
let q2Timer = 0;
let q2NextGap = 90;
let q2MantraRun = 0;
const Q2_TARGET = 15;
let q2Speed = 4.5;
let q2Frame = 0;
let q2FireCooldown = 0;
let q2FireFlash = 0;
let q2Clouds = [];
let q2Weather = 'calm';
let q2WeatherTimer = 0;
let q2Lightnings = [];

function currentSkillDamage() {
  if (!qUnlockedSkills.length) return 0;
  return qUnlockedSkills[qUnlockedSkills.length - 1].dmg;
}
function questDinoSize() {
  const scale = 0.6 + Math.min(qAge, 100) / 100 * 0.8;
  return { w: Math.round(40 * scale), h: Math.round(40 * scale) };
}
function showToast(text) {
  skillToast.textContent = text;
  skillToast.classList.add('show');
  setTimeout(() => skillToast.classList.remove('show'), 2200);
}
/* ---- Halaman komik: SATU halaman penuh berisi beberapa panel sekaligus,
   dibaca sekali lihat seperti komik cetak asli — tidak ada tombol "next"
   untuk pindah antar-panel, hanya satu tombol lanjut per halaman/bab. ---- */
function panel(draw, caption) { return { draw, caption }; }
function queueStory(icon, title, text, onContinue, tone) {
  storyQueue.push({ title, text, onContinue, btnLabel: 'LANJUT', panels: [panel((c, w, h) => drawIconPanel(c, w, h, icon, tone), null)] });
}
function queueComic(title, draw, text, onContinue) {
  storyQueue.push({ title, text, onContinue, btnLabel: 'LANJUT', panels: [panel(draw, null)] });
}
/* Halaman multi-panel: panels = [{draw,caption}, ...] tampil sekaligus dalam 1 halaman */
function queueComicPage(title, panels, text, onContinue, btnLabel) {
  storyQueue.push({ title, text, onContinue, btnLabel: btnLabel || 'LANJUT', panels });
}
function wrapLines(cctx, text, maxWidth, maxLines) {
  const words = String(text).replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (cctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}
const ICON_PANEL_TONES = {
  danger: { sky: ['#3a1414', '#5c2424'], ground: '#20100c', accent: 'rgba(255,60,60,0.85)' },
  victory: { sky: ['#3a2e0c', '#5c4a18'], ground: '#241c08', accent: 'rgba(255,215,107,0.9)' },
  default: { sky: ['#161626', '#26263a'], ground: '#12121c', accent: 'rgba(255,255,255,0.55)' }
};
function drawIconPanel(cctx, w, h, icon, tone) {
  const pal = ICON_PANEL_TONES[tone] || ICON_PANEL_TONES.default;
  comicBg(cctx, w, h, pal.sky, pal.ground);
  comicDots(cctx, w, h, '#000', 0.14);
  comicSpeedLines(cctx, w, h, w / 2, h * 0.42, pal.accent);
  cctx.save();
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.font = Math.floor(Math.min(w, h) * 0.42) + 'px serif';
  cctx.fillText(icon || '🦖', w / 2, h * 0.42);
  cctx.restore();
  comicFrame(cctx, w, h);
}
/* Menyusun & menggambar SATU halaman komik penuh: judul, panel-panel, dan narasi
   SEMUA digambar di dalam kanvas komik itu sendiri — tidak ada teks di luar komik. */
function renderComicPage(title, panels, narration) {
  const pageW = 320;
  const gap = 7;
  const n = panels.length;
  const cols = n >= 4 ? 2 : 1;
  const rows = n >= 4 ? 2 : (n || 1);
  const panelW = Math.floor((pageW - gap * (cols + 1)) / cols);
  const panelH = Math.floor(panelW * (cols === 1 ? 0.58 : 0.8));
  const gridH = gap * (rows + 1) + panelH * rows;

  const cctx = storyComicCtx;
  const narrFont = '10px "Courier New", monospace';
  cctx.font = narrFont;
  const narrLineH = 13;
  const narrPad = 10;
  const narrLines = narration ? wrapLines(cctx, narration, pageW - 32, 24) : [];
  const narrH = narration ? (narrLines.length * narrLineH + narrPad * 2 + 6) : 0;
  const titleH = title ? 30 : 0;
  const pageH = titleH + gridH + (narration ? gap + narrH : gap * 0.4);

  storyComic.width = pageW;
  storyComic.height = pageH;
  cctx.fillStyle = '#d8cfb4';
  cctx.fillRect(0, 0, pageW, pageH);
  comicDots(cctx, pageW, pageH, '#8a7f5c', 0.35);
  cctx.strokeStyle = '#0c0c0c'; cctx.lineWidth = 5;
  cctx.strokeRect(2.5, 2.5, pageW - 5, pageH - 5);

  let y = 0;
  if (title) {
    cctx.save();
    cctx.fillStyle = '#161311';
    cctx.fillRect(4, 4, pageW - 8, titleH - 6);
    cctx.strokeStyle = '#ffd76b'; cctx.lineWidth = 2;
    cctx.strokeRect(6, 6, pageW - 12, titleH - 10);
    cctx.fillStyle = '#ffd76b';
    cctx.font = 'italic 900 15px "Courier New", monospace';
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    cctx.fillText(title.toUpperCase(), pageW / 2, titleH / 2 + 1);
    cctx.restore();
    y = titleH;
  }
  y += gap;
  panels.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gap + col * (panelW + gap);
    const py = y + row * (panelH + gap);
    cctx.save();
    cctx.translate(x, py);
    cctx.beginPath(); cctx.rect(0, 0, panelW, panelH); cctx.clip();
    p.draw(cctx, panelW, panelH);
    cctx.restore();
    cctx.strokeStyle = '#0c0c0c';
    cctx.lineWidth = 4;
    cctx.strokeRect(x + 2, py + 2, panelW - 4, panelH - 4);
    if (p.caption) {
      cctx.font = 'bold 9px "Courier New", monospace';
      const lines = wrapLines(cctx, p.caption, panelW - 16, 3);
      const capH = lines.length * 11 + 8;
      cctx.fillStyle = 'rgba(255,255,255,0.94)';
      cctx.fillRect(x + 5, py + panelH - capH - 5, panelW - 10, capH);
      cctx.strokeStyle = '#0c0c0c'; cctx.lineWidth = 1.4;
      cctx.strokeRect(x + 5, py + panelH - capH - 5, panelW - 10, capH);
      cctx.fillStyle = '#0c0c0c';
      cctx.textAlign = 'center';
      lines.forEach((ln, li) => cctx.fillText(ln, x + panelW / 2, py + panelH - capH + 6 + li * 11));
    }
  });

  if (narration) {
    const ny = y + gridH;
    cctx.fillStyle = 'rgba(255,255,255,0.96)';
    cctx.fillRect(8, ny, pageW - 16, narrH);
    cctx.strokeStyle = '#0c0c0c'; cctx.lineWidth = 2;
    cctx.strokeRect(8, ny, pageW - 16, narrH);
    cctx.fillStyle = '#161311';
    cctx.font = narrFont;
    cctx.textAlign = 'left';
    cctx.textBaseline = 'alphabetic';
    narrLines.forEach((ln, li) => cctx.fillText(ln, 16, ny + narrPad + 8 + li * narrLineH));
  }
}
function playNextStory() {
  if (!storyQueue.length) {
    storyOverlay.classList.remove('active');
    qPaused = false;
    return;
  }
  const s = storyQueue.shift();
  storyIcon.style.display = 'none';
  storyComic.style.display = 'block';
  renderComicPage(s.title, s.panels, s.text);
  storyOverlay.classList.add('active');
  qPaused = true;
  storyBtn.textContent = s.btnLabel || 'LANJUT';
  storyBtn.onclick = () => { if (s.onContinue) s.onContinue(); playNextStory(); };
}
/* ---- Komik ilustrasi: induk dino & lima bos yang membunuhnya ---- */
const PARENT_SKIN = { head: '#2e6b32', body: '#3f9a45', belly: '#eaffe0', eye: '#fff', horn: true, spikeStyle: 'crown', pattern: 'plain', tailStyle: 'spiked' };

/* Bingkai + tekstur ala komik cetak (garis tebal hitam + titik halftone) */
function comicVignette(cctx, w, h) {
  cctx.save();
  const g = cctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.25, w / 2, h * 0.42, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  cctx.fillStyle = g;
  cctx.fillRect(0, 0, w, h);
  cctx.restore();
}
function comicGroundShadow(cctx, cx, gy, rx, ry) {
  cctx.save();
  const sg = cctx.createRadialGradient(cx, gy, 1, cx, gy, rx);
  sg.addColorStop(0, 'rgba(0,0,0,0.4)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  cctx.fillStyle = sg;
  cctx.beginPath();
  cctx.ellipse(cx, gy, rx, ry, 0, 0, Math.PI * 2);
  cctx.fill();
  cctx.restore();
}
function comicFrame(cctx, w, h) {
  comicVignette(cctx, w, h);
  cctx.save();
  cctx.strokeStyle = '#0c0c0c';
  cctx.lineWidth = 7;
  cctx.strokeRect(3.5, 3.5, w - 7, h - 7);
  cctx.strokeStyle = 'rgba(255,255,255,0.35)';
  cctx.lineWidth = 1.4;
  cctx.strokeRect(7.5, 7.5, w - 15, h - 15);
  cctx.restore();
}
function comicDots(cctx, w, h, color, alpha) {
  cctx.save();
  cctx.globalAlpha = alpha;
  cctx.fillStyle = color;
  for (let yy = 8; yy < h - 6; yy += 9) {
    const shift = (Math.floor(yy / 9) % 2 === 0) ? 0 : 4.5;
    for (let xx = 8 + shift; xx < w - 6; xx += 9) {
      cctx.beginPath(); cctx.arc(xx, yy, 1.1, 0, Math.PI * 2); cctx.fill();
    }
  }
  cctx.restore();
}
function comicSpeedLines(cctx, w, h, cx, cy, color) {
  cctx.save();
  cctx.strokeStyle = color;
  cctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 / 10) * i;
    const r1 = Math.max(w, h) * 0.5, r2 = r1 + 14 + (i % 3) * 6;
    cctx.beginPath();
    cctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    cctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    cctx.stroke();
  }
  cctx.restore();
}
function comicImpactText(cctx, w, h, text, x, y, size, rot) {
  cctx.save();
  cctx.translate(x, y);
  cctx.rotate(rot || -0.08);
  cctx.font = `italic 900 ${size}px 'Courier New', monospace`;
  cctx.textAlign = 'center';
  cctx.lineWidth = 4;
  cctx.strokeStyle = '#0c0c0c';
  cctx.strokeText(text, 0, 0);
  cctx.fillStyle = '#ffe36b';
  cctx.fillText(text, 0, 0);
  cctx.restore();
}
function comicBg(cctx, w, h, sky, ground) {
  cctx.clearRect(0, 0, w, h);
  const g = cctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky[0]); g.addColorStop(0.65, sky[1]); g.addColorStop(1, sky[1]);
  cctx.fillStyle = g; cctx.fillRect(0, 0, w, h);
  // cahaya lembut di cakrawala biar langit tidak flat
  cctx.save();
  const hz = cctx.createRadialGradient(w * 0.5, h - 26, 2, w * 0.5, h - 26, w * 0.6);
  hz.addColorStop(0, 'rgba(255,255,255,0.22)');
  hz.addColorStop(1, 'rgba(255,255,255,0)');
  cctx.fillStyle = hz;
  cctx.fillRect(0, 0, w, h);
  cctx.restore();
  // tanah dengan gradasi tipis (bukan warna rata)
  const gg = cctx.createLinearGradient(0, h - 26, 0, h);
  gg.addColorStop(0, ground);
  gg.addColorStop(1, 'rgba(0,0,0,0.28)');
  cctx.fillStyle = gg;
  cctx.fillRect(0, h - 26, w, 26);
  cctx.save();
  cctx.strokeStyle = 'rgba(0,0,0,0.25)';
  cctx.lineWidth = 1.5;
  cctx.beginPath(); cctx.moveTo(0, h - 26); cctx.lineTo(w, h - 26); cctx.stroke();
  cctx.restore();
}

/* ---- Model dino kecil (bayi) didesain sendiri, bukan cuma versi mini dino dewasa ---- */
function drawBabyDinoShape(c, x, y, w, h, skin, jumping, walkFrame, alpha) {
  c.save();
  if (alpha !== undefined) c.globalAlpha = alpha;
  const cx = x + w * 0.46, gy = y + h;

  // ekor kecil melengkung
  c.fillStyle = skin.body;
  c.beginPath();
  c.moveTo(x - w * 0.02, gy - h * 0.42);
  c.quadraticCurveTo(x - w * 0.32, gy - h * 0.5, x - w * 0.22, gy - h * 0.22);
  c.quadraticCurveTo(x - w * 0.1, gy - h * 0.3, x + w * 0.06, gy - h * 0.34);
  c.closePath(); c.fill();

  // kaki mungil
  c.fillStyle = skin.head;
  const phase = Math.floor(walkFrame / 10) % 2 === 0;
  if (!jumping) {
    roundRectPath(c, x + w * 0.22, gy - h * 0.16, w * 0.14, phase ? h * 0.22 : h * 0.14, 3); c.fill();
    roundRectPath(c, x + w * 0.56, gy - h * 0.16, w * 0.14, phase ? h * 0.14 : h * 0.22, 3); c.fill();
  } else {
    roundRectPath(c, x + w * 0.22, gy - h * 0.16, w * 0.14, h * 0.18, 3); c.fill();
    roundRectPath(c, x + w * 0.56, gy - h * 0.16, w * 0.14, h * 0.18, 3); c.fill();
  }

  // badan bulat gemuk
  c.fillStyle = skin.body;
  c.beginPath();
  c.ellipse(cx, gy - h * 0.42, w * 0.4, h * 0.32, 0, 0, Math.PI * 2);
  c.fill();
  // perut
  c.fillStyle = skin.belly || '#fff';
  c.beginPath();
  c.ellipse(cx, gy - h * 0.32, w * 0.26, h * 0.18, 0, 0, Math.PI * 2);
  c.fill();

  // lengan mungil
  c.fillStyle = skin.body;
  c.save();
  c.translate(x + w * 0.72, gy - h * 0.38);
  c.rotate(0.5);
  roundRectPath(c, -w * 0.03, 0, w * 0.07, h * 0.16, 3);
  c.fill();
  c.restore();

  // duri kecil bulat di kepala (belum tumbuh besar)
  c.fillStyle = skin.head;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(x + w * 0.32 + i * w * 0.09, y + h * 0.06, w * 0.045, 0, Math.PI * 2);
    c.fill();
  }

  // kepala BESAR bulat (proporsi khas bayi)
  const headCx = x + w * 0.68, headCy = y + h * 0.28, headR = w * 0.36;
  c.fillStyle = skin.head;
  c.beginPath(); c.arc(headCx, headCy, headR, 0, Math.PI * 2); c.fill();
  // moncong kecil bulat
  c.beginPath();
  c.ellipse(headCx + headR * 0.75, headCy + headR * 0.2, headR * 0.32, headR * 0.24, 0, 0, Math.PI * 2);
  c.fill();

  // mata besar & imut (ciri khas bayi)
  const eyeX = headCx + headR * 0.15, eyeY = headCy - headR * 0.05;
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(eyeX, eyeY, headR * 0.42, 0, Math.PI * 2); c.fill();
  c.fillStyle = skin.eye && skin.eye !== '#fff' ? skin.eye : '#2a2a2a';
  c.beginPath(); c.arc(eyeX + headR * 0.1, eyeY + headR * 0.04, headR * 0.24, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(eyeX + headR * 0.2, eyeY - headR * 0.08, headR * 0.09, 0, Math.PI * 2); c.fill();

  // pipi merona
  c.fillStyle = 'rgba(255,140,140,0.45)';
  c.beginPath(); c.arc(headCx - headR * 0.15, headCy + headR * 0.45, headR * 0.22, 0, Math.PI * 2); c.fill();

  c.restore();
}

function sceneParentProud(cctx, w, h) {
  comicBg(cctx, w, h, MAPS[0].sky, MAPS[0].ground);
  comicGroundShadow(cctx, w / 2, h - 24, 46, 8);
  drawDinoShape(cctx, w / 2 - 55, h - 26 - 92, 110, 92, PARENT_SKIN, false, 0, 1);
  comicFrame(cctx, w, h);
}
function sceneAmbush(cctx, w, h) {
  comicBg(cctx, w, h, ['#3a1414', '#5c2424'], '#20100c');
  comicDots(cctx, w, h, '#000', 0.12);
  cctx.fillStyle = 'rgba(180,20,20,0.2)'; cctx.fillRect(0, 0, w, h);
  const gy = h - 26;
  const parentCx = w / 2, parentCy = gy - 42;
  comicSpeedLines(cctx, w, h, parentCx, parentCy, 'rgba(255,220,120,0.5)');
  drawDinoShape(cctx, w / 2 - 48, gy - 84, 96, 84, PARENT_SKIN, false, 0, 1);
  const spots = [[26, 58], [76, 30], [w - 76, 30], [w - 26, 58], [w / 2, 16]];
  MAPS.forEach((m, i) => drawBossByMapId(cctx, m.id, spots[i][0], spots[i][1], 46, 40, m.bossColor, false));
  cctx.strokeStyle = 'rgba(255,60,60,0.8)';
  cctx.lineWidth = 2.5;
  spots.forEach(p => { cctx.beginPath(); cctx.moveTo(p[0], p[1]); cctx.lineTo(w / 2, gy - 45); cctx.stroke(); });
  comicImpactText(cctx, w, h, 'GRRAAAHH!!', w / 2, 30, 20, -0.06);
  comicFrame(cctx, w, h);
}
function sceneFallen(cctx, w, h) {
  comicBg(cctx, w, h, ['#161626', '#26263a'], '#12121c');
  comicDots(cctx, w, h, '#000', 0.14);
  const gy = h - 26;
  cctx.save();
  cctx.globalAlpha = 0.55;
  drawDinoShape(cctx, w / 2 - 62, gy - 46, 124, 44, PARENT_SKIN, false, 0, 0.55);
  cctx.restore();
  const eggX = w * 0.78, eggY = gy - 20;
  const glow = cctx.createRadialGradient(eggX, eggY, 2, eggX, eggY, 30);
  glow.addColorStop(0, 'rgba(255,245,200,0.9)'); glow.addColorStop(1, 'rgba(255,245,200,0)');
  cctx.fillStyle = glow; cctx.beginPath(); cctx.arc(eggX, eggY, 30, 0, Math.PI * 2); cctx.fill();
  cctx.fillStyle = '#fff8e8';
  cctx.beginPath(); cctx.ellipse(eggX, eggY, 13, 16, 0, 0, Math.PI * 2); cctx.fill();
  comicFrame(cctx, w, h);
}
function sceneHatch(cctx, w, h) {
  comicBg(cctx, w, h, MAPS[0].sky, MAPS[0].ground);
  const gy = h - 26;
  const eggX = w / 2 - 30, eggY = gy - 16;
  cctx.fillStyle = '#fff8e8';
  cctx.beginPath(); cctx.ellipse(eggX, eggY, 11, 14, 0, 0, Math.PI * 2); cctx.fill();
  cctx.strokeStyle = '#c9b98a'; cctx.lineWidth = 1.5;
  cctx.beginPath(); cctx.moveTo(eggX - 7, eggY - 9); cctx.lineTo(eggX + 1, eggY - 1); cctx.lineTo(eggX - 5, eggY + 6); cctx.stroke();
  const skin = getSkin(data.selectedSkin);
  drawBabyDinoShape(cctx, w / 2 - 14, gy - 46, 56, 46, skin, false, 0, 1);
  comicFrame(cctx, w, h);
}
function sceneVictoryFlashback(mapIndex) {
  return function (cctx, w, h) {
    const map = MAPS[mapIndex];
    comicBg(cctx, w, h, map.sky, map.ground);
    const gy = h - 26;
    const sz = questDinoSize();
    const skin = getSkin(data.selectedSkin);
    const isBaby = qAge < 20;
    const dw = Math.max(60, sz.w * 1.7), dh = Math.max(50, sz.h * 1.7);
    comicGroundShadow(cctx, w / 2, gy - 4, dw * 0.42, 7);
    if (isBaby) {
      drawBabyDinoShape(cctx, w / 2 - dw / 2, gy - dh, dw, dh, skin, false, 0, 1);
    } else {
      drawDinoShape(cctx, w / 2 - dw / 2, gy - dh, dw, dh, skin, false, 0, 1);
    }
    cctx.save();
    cctx.globalAlpha = 0.45;
    drawBossByMapId(cctx, map.id, w / 2 + dw * 0.42, gy - 6, 50, 44, map.bossColor, false);
    cctx.restore();
    const positions = [24, 76, w / 2, w - 76, w - 24];
    MAPS.forEach((m, i) => {
      const defeated = i <= mapIndex;
      cctx.save();
      cctx.globalAlpha = defeated ? 1 : 0.35;
      drawCreatureByMapId(cctx, m.id, positions[i], 20, 22, 18, m.bossColor, false);
      cctx.restore();
      if (defeated) {
        cctx.strokeStyle = '#7ed957'; cctx.lineWidth = 2;
        cctx.beginPath();
        cctx.moveTo(positions[i] - 8, 20); cctx.lineTo(positions[i] - 2, 27); cctx.lineTo(positions[i] + 9, 11);
        cctx.stroke();
      }
    });
    comicFrame(cctx, w, h);
  };
}

/* ---- Komik penutup: dino purba bangkit menjadi naga setelah bos terakhir tumbang ---- */
function sceneStandOnFallenBoss(mapIndex) {
  return function (cctx, w, h) {
    const map = MAPS[mapIndex];
    comicBg(cctx, w, h, map.sky, map.ground);
    comicDots(cctx, w, h, '#000', 0.12);
    const gy = h - 26;
    comicGroundShadow(cctx, w / 2, gy - 2, w * 0.34, 8);
    // bos terakhir tumbang tergeletak di tanah
    cctx.save();
    cctx.translate(w / 2, gy - 16);
    cctx.rotate(-1.35);
    cctx.globalAlpha = 0.92;
    drawBossByMapId(cctx, map.id, 0, 0, 62, 52, map.bossColor, false);
    cctx.restore();
    // dino berdiri gagah di atasnya
    const skin = getSkin(data.selectedSkin);
    const dw = 66, dh = 56;
    drawDinoShape(cctx, w / 2 - dw / 2, gy - 40 - dh, dw, dh, skin, false, 0, 1);
    comicSpeedLines(cctx, w, h, w / 2, gy - 56, 'rgba(255,215,107,0.55)');
    comicImpactText(cctx, w, h, 'MENANG!!', w / 2, 22, 15, -0.05);
    comicFrame(cctx, w, h);
  };
}
function sceneDragonAwakening(cctx, w, h) {
  comicBg(cctx, w, h, ['#241030', '#3a1a4a'], '#150a1c');
  comicDots(cctx, w, h, '#000', 0.12);
  const gy = h - 26;
  const cx = w / 2, cy = gy - 40;
  const glow = cctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.62);
  glow.addColorStop(0, 'rgba(255,190,90,0.9)');
  glow.addColorStop(0.55, 'rgba(210,90,220,0.35)');
  glow.addColorStop(1, 'rgba(210,90,220,0)');
  cctx.fillStyle = glow;
  cctx.beginPath(); cctx.arc(cx, cy, w * 0.62, 0, Math.PI * 2); cctx.fill();
  comicGroundShadow(cctx, cx, gy - 2, 34, 7);

  const skin = getSkin(data.selectedSkin);
  const dw = 72, dh = 60;
  // sayap baru yang mulai tumbuh, transparan & bercahaya
  cctx.save();
  cctx.globalAlpha = 0.8;
  cctx.fillStyle = 'rgba(150,60,190,0.7)';
  cctx.beginPath();
  cctx.moveTo(cx - dw * 0.05, gy - dh * 0.85);
  cctx.quadraticCurveTo(cx - dw * 0.95, gy - dh * 1.35, cx - dw * 0.78, gy - dh * 0.4);
  cctx.quadraticCurveTo(cx - dw * 0.5, gy - dh * 0.6, cx - dw * 0.05, gy - dh * 0.62);
  cctx.closePath(); cctx.fill();
  cctx.beginPath();
  cctx.moveTo(cx + dw * 0.55, gy - dh * 0.85);
  cctx.quadraticCurveTo(cx + dw * 1.45, gy - dh * 1.35, cx + dw * 1.28, gy - dh * 0.4);
  cctx.quadraticCurveTo(cx + dw * 1.0, gy - dh * 0.6, cx + dw * 0.55, gy - dh * 0.62);
  cctx.closePath(); cctx.fill();
  cctx.strokeStyle = 'rgba(255,220,150,0.7)'; cctx.lineWidth = 1.2;
  cctx.stroke();
  cctx.restore();

  drawDinoShape(cctx, cx - dw / 2, gy - dh, dw, dh, skin, false, 0, 1);

  // tanduk besar melengkung yang baru tumbuh
  cctx.save();
  cctx.fillStyle = '#2a2a2a'; cctx.strokeStyle = '#0c0c0c'; cctx.lineWidth = 1;
  cctx.beginPath();
  cctx.moveTo(cx + dw * 0.26, gy - dh - 2);
  cctx.quadraticCurveTo(cx + dw * 0.5, gy - dh - 26, cx + dw * 0.4, gy - dh - 34);
  cctx.quadraticCurveTo(cx + dw * 0.34, gy - dh - 14, cx + dw * 0.2, gy - dh);
  cctx.closePath(); cctx.fill(); cctx.stroke();
  cctx.restore();

  comicSpeedLines(cctx, w, h, cx, cy, 'rgba(255,215,107,0.6)');
  comicImpactText(cctx, w, h, 'BERUBAH!!', w / 2, 22, 14, 0.05);
  comicFrame(cctx, w, h);
}
function sceneDragonFireBreath(cctx, w, h) {
  comicBg(cctx, w, h, ['#1a0e08', '#3a1a0c'], '#100704');
  comicDots(cctx, w, h, '#000', 0.14);
  const gy = h - 26;
  const cx = w * 0.34, cy = gy - 36;
  comicGroundShadow(cctx, cx, gy - 2, 40, 8);

  const dragonSkin = { head: '#5a1414', body: '#8c2424', belly: '#ffb347', eye: '#ffe36b', horn: true, spikeStyle: 'flame', pattern: 'plain', tailStyle: 'spiked' };
  // sayap naga terbentang lebar
  cctx.save();
  cctx.fillStyle = 'rgba(100,20,20,0.88)';
  cctx.strokeStyle = 'rgba(20,5,5,0.8)'; cctx.lineWidth = 1.5;
  cctx.beginPath();
  cctx.moveTo(cx + 8, gy - 56);
  cctx.quadraticCurveTo(cx + 68, gy - 96, cx + 56, gy - 16);
  cctx.quadraticCurveTo(cx + 32, gy - 40, cx + 8, gy - 38);
  cctx.closePath(); cctx.fill(); cctx.stroke();
  cctx.restore();

  drawDinoShape(cctx, cx - 36, gy - 64, 72, 64, dragonSkin, false, 0, 1);

  // semburan api besar dari mulut
  const fx = cx + 38, fy = gy - 44;
  const fg = cctx.createLinearGradient(fx, fy, w, fy);
  fg.addColorStop(0, 'rgba(255,255,225,0.95)');
  fg.addColorStop(0.35, 'rgba(255,170,40,0.92)');
  fg.addColorStop(0.7, 'rgba(230,70,20,0.8)');
  fg.addColorStop(1, 'rgba(230,70,20,0)');
  cctx.fillStyle = fg;
  cctx.beginPath();
  cctx.moveTo(fx, fy - 9);
  cctx.quadraticCurveTo(w * 0.66, fy - 32, w, fy - 5);
  cctx.quadraticCurveTo(w * 0.7, fy + 7, fx, fy + 9);
  cctx.closePath(); cctx.fill();
  for (let i = 0; i < 4; i++) {
    cctx.beginPath();
    cctx.fillStyle = i % 2 === 0 ? 'rgba(255,220,120,0.85)' : 'rgba(255,140,40,0.8)';
    cctx.arc(fx + 20 + i * (w - fx) / 5, fy - 4 + Math.sin(i) * 8, 5 - i * 0.6, 0, Math.PI * 2);
    cctx.fill();
  }

  comicImpactText(cctx, w, h, 'HOOAARR!!', w * 0.6, h * 0.26, 14, -0.05);
  comicFrame(cctx, w, h);
}
function sceneDragonRoar(cctx, w, h) {
  comicBg(cctx, w, h, ['#150a1c', '#2a1030'], '#0d0710');
  comicDots(cctx, w, h, '#000', 0.14);
  const gy = h - 26;
  const cx = w / 2, cy = gy - 40;
  cctx.save();
  for (let i = 0; i < 3; i++) {
    cctx.beginPath();
    cctx.strokeStyle = `rgba(255,215,107,${0.5 - i * 0.14})`;
    cctx.lineWidth = 3 - i * 0.6;
    cctx.arc(cx, cy - 6, 30 + i * 22, 0, Math.PI * 2);
    cctx.stroke();
  }
  cctx.restore();
  comicGroundShadow(cctx, cx, gy - 2, 46, 9);

  const dragonSkin = getSkin(6);
  const dw = 84, dh = 68;
  cctx.save();
  cctx.fillStyle = 'rgba(180,120,20,0.85)';
  cctx.strokeStyle = 'rgba(60,35,5,0.85)'; cctx.lineWidth = 1.5;
  cctx.beginPath();
  cctx.moveTo(cx - dw * 0.1, gy - dh * 0.9);
  cctx.quadraticCurveTo(cx - dw * 1.1, gy - dh * 1.5, cx - dw * 0.9, gy - dh * 0.3);
  cctx.quadraticCurveTo(cx - dw * 0.55, gy - dh * 0.55, cx - dw * 0.1, gy - dh * 0.6);
  cctx.closePath(); cctx.fill(); cctx.stroke();
  cctx.beginPath();
  cctx.moveTo(cx + dw * 0.6, gy - dh * 0.9);
  cctx.quadraticCurveTo(cx + dw * 1.6, gy - dh * 1.5, cx + dw * 1.4, gy - dh * 0.3);
  cctx.quadraticCurveTo(cx + dw * 1.05, gy - dh * 0.55, cx + dw * 0.6, gy - dh * 0.6);
  cctx.closePath(); cctx.fill(); cctx.stroke();
  cctx.restore();

  cctx.save();
  cctx.translate(cx, gy - dh * 0.4);
  cctx.rotate(-0.12);
  cctx.translate(-cx, -(gy - dh * 0.4));
  drawDinoShape(cctx, cx - dw / 2, gy - dh, dw, dh, dragonSkin, false, 0, 1);
  cctx.restore();

  comicSpeedLines(cctx, w, h, cx, cy - 10, 'rgba(255,215,107,0.7)');
  comicImpactText(cctx, w, h, 'GRAOOOARR!!', cx, h * 0.2, 16, -0.04);
  comicFrame(cctx, w, h);
}
function sceneDragonEvolved(cctx, w, h) {
  comicBg(cctx, w, h, ['#1a0a2e', '#341454'], '#0d0518');
  comicDots(cctx, w, h, '#000', 0.14);
  const gy = h - 24;
  const cx = w / 2, cy = gy - 46;

  cctx.save();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 / 8) * i + 0.3;
    const rx = cx + Math.cos(a) * (w * 0.38);
    const ry = cy + Math.sin(a) * (h * 0.24);
    cctx.save();
    cctx.translate(rx, ry);
    cctx.font = '12px serif';
    cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
    cctx.globalAlpha = 0.8;
    cctx.fillText('📜', 0, 0);
    cctx.restore();
  }
  cctx.restore();

  const glow = cctx.createRadialGradient(cx, cy, 6, cx, cy, w * 0.72);
  glow.addColorStop(0, 'rgba(200,120,255,0.75)');
  glow.addColorStop(0.6, 'rgba(120,40,180,0.3)');
  glow.addColorStop(1, 'rgba(120,40,180,0)');
  cctx.fillStyle = glow;
  cctx.beginPath(); cctx.arc(cx, cy, w * 0.72, 0, Math.PI * 2); cctx.fill();
  comicGroundShadow(cctx, cx, gy - 2, 56, 10);

  // wujud naga yang berevolusi: lebih besar, warna ungu-emas, mata giok bercahaya
  const evoSkin = { head: '#4a1560', body: '#6d219e', belly: '#ffd76b', eye: '#7fffd4', horn: true, hornStyle: 'twin', hornColor: '#ffd76b', spikeStyle: 'crown', pattern: 'stars', tailStyle: 'spiked' };
  const dw = 102, dh = 82;
  cctx.save();
  cctx.fillStyle = 'rgba(120,40,180,0.88)';
  cctx.strokeStyle = 'rgba(255,215,107,0.75)'; cctx.lineWidth = 1.8;
  cctx.beginPath();
  cctx.moveTo(cx - dw * 0.12, gy - dh * 0.95);
  cctx.quadraticCurveTo(cx - dw * 1.3, gy - dh * 1.7, cx - dw * 1.05, gy - dh * 0.25);
  cctx.quadraticCurveTo(cx - dw * 0.6, gy - dh * 0.55, cx - dw * 0.12, gy - dh * 0.62);
  cctx.closePath(); cctx.fill(); cctx.stroke();
  cctx.beginPath();
  cctx.moveTo(cx + dw * 0.62, gy - dh * 0.95);
  cctx.quadraticCurveTo(cx + dw * 1.8, gy - dh * 1.7, cx + dw * 1.55, gy - dh * 0.25);
  cctx.quadraticCurveTo(cx + dw * 1.1, gy - dh * 0.55, cx + dw * 0.62, gy - dh * 0.62);
  cctx.closePath(); cctx.fill(); cctx.stroke();
  cctx.restore();

  drawDinoShape(cctx, cx - dw / 2, gy - dh, dw, dh, evoSkin, false, 0, 1);

  comicSpeedLines(cctx, w, h, cx, cy - 10, 'rgba(200,120,255,0.65)');
  comicImpactText(cctx, w, h, 'EVOLUSI!!', cx, h * 0.16, 15, 0.05);
  comicFrame(cctx, w, h);
}
function sceneComingSoonChapter2(cctx, w, h) {
  cctx.clearRect(0, 0, w, h);
  cctx.fillStyle = '#0a0a0a';
  cctx.fillRect(0, 0, w, h);
  comicDots(cctx, w, h, '#fff', 0.05);
  cctx.save();
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillStyle = '#ffd76b';
  cctx.font = 'italic 900 15px "Courier New", monospace';
  cctx.fillText('CHAPTER 2', w / 2, h * 0.44);
  cctx.fillStyle = '#fff';
  cctx.font = 'bold 9px "Courier New", monospace';
  cctx.fillText('COMING SOON', w / 2, h * 0.6);
  cctx.restore();
  cctx.strokeStyle = '#0c0c0c'; cctx.lineWidth = 7;
  cctx.strokeRect(3.5, 3.5, w - 7, h - 7);
  cctx.strokeStyle = 'rgba(255,215,107,0.4)'; cctx.lineWidth = 1.4;
  cctx.strokeRect(7.5, 7.5, w - 15, h - 15);
}

function sceneComingSoonChapter3(cctx, w, h) {
  cctx.clearRect(0, 0, w, h);
  cctx.fillStyle = '#0a0a0a';
  cctx.fillRect(0, 0, w, h);
  comicDots(cctx, w, h, '#fff', 0.05);
  cctx.save();
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillStyle = '#c9a8ff';
  cctx.font = 'italic 900 15px "Courier New", monospace';
  cctx.fillText('CHAPTER 3', w / 2, h * 0.44);
  cctx.fillStyle = '#fff';
  cctx.font = 'bold 9px "Courier New", monospace';
  cctx.fillText('COMING SOON', w / 2, h * 0.6);
  cctx.restore();
  cctx.strokeStyle = '#0c0c0c'; cctx.lineWidth = 7;
  cctx.strokeRect(3.5, 3.5, w - 7, h - 7);
  cctx.strokeStyle = 'rgba(200,160,255,0.4)'; cctx.lineWidth = 1.4;
  cctx.strokeRect(7.5, 7.5, w - 15, h - 15);
}

function startQuest(forceNew) {
  mode = 'quest';
  inChapter2 = false;
  qAgeLabel.textContent = '🦖 UMUR';
  attackBtn.textContent = 'SERANG';
  const qp = data.questProgress;
  const canResume = !forceNew && qp && qp.mapIndex > 0 && qp.mapIndex < MAPS.length;
  qAge = canResume ? MAPS[qp.mapIndex].ageStart : 0;
  qMapIndex = canResume ? qp.mapIndex : 0;
  qLives = 3;
  qInvincible = 0;
  qSpeed = 5;
  qFrame = 0;
  qEntities = [];
  qEntityTimer = 0;
  qNextEntityGap = 80;
  // Saat melanjutkan, skill yang seharusnya sudah didapat di umur ini langsung
  // dipulihkan (tanpa notifikasi "skill baru") supaya progres terasa utuh.
  qUnlockedSkills = canResume ? SKILLS.filter(sk => qAge >= sk.age) : [];
  qBossActive = false;
  qBoss = null;
  qBossDefeatedForMap = {};
  qAttackCooldown = 0;
  qPopups = [];
  qGroundOffset = 0;
  qClouds = [];
  for (let i = 0; i < 4; i++) qClouds.push({ x: Math.random() * (canvas.width || 400), y: 20 + Math.random() * 100, w: 34 + Math.random() * 30 });
  qBloodParticles = [];
  qInitDecor();
  const sz = questDinoSize();
  dino.w = sz.w; dino.h = sz.h;
  resetDino();
  attackBtn.classList.remove('ready');

  if (canResume) {
    // Melanjutkan dari checkpoint tersimpan: langsung tampilkan pengenalan wilayah
    // yang sedang dijalani, tanpa mengulang cerita asal-usul dari awal.
    const map = MAPS[qMapIndex];
    queueComicPage(map.introTitle, [
      panel((c, w, h) => drawIconPanel(c, w, h, map.introIcon, 'default'), map.name)
    ], 'Perjalanan dilanjutkan...\n\n' + map.introText, () => {
      showScreen('playing');
      updateQuestHud();
    }, 'LANJUTKAN');
    showScreen('playing');
    playNextStory();
    return;
  }

  qClearCheckpoint();
  // Seluruh kisah asal-usul ditampilkan sebagai SATU halaman komik utuh (4 panel
  // sekaligus, seperti halaman komik cetak asli) — cukup satu tombol untuk mulai.
  queueComicPage('KISAH SANG INDUK', [
    panel(sceneParentProud, 'Induk yang perkasa, penjaga Hutan Purba.'),
    panel(sceneAmbush, 'Dikepung lima penguasa dunia di malam kelam.'),
    panel(sceneFallen, 'Pengorbanan terakhir: sebutir telur diselamatkan.'),
    panel(sceneHatch, 'Kehidupan baru, membawa dendam yang membara.')
  ], 'Jauh di jantung Hutan Purba, hidup seekor dino agung, sang penjaga yang disegani.\nSuatu malam kelam, lima penguasa dari seluruh penjuru dunia datang bersama, mengepungnya tanpa ampun.\nDi detik terakhir, sang induk menyembunyikan sebutir telur agar tetap selamat.\nWaktu berlalu... telur itu menetas. Seekor dino kecil terbangun sendirian, membawa dendam yang membara di dalam hatinya.',
  () => {
    showScreen('playing');
    updateQuestHud();
  }, 'MULAI PERJALANAN');
  showScreen('playing');
  playNextStory();
}

function qSpawnEntity() {
  const map = MAPS[qMapIndex];
  const isRock = Math.random() < 0.32;
  if (isRock) {
    qEntities.push({ type: 'rock', x: canvas.width + 30, w: 20, h: 30, y: GROUND_Y - 30 });
  } else {
    const hp = 1 + Math.floor(qAge / 30);
    qEntities.push({
      type: 'enemy', mapId: map.id, x: canvas.width + 30,
      w: 34, h: 28, y: GROUND_Y - 28, hp, maxHp: hp, hitFlash: 0, walkPhase: Math.random() * 10
    });
  }
}

function qTriggerBoss() {
  const map = MAPS[qMapIndex];
  qEntities = [];
  qBossActive = true;
  qBloodParticles = [];
  qBoss = {
    name: map.bossName, mapId: map.id,
    hp: 5 + qMapIndex * 2, maxHp: 5 + qMapIndex * 2,
    x: canvas.width + 80, y: GROUND_Y - 68, w: 78, h: 78,
    attackTimer: 0, warnUntil: 0, strikeUntil: 0, hitFlash: 0,
    arrived: false, bobPhase: 0, bloodRatio: 0
  };
  bossNameEl.textContent = map.bossName.toUpperCase();
  bossBarWrap.style.display = 'block';
  queueStory('⚔️', 'BOS MUNCUL!', `${map.bossName} menghadang jalan sang dino!\nKalahkan untuk melanjutkan perjalanan.`, () => {}, 'danger');
  playNextStory();
}

function qDefeatBoss() {
  const map = MAPS[qMapIndex];
  const defeatedIdx = qMapIndex;
  qBossActive = false;
  qBossDefeatedForMap[map.id] = true;
  bossBarWrap.style.display = 'none';
  qBoss = null;
  if (qMapIndex >= MAPS.length - 1) {
    qSaveCheckpoint(qMapIndex, true);
    // Halaman kemenangan: flashback perjalanan + bos terakhir tumbang
    queueComicPage('DENDAM TERBALASKAN', [
      panel(sceneVictoryFlashback(defeatedIdx), map.bossName + ' tumbang!'),
      panel(sceneStandOnFallenBoss(defeatedIdx), 'Dino berdiri di atas bos terakhir.')
    ], map.victoryText + '\n\nKelima penguasa yang merenggut induknya telah tumbang, satu demi satu.\nSang dino kini berdiri sebagai penjaga sejati, mewarisi kekuatan induknya.', () => {}, 'LANJUT');
    playNextStory();
    // Halaman kebangkitan naga (komik pembuka Chapter 2) — akan tampil otomatis
    // setelah halaman di atas ditutup, lewat rantai tombol LANJUT.
    playChapter2Intro();
  } else {
    // Gabung kemenangan + perkenalan wilayah baru jadi SATU halaman komik
    queueComicPage('SATU DARI LIMA TUMBANG', [
      panel(sceneVictoryFlashback(defeatedIdx), map.bossName + ' tumbang!'),
      panel((c, w, h) => drawIconPanel(c, w, h, MAPS[qMapIndex + 1].introIcon, 'default'), MAPS[qMapIndex + 1].name)
    ], map.victoryText + '\n\n' + MAPS[qMapIndex + 1].introText, () => {
      qMapIndex++;
      qBloodParticles = [];
      qInitDecor();
      updateQuestHud();
      qSaveCheckpoint(qMapIndex, false);
    }, 'LANJUTKAN');
    playNextStory();
  }
}

function qAttack() {
  if (state !== 'playing' || mode !== 'quest' || qPaused) return;
  if (inChapter2) { q2FireBreath(); return; }
  if (!qUnlockedSkills.length || qAttackCooldown > 0) return;
  qAttackCooldown = 22;
  qAttackFlash = 10;
  const dmg = currentSkillDamage();
  const range = 60;
  let hitSomething = false;
  if (qBossActive && qBoss) {
    const dist = qBoss.x - (dino.x + dino.w);
    if (dist < range + 30) {
      qBoss.hp -= dmg;
      qBoss.hitFlash = 8;
      hitSomething = true;
      spawnBossBlood(qBoss.x, qBoss.y - qBoss.h * 0.15, 10, false);
      qBoss.bloodRatio = Math.min(1, (qBoss.maxHp - Math.max(0, qBoss.hp)) / qBoss.maxHp);
      if (qBoss.hp <= 0) {
        spawnBossBlood(qBoss.x, qBoss.y - qBoss.h * 0.15, 34, true);
        qDefeatBoss();
      }
    }
  } else {
    for (const e of qEntities) {
      if (e.type !== 'enemy') continue;
      const dist = e.x - (dino.x + dino.w);
      if (dist >= -10 && dist < range) {
        e.hp -= dmg;
        e.hitFlash = 8;
        hitSomething = true;
        if (e.hp <= 0) {
          e.dead = true;
          qPopups.push({ x: e.x, y: e.y - 6, text: '+', color: '#7ed957', life: 30 });
        }
        break;
      }
    }
  }
  if (!hitSomething) qPopups.push({ x: dino.x + dino.w + 20, y: dino.y - 10, text: '×', color: '#999', life: 20 });
}
attackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); qAttack(); }, { passive: false });
attackBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); qAttack(); });

function questUpdate() {
  qFrame++;
  const size = questDinoSize();
  dino.w = size.w; dino.h = size.h;

  if (qPaused) { return; }

  if (dino.jumping) {
    dino.vy += GRAVITY;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - dino.h) { dino.y = GROUND_Y - dino.h; dino.jumping = false; dino.vy = 0; }
  } else {
    dino.y = GROUND_Y - dino.h;
  }

  if (qInvincible > 0) qInvincible--;
  if (qAttackCooldown > 0) qAttackCooldown--;
  if (qAttackFlash > 0) qAttackFlash--;

  const map = MAPS[qMapIndex];

  if (!qBossActive) {
    qAge += 0.018;
    if (qAge >= map.ageEnd - 0.5 && !qBossDefeatedForMap[map.id] && !qBossActive) {
      qAge = map.ageEnd - 0.5;
      qTriggerBoss();
    }
    SKILLS.forEach(sk => {
      if (qAge >= sk.age && !qUnlockedSkills.includes(sk)) {
        qUnlockedSkills.push(sk);
        attackBtn.classList.add('ready');
        showToast(`${sk.icon} Skill baru terbuka: ${sk.name}!`);
      }
    });

    qEntityTimer++;
    if (qEntityTimer > qNextEntityGap) {
      qSpawnEntity();
      qEntityTimer = 0;
      qNextEntityGap = 70 + Math.random() * 50 - Math.min(qSpeed * 2, 22);
    }
    qEntities.forEach(e => { e.x -= qSpeed; if (e.type === 'enemy') e.walkPhase++; });
    qEntities = qEntities.filter(e => !e.dead && e.x + e.w > -30);

    for (const e of qEntities) {
      if (qInvincible > 0) break;
      if (rectOverlap(dino.x, dino.y, dino.w, dino.h, e.x, e.y, e.w, e.h, 6)) {
        e.dead = true;
        qLoseLife();
        break;
      }
    }
    qSpeed = Math.min(5 + qAge / 25, 9);
  } else if (qBoss) {
    const targetX = dino.x + dino.w + 55;
    if (!qBoss.arrived) {
      qBoss.x -= Math.min(4.5, qBoss.x - targetX);
      if (qBoss.x <= targetX) { qBoss.x = targetX; qBoss.arrived = true; qBoss.attackTimer = 0; }
    } else {
      qBoss.attackTimer++;
      if (qBoss.attackTimer > 130 && qBoss.warnUntil === 0 && qBoss.strikeUntil === 0) {
        qBoss.warnUntil = qFrame + 40;
      }
      if (qBoss.warnUntil > 0 && qFrame >= qBoss.warnUntil) {
        qBoss.warnUntil = 0;
        qBoss.strikeUntil = qFrame + 16;
      }
      if (qBoss.strikeUntil > 0) {
        if (qFrame < qBoss.strikeUntil) {
          if (!dino.jumping && qInvincible <= 0) { qLoseLife(); qBoss.strikeUntil = 0; qBoss.attackTimer = 0; }
        } else {
          qBoss.strikeUntil = 0;
          qBoss.attackTimer = 0;
        }
      }
    }
    qBoss.bobPhase += 0.06;
    if (qBoss.hitFlash > 0) qBoss.hitFlash--;
    bossBarFill.style.width = Math.max(0, (qBoss.hp / qBoss.maxHp) * 100) + '%';
  }

  qGroundOffset += qSpeed;
  qClouds.forEach(c => { c.x -= qSpeed * 0.3; if (c.x < -60) { c.x = canvas.width + Math.random() * 100; c.y = 20 + Math.random() * (GROUND_Y * 0.3); } });
  qUpdateDecor();
  updateBossBlood();

  qPopups.forEach(p => { p.y -= 0.6; p.life--; });
  qPopups = qPopups.filter(p => p.life > 0);

  updateQuestHud();
}

function qLoseLife() {
  if (qInvincible > 0) return;
  qLives--;
  qInvincible = 90;
  flashRed();
  triggerShake();
  if (qLives <= 0) qEndGame();
}

function qEndGame() {
  document.getElementById('goStatsNormal').style.display = 'none';
  document.getElementById('goStatsQuest').style.display = '';
  document.getElementById('goTitle').textContent = 'PERJALANAN TERHENTI';
  document.getElementById('goAge').textContent = inChapter2 ? (q2MantraRun + ' mantra') : Math.floor(qAge);
  document.getElementById('goMap').textContent = inChapter2 ? 'Puncak Langit' : MAPS[qMapIndex].name;
  showScreen('gameover');
}

function updateQuestHud() {
  qAgeVal.textContent = Math.floor(qAge);
  qMapNameEl.textContent = MAPS[qMapIndex].name;
  qLivesEl.innerHTML = '❤'.repeat(Math.max(qLives, 0)) + '<span style="opacity:0.25">' + '❤'.repeat(Math.max(3 - qLives, 0)) + '</span>';
}

/* ===================== CHAPTER 2: NAGA TERBANG =====================
   Mode berbeda dari Chapter 1: dino (kini naga) terbang bebas naik-turun,
   menghindari rintangan badai, dan mengumpulkan mantra kuno di udara.
   Skin Naga Emas otomatis dipakai selama di Chapter 2. */
function playChapter2Intro() {
  data.chapter2IntroSeen = true;
  saveData();
  queueComicPage('BAB 2: KEBANGKITAN SANG NAGA', [
    panel(sceneDragonAwakening, 'Berdiri di atas raja terakhir, tubuhnya perlahan berubah...'),
    panel(sceneDragonFireBreath, 'Sayap dan tanduk raksasa tumbuh sempurna!'),
    panel(sceneDragonRoar, 'Sang naga mengaung ke angkasa!')
  ], 'Berdiri gagah di atas tubuh sang raja terakhir yang telah tumbang, tubuh sang dino tiba-tiba bergetar hebat.\nCahaya menyelimuti tubuhnya perlahan-lahan — tanduk besar mencuat, dan sepasang sayap raksasa merekah dari punggungnya.\n\nDalam sekejap, sang dino purba telah berubah wujud sepenuhnya menjadi seekor naga sejati, memiliki kekuatan menyemburkan api yang dahsyat. Ia mendongak dan mengaung keras ke angkasa, menandai awal babak baru.\n\n🎁 HADIAH TERBUKA: Skin Naga Emas!\n\nKini sang naga muda harus terbang tinggi ke langit, mencari mantra-mantra kuno yang tersembunyi untuk memperkuat evolusinya menjadi naga sejati seutuhnya...', () => {
    startChapter2();
  }, 'TERBANG!');
  // Kalau belum ada komik lain yang sedang tampil, tampilkan langsung.
  // Kalau sedang ada (dipanggil tepat setelah halaman kemenangan bos), biarkan
  // rantai tombol LANJUT yang menampilkannya secara otomatis.
  if (!storyOverlay.classList.contains('active')) playNextStory();
}
function startChapter2() {
  mode = 'quest';
  inChapter2 = true;
  qLives = 3;
  qInvincible = 0;
  q2MantraRun = 0;
  q2Timer = 0;
  q2NextGap = 90;
  q2Entities = [];
  q2Frame = 0;
  q2FireCooldown = 0;
  q2FireFlash = 0;
  q2Speed = 4.5;
  q2Clouds = [];
  q2Weather = 'calm';
  q2WeatherTimer = 0;
  q2Lightnings = [];
  const cw = canvas.width || 400, ch = canvas.height || 700;
  for (let i = 0; i < 5; i++) q2Clouds.push({ x: Math.random() * cw, y: 20 + Math.random() * (ch * 0.75), w: 40 + Math.random() * 40 });
  dino.w = 56; dino.h = 44;
  q2Y = ch * 0.45;
  q2Vy = 0;
  qAgeLabel.textContent = '📜 MANTRA';
  qMapNameEl.textContent = 'Puncak Langit';
  attackBtn.textContent = '🔥 API';
  q2UpdateHud();
  showScreen('playing');
}
function q2FireBreath() {
  if (q2FireCooldown > 0) return;
  q2FireCooldown = 26;
  q2FireFlash = 12;
  const range = 130;
  let hit = false;
  for (const e of q2Entities) {
    if (e.dead || e.type !== 'hazard') continue;
    const dist = e.x - (dino.x + dino.w);
    if (dist >= -20 && dist < range && Math.abs((e.y + e.h / 2) - (q2Y + dino.h / 2)) < 70) {
      e.dead = true;
      hit = true;
      qPopups.push({ x: e.x, y: e.y, text: '🔥', color: '#ff8a3c', life: 30 });
    }
  }
  // Counter petir: semburan api bisa membatalkan sambaran yang masih fase peringatan & dekat
  for (const l of q2Lightnings) {
    if (l.state === 'warn' && Math.abs(l.x - (dino.x + dino.w / 2)) < range) {
      l.state = 'fizzle';
      l.timer = 16;
      hit = true;
      qPopups.push({ x: l.x, y: q2Y, text: 'PETIR DIBATALKAN!', color: '#ff8a3c', life: 34 });
    }
  }
  if (!hit) qPopups.push({ x: dino.x + dino.w + 30, y: q2Y + dino.h / 2, text: '×', color: '#999', life: 20 });
}
function q2SpawnEntity() {
  const w = canvas.width || 400, h = canvas.height || 700;
  const y = 40 + Math.random() * Math.max(80, h - 160);
  if (Math.random() < 0.34) {
    q2Entities.push({ type: 'mantra', x: w + 30, y, w: 26, h: 26, spin: Math.random() * 10 });
    return;
  }
  if (q2Weather === 'storm' && Math.random() < 0.7) {
    // Badai: tornado besar yang menerjang naik-turun
    q2Entities.push({ type: 'hazard', kind: 'tornado', x: w + 40, y, w: 52, h: 88, baseY: y, phase: Math.random() * Math.PI * 2 });
  } else {
    q2Entities.push({ type: 'hazard', kind: 'cloud', x: w + 30, y, w: 40, h: 34 });
  }
}
function q2SpawnLightning() {
  const w = canvas.width || 400, ch = canvas.height || 700;
  const bandH = 120 + Math.random() * 50;
  const bandY = 20 + Math.random() * Math.max(40, ch - bandH - 60);
  q2Lightnings.push({ x: 50 + Math.random() * (w - 100), timer: 48, state: 'warn', bandY, bandH });
}
function q2Update() {
  qFrame++;
  q2Frame++;
  if (qPaused) return;
  if (qInvincible > 0) qInvincible--;
  if (q2FireCooldown > 0) q2FireCooldown--;
  if (q2FireFlash > 0) q2FireFlash--;

  const THRUST = -0.55, GRAV2 = 0.32;
  q2Vy += q2Thrust ? THRUST : GRAV2;
  q2Vy = Math.max(-7, Math.min(6, q2Vy));
  q2Y += q2Vy;
  const ch = canvas.height || 700;
  const topBound = 20, botBound = ch - dino.h - 40;
  if (q2Y < topBound) { q2Y = topBound; q2Vy = 0; }
  if (q2Y > botBound) { q2Y = botBound; q2Vy = 0; }
  dino.y = q2Y;
  dino.jumping = true;

  // Siklus cuaca: berganti tiap ~8 detik antara cerah, badai tornado, badai petir
  q2WeatherTimer++;
  if (q2WeatherTimer > 480) {
    q2WeatherTimer = 0;
    const opts = ['calm', 'storm', 'thunder'].filter(w2 => w2 !== q2Weather);
    q2Weather = opts[Math.floor(Math.random() * opts.length)];
    const msg = q2Weather === 'storm' ? '🌪️ BADAI TORNADO MENERJANG!' : q2Weather === 'thunder' ? '⚡ PETIR MENYAMBAR!' : '☀️ LANGIT CERAH';
    qPopups.push({ x: dino.x + 70, y: q2Y - 24, text: msg, color: q2Weather === 'thunder' ? '#ffe36b' : '#fff', life: 60 });
  }
  if (q2Weather === 'thunder' && q2Lightnings.length < 3 && Math.random() < 0.035) {
    q2SpawnLightning();
  }

  q2Timer++;
  if (q2Timer > q2NextGap) {
    q2SpawnEntity();
    q2Timer = 0;
    q2NextGap = 55 + Math.random() * 40;
  }
  q2Entities.forEach(e => {
    e.x -= q2Speed;
    if (e.kind === 'tornado') {
      e.phase += 0.09;
      e.y = e.baseY + Math.sin(e.phase) * 60;
    }
  });
  q2Entities = q2Entities.filter(e => !e.dead && e.x + (e.w || 30) > -40);

  for (const e of q2Entities) {
    if (e.dead) continue;
    if (e.type === 'mantra') {
      if (rectOverlap(dino.x, q2Y, dino.w, dino.h, e.x, e.y, e.w, e.h, 8)) {
        e.dead = true;
        q2MantraRun++;
        data.mantraCount++;
        saveData();
        qPopups.push({ x: e.x, y: e.y - 6, text: '+1 MANTRA', color: '#c9a8ff', life: 34 });
        if (q2MantraRun >= Q2_TARGET) { q2CompleteStage(); return; }
      }
    } else if (e.type === 'hazard') {
      if (qInvincible <= 0 && rectOverlap(dino.x, q2Y, dino.w, dino.h, e.x, e.y, e.w, e.h, 8)) {
        e.dead = true;
        qLoseLife();
      }
    }
  }

  // Petir: telegraph (garis peringatan pada sebagian ketinggian) lalu menyambar.
  // Naga bisa menghindar dengan terbang keluar dari band ketinggiannya,
  // atau membatalkannya dengan semburan api saat masih fase peringatan.
  q2Lightnings.forEach(l => {
    l.timer--;
    if (l.state === 'warn' && l.timer <= 0) { l.state = 'strike'; l.timer = 10; }
  });
  for (const l of q2Lightnings) {
    if (l.state === 'strike' && l.timer === 10 && qInvincible <= 0) {
      const dinoInBand = q2Y + dino.h > l.bandY && q2Y < l.bandY + l.bandH;
      if (dinoInBand && dino.x + dino.w > l.x - 22 && dino.x < l.x + 22) {
        qLoseLife();
      }
    }
  }
  q2Lightnings = q2Lightnings.filter(l => !((l.state === 'strike' || l.state === 'fizzle') && l.timer <= 0));

  const cw = canvas.width || 400;
  q2Clouds.forEach(c => { c.x -= q2Speed * 0.4; if (c.x < -80) { c.x = cw + Math.random() * 100; c.y = 20 + Math.random() * (ch * 0.75); } });

  qPopups.forEach(p => { p.y -= 0.6; p.life--; });
  qPopups = qPopups.filter(p => p.life > 0);

  q2UpdateHud();
}
function q2UpdateHud() {
  qAgeVal.textContent = q2MantraRun + '/' + Q2_TARGET;
  qLivesEl.innerHTML = '❤'.repeat(Math.max(qLives, 0)) + '<span style="opacity:0.25">' + '❤'.repeat(Math.max(3 - qLives, 0)) + '</span>';
}
function q2CompleteStage() {
  const bonusCoins = 150;
  data.coins += bonusCoins;
  data.chapter2StageDone = true;
  saveData();
  queueComicPage('EVOLUSI NAGA MENINGKAT', [
    panel(sceneDragonEvolved, 'Wujud sang naga berevolusi — lebih besar, warnanya berubah berkilau keunguan!')
  ], `Sang naga muda telah mengumpulkan ${Q2_TARGET} mantra kuno dari langit Puncak Langit!\nKekuatan mantra-mantra itu beresonansi dengan tubuhnya — ukurannya membesar, sisiknya berubah warna berkilau ungu-keemasan, dan tanduknya kini melengkung lebih tajam.\n\n🎁 +${bonusCoins} Koin!`, () => {}, 'LANJUT');
  playNextStory();
  queueComicPage('BERSAMBUNG...', [
    panel(sceneComingSoonChapter3, null)
  ], 'Wilayah langit selanjutnya masih diselimuti kabut misteri...\nNantikan kelanjutan kisah sang naga di Chapter 3!', () => {
    showScreen('menu');
  }, 'KEMBALI');
}
function q2DrawBackground() {
  const cw = canvas.width, ch = canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  if (q2Weather === 'storm') {
    g.addColorStop(0, '#2b2f3d'); g.addColorStop(0.55, '#4a4f63'); g.addColorStop(1, '#8b8fa3');
  } else if (q2Weather === 'thunder') {
    g.addColorStop(0, '#15172a'); g.addColorStop(0.55, '#2c2a49'); g.addColorStop(1, '#4a4568');
  } else {
    g.addColorStop(0, '#2a3d6b'); g.addColorStop(0.55, '#5a6fa8'); g.addColorStop(1, '#a7b8dd');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(40,50,90,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, ch);
  for (let x = 0; x <= cw; x += 40) {
    ctx.lineTo(x, ch - 40 - Math.sin(x * 0.01) * 20);
  }
  ctx.lineTo(cw, ch);
  ctx.closePath();
  ctx.fill();
}
function q2DrawClouds() {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  q2Clouds.forEach(c => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w * 0.5, c.w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
function q2DrawMantra(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + Math.sin((q2Frame + e.spin) * 0.08) * 4);
  ctx.font = 'bold 22px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(200,150,255,0.85)'; ctx.shadowBlur = 12;
  ctx.fillText('📜', 0, 0);
  ctx.restore();
}
function q2DrawHazard(e) {
  if (e.kind === 'tornado') { q2DrawTornado(e); return; }
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  ctx.font = '26px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🌩️', 0, 0);
  ctx.restore();
}
function q2DrawTornado(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  ctx.rotate(Math.sin(e.phase * 2) * 0.06);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const rw = e.w * (0.5 + t * 0.55);
    const ry = -e.h / 2 + t * e.h;
    ctx.beginPath();
    ctx.ellipse(0, ry, rw / 2, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150,160,180,${0.3 + t * 0.2})`;
    ctx.fill();
  }
  ctx.font = '22px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🌪️', 0, 4);
  ctx.restore();
}
function q2DrawLightnings() {
  q2Lightnings.forEach(l => {
    if (l.state === 'warn') {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(q2Frame * 0.5);
      ctx.strokeStyle = '#ffe36b';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(l.x, l.bandY);
      ctx.lineTo(l.x, l.bandY + l.bandH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️', l.x, Math.max(16, l.bandY - 6));
      ctx.restore();
    } else if (l.state === 'strike') {
      ctx.save();
      ctx.globalAlpha = Math.max(0, l.timer / 10);
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = '#bfe0ff';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 5;
      ctx.beginPath();
      let lx = l.x;
      ctx.moveTo(lx, l.bandY);
      for (let y = l.bandY + 18; y < l.bandY + l.bandH; y += 18) {
        lx += (Math.random() - 0.5) * 18;
        ctx.lineTo(lx, y);
      }
      ctx.lineTo(l.x, l.bandY + l.bandH);
      ctx.stroke();
      ctx.restore();
    } else if (l.state === 'fizzle') {
      ctx.save();
      ctx.globalAlpha = Math.max(0, l.timer / 16);
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨', l.x, l.bandY + l.bandH / 2);
      ctx.restore();
    }
  });
}
function q2DrawFireFlash() {
  if (q2FireFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = q2FireFlash / 12;
  const fx = dino.x + dino.w, fy = q2Y + dino.h / 2;
  const fg = ctx.createLinearGradient(fx, fy, fx + 140, fy);
  fg.addColorStop(0, 'rgba(255,255,225,0.95)');
  fg.addColorStop(0.4, 'rgba(255,150,40,0.85)');
  fg.addColorStop(1, 'rgba(230,70,20,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 14);
  ctx.quadraticCurveTo(fx + 80, fy - 30, fx + 140, fy);
  ctx.quadraticCurveTo(fx + 80, fy + 22, fx, fy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function q2Draw() {
  q2DrawBackground();
  q2DrawClouds();
  q2DrawLightnings();
  q2Entities.forEach(e => e.type === 'mantra' ? q2DrawMantra(e) : q2DrawHazard(e));
  let alpha = 1;
  if (qInvincible > 0 && Math.floor(qFrame / 5) % 2 === 0) alpha = 0.35;
  const dragonSkin = getSkin(6);
  drawDinoShape(ctx, dino.x, q2Y, dino.w, dino.h, dragonSkin, true, qFrame, alpha);
  q2DrawFireFlash();
  qDrawPopups();
}

/* ---- quest drawing ---- */
function qSkyColors() { return MAPS[qMapIndex].sky; }
function qDrawBackground() {
  const [top, bottom] = qSkyColors();
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = canvas.width * 0.84, sy = canvas.height * 0.15, sr = 30;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.2);
  sg.addColorStop(0, 'rgba(255,235,180,0.7)'); sg.addColorStop(1, 'rgba(255,235,180,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); ctx.fill();
}
function qDrawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  qClouds.forEach(c => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.28, c.y - 6, c.w * 0.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---- Dekorasi map: bukit jauh (parallax) + pemandangan khas tiap wilayah ---- */
let qHills = [];
function qInitHills() {
  qHills = [];
  let x = -20;
  while (x < (canvas.width || 400) + 60) {
    qHills.push({ x, w: 90 + Math.random() * 70, h: 30 + Math.random() * 34 });
    x += 70 + Math.random() * 50;
  }
}
function qDrawFarHills() {
  const map = MAPS[qMapIndex];
  const base = GROUND_Y - 4;
  ctx.fillStyle = shadeColor(map.ground, -18);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(0, base);
  const totalW = qHills.reduce((a, hh) => a + hh.w, 0) + qHills.length * 60 || 1;
  qHills.forEach(hh => {
    let hx = (hh.x - qHillOffset) % totalW;
    if (hx < -hh.w) hx += totalW;
    ctx.moveTo(hx, base);
    ctx.quadraticCurveTo(hx + hh.w / 2, base - hh.h, hx + hh.w, base);
  });
  ctx.lineTo(canvas.width, base + 60);
  ctx.lineTo(0, base + 60);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // aksen khusus wilayah di deretan bukit jauh
  if (map.id === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    qHills.forEach(hh => {
      let hx = (hh.x - qHillOffset) % totalW; if (hx < -hh.w) hx += totalW;
      ctx.beginPath(); ctx.moveTo(hx + hh.w * 0.5 - 8, base - hh.h + 6); ctx.lineTo(hx + hh.w * 0.5, base - hh.h - 6); ctx.lineTo(hx + hh.w * 0.5 + 8, base - hh.h + 6); ctx.closePath(); ctx.fill();
    });
  } else if (map.id === 'city') {
    ctx.fillStyle = 'rgba(30,30,34,0.4)';
    qHills.forEach((hh, i) => {
      if (i % 2 !== 0) return;
      let hx = (hh.x - qHillOffset) % totalW; if (hx < -hh.w) hx += totalW;
      ctx.fillRect(hx + hh.w * 0.3, base - hh.h - 14, 10, hh.h + 14);
    });
  }
}

let qDecor = [];
let qHillOffset = 0;
function qInitDecor() {
  qDecor = [];
  let x = 30;
  for (let i = 0; i < 7; i++) {
    x += 55 + Math.random() * 85;
    qDecor.push({ x, seed: Math.random(), variant: Math.floor(Math.random() * 3) });
  }
  qInitHills();
}
function qUpdateDecor() {
  qHillOffset += qSpeed * 0.25;
  qDecor.forEach(d => { d.x -= qSpeed * 0.55; });
  qDecor = qDecor.filter(d => d.x > -70);
  while (qDecor.length < 7) {
    const last = qDecor[qDecor.length - 1];
    const x = (last ? last.x : canvas.width) + 55 + Math.random() * 85;
    qDecor.push({ x, seed: Math.random(), variant: Math.floor(Math.random() * 3) });
  }
}
function qDrawDecor() {
  const map = MAPS[qMapIndex];
  const base = GROUND_Y - 3;
  qDecor.forEach(d => drawMapDecorItem(ctx, map.id, d.x, base, d.seed, d.variant));
}
function drawMapDecorItem(dctx, mapId, x, gy, seed, variant) {
  dctx.save();
  dctx.translate(x, gy);
  const scale = 0.75 + seed * 0.55;
  dctx.scale(scale, scale);
  if (mapId === 'forest') {
    if (variant !== 2) {
      // pohon pinus
      dctx.fillStyle = '#5a3a20'; dctx.fillRect(-3, -14, 6, 14);
      dctx.fillStyle = '#2e6b32';
      [0, 1, 2].forEach(i => {
        dctx.beginPath();
        dctx.moveTo(-16 + i * 3, -14 - i * 10);
        dctx.lineTo(16 - i * 3, -14 - i * 10);
        dctx.lineTo(0, -34 - i * 10);
        dctx.closePath(); dctx.fill();
      });
    } else {
      dctx.fillStyle = '#3a7d3a';
      dctx.beginPath(); dctx.ellipse(0, -8, 14, 10, 0, 0, Math.PI * 2); dctx.fill();
      dctx.beginPath(); dctx.ellipse(-10, -4, 9, 7, 0, 0, Math.PI * 2); dctx.fill();
    }
  } else if (mapId === 'desert') {
    if (variant !== 2) {
      // kaktus
      dctx.fillStyle = '#4c8a4c';
      roundRectPath(dctx, -4, -34, 8, 34, 3); dctx.fill();
      roundRectPath(dctx, -14, -22, 7, 16, 3); dctx.fill();
      roundRectPath(dctx, 7, -28, 7, 20, 3); dctx.fill();
    } else {
      dctx.fillStyle = '#a8875a';
      dctx.beginPath(); dctx.moveTo(-16, 0); dctx.lineTo(-4, -26); dctx.lineTo(8, -12); dctx.lineTo(16, 0); dctx.closePath(); dctx.fill();
    }
  } else if (mapId === 'snow') {
    if (variant !== 2) {
      dctx.fillStyle = '#3a6b4a'; dctx.fillRect(-2, -10, 4, 10);
      dctx.fillStyle = '#dbeaf2';
      [0, 1, 2].forEach(i => {
        dctx.beginPath();
        dctx.moveTo(-14 + i * 2.5, -10 - i * 9);
        dctx.lineTo(14 - i * 2.5, -10 - i * 9);
        dctx.lineTo(0, -26 - i * 9);
        dctx.closePath(); dctx.fill();
      });
      dctx.fillStyle = '#3a6b4a';
      [0, 1].forEach(i => {
        dctx.beginPath();
        dctx.moveTo(-12 + i * 3, -14 - i * 9);
        dctx.lineTo(12 - i * 3, -14 - i * 9);
        dctx.lineTo(0, -22 - i * 9);
        dctx.closePath(); dctx.fill();
      });
    } else {
      dctx.strokeStyle = '#cfe6f2'; dctx.lineWidth = 2;
      dctx.beginPath(); dctx.moveTo(0, 0); dctx.lineTo(0, -22); dctx.moveTo(-9, -11); dctx.lineTo(9, -11); dctx.moveTo(-6, -18); dctx.lineTo(6, -4); dctx.moveTo(6, -18); dctx.lineTo(-6, -4); dctx.stroke();
    }
  } else if (mapId === 'city') {
    if (variant !== 2) {
      dctx.fillStyle = '#5a5d62';
      const bh = 30 + seed * 26;
      dctx.fillRect(-11, -bh, 22, bh);
      dctx.fillStyle = '#3a3d42';
      dctx.beginPath(); dctx.moveTo(-11, -bh); dctx.lineTo(-2, -bh - 10); dctx.lineTo(6, -bh); dctx.closePath(); dctx.fill();
      dctx.fillStyle = 'rgba(255,220,140,0.55)';
      for (let r = 0; r < Math.floor(bh / 9); r++) {
        for (let cix = 0; cix < 2; cix++) {
          if ((r + cix) % 2 === 0) dctx.fillRect(-7 + cix * 9, -bh + 5 + r * 9, 4, 4);
        }
      }
    } else {
      dctx.fillStyle = '#4a4d52';
      dctx.beginPath(); dctx.moveTo(-14, 0); dctx.lineTo(-6, -14); dctx.lineTo(4, -6); dctx.lineTo(14, -10); dctx.lineTo(14, 0); dctx.closePath(); dctx.fill();
    }
  } else {
    if (variant !== 2) {
      // gubuk kayu
      dctx.fillStyle = '#8a6a42'; dctx.fillRect(-13, -20, 26, 20);
      dctx.fillStyle = '#5a3a1e';
      dctx.beginPath(); dctx.moveTo(-16, -20); dctx.lineTo(0, -34); dctx.lineTo(16, -20); dctx.closePath(); dctx.fill();
      dctx.fillStyle = '#3a2a18'; dctx.fillRect(-4, -12, 8, 12);
    } else {
      dctx.strokeStyle = '#6a4a28'; dctx.lineWidth = 3;
      dctx.beginPath(); dctx.moveTo(-10, 0); dctx.lineTo(-10, -18); dctx.moveTo(10, 0); dctx.lineTo(10, -18); dctx.moveTo(-12, -12); dctx.lineTo(12, -12); dctx.stroke();
    }
  }
  dctx.restore();
}
function qDrawGround() {
  const map = MAPS[qMapIndex];
  const dg = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height);
  dg.addColorStop(0, map.dirt); dg.addColorStop(1, map.groundDark);
  ctx.fillStyle = dg;
  ctx.fillRect(0, GROUND_Y + 6, canvas.width, canvas.height - GROUND_Y - 6);
  ctx.fillStyle = map.ground;
  ctx.fillRect(0, GROUND_Y - 2, canvas.width, 8);
  const count = Math.ceil(canvas.width / 22) + 2;
  for (let i = 0; i < count; i++) {
    const x = (i * 22 - qGroundOffset % 22);
    ctx.fillStyle = map.groundDark;
    ctx.fillRect(x, GROUND_Y - 6, 3, 6);
    ctx.fillRect(x + 5, GROUND_Y - 8, 3, 8);
  }
}
function qDrawRock(e) {
  ctx.fillStyle = '#8a8580';
  roundRectPath(ctx, e.x, e.y, e.w, e.h, 5); ctx.fill();
  ctx.fillStyle = '#6b6862';
  ctx.fillRect(e.x + 4, e.y + e.h - 8, e.w - 8, 4);
}
/* Bentuk musuh/bos digambar per-map agar jelas siluetnya & detail, bisa dipakai
   ulang baik saat gameplay maupun di panel komik cerita. Tiap makhluk punya
   shading (gradasi), mata dengan sorot, dan bagian tubuh yang jelas terbaca. */
function shadeColor(hex, amt) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map(c => c + c).join('') : n, 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
function bodyGradient(dctx, cx, cy, r, color, hitFlash) {
  if (hitFlash) return '#ffffff';
  const g = dctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.3);
  g.addColorStop(0, shadeColor(color, 42));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shadeColor(color, -35));
  return g;
}
function drawEye(dctx, x, y, r, glow) {
  if (glow) {
    const gg = dctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    gg.addColorStop(0, 'rgba(255,60,40,0.85)');
    gg.addColorStop(1, 'rgba(255,60,40,0)');
    dctx.fillStyle = gg;
    dctx.beginPath(); dctx.arc(x, y, r * 3.2, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#2a0303';
    dctx.beginPath(); dctx.arc(x, y, r * 1.15, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#ff2d2d';
    dctx.beginPath(); dctx.arc(x, y, r, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#ffd76b';
    dctx.beginPath(); dctx.arc(x, y, r * 0.4, 0, Math.PI * 2); dctx.fill();
  } else {
    dctx.fillStyle = '#1a1a1a';
    dctx.beginPath(); dctx.arc(x, y, r * 1.1, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#fff';
    dctx.beginPath(); dctx.arc(x, y, r, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#1a1a1a';
    dctx.beginPath(); dctx.arc(x + r * 0.15, y, r * 0.45, 0, Math.PI * 2); dctx.fill();
  }
}
function drawCreatureByMapId(dctx, mapId, cx, cy, w, h, color, hitFlash, isBoss) {
  dctx.save();
  dctx.translate(cx, cy);
  const fill = bodyGradient(dctx, 0, 0, Math.max(w, h) * 0.5, color, hitFlash);
  const dark = hitFlash ? '#fff' : shadeColor(color, -55);
  const outline = hitFlash ? '#fff' : '#161311';
  dctx.lineJoin = 'round';

  if (mapId === 'forest') {
    // === SERIGALA: badan condong maju, kaki jelas, moncong terbuka bertaring ===
    const s = isBoss ? 1.12 : 1;
    // ekor berbulu
    dctx.fillStyle = fill; dctx.strokeStyle = outline; dctx.lineWidth = 1.6;
    dctx.beginPath();
    dctx.moveTo(-w * 0.42 * s, h * 0.02);
    dctx.quadraticCurveTo(-w * 0.66 * s, -h * 0.14, -w * 0.58 * s, -h * 0.34);
    dctx.quadraticCurveTo(-w * 0.48 * s, -h * 0.18, -w * 0.32 * s, h * 0.06);
    dctx.closePath(); dctx.fill(); dctx.stroke();
    // 4 kaki
    dctx.fillStyle = dark;
    [[-w * 0.24, h * 0.3], [-w * 0.02, h * 0.32], [w * 0.14, h * 0.3], [w * 0.3, h * 0.28]].forEach(p => {
      dctx.fillRect(p[0] * s - 3, p[1] * s - 12, 6, 16);
    });
    // badan utama
    dctx.fillStyle = fill;
    dctx.beginPath(); dctx.ellipse(0, 2, w * 0.46 * s, h * 0.3 * s, -0.05, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    // punuk/leher
    dctx.beginPath(); dctx.ellipse(w * 0.12 * s, -h * 0.12 * s, w * 0.24 * s, h * 0.22 * s, 0, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    // moncong dengan mulut terbuka
    dctx.beginPath();
    dctx.moveTo(w * 0.3 * s, -h * 0.14 * s);
    dctx.lineTo(w * 0.62 * s, -h * 0.04 * s);
    dctx.lineTo(w * 0.5 * s, h * 0.1 * s);
    dctx.lineTo(w * 0.28 * s, h * 0.08 * s);
    dctx.closePath(); dctx.fill(); dctx.stroke();
    dctx.fillStyle = '#8a1414';
    dctx.beginPath(); dctx.moveTo(w * 0.36 * s, -h * 0.01 * s); dctx.lineTo(w * 0.58 * s, h * 0.0 * s); dctx.lineTo(w * 0.4 * s, h * 0.08 * s); dctx.closePath(); dctx.fill();
    dctx.fillStyle = '#fff';
    dctx.beginPath(); dctx.moveTo(w * 0.37 * s, -h * 0.005 * s); dctx.lineTo(w * 0.44 * s, -h * 0.005 * s); dctx.lineTo(w * 0.4 * s, h * 0.05 * s); dctx.closePath(); dctx.fill();
    dctx.beginPath(); dctx.moveTo(w * 0.5 * s, h * 0.0 * s); dctx.lineTo(w * 0.56 * s, h * 0.0 * s); dctx.lineTo(w * 0.52 * s, h * 0.05 * s); dctx.closePath(); dctx.fill();
    // telinga runcing
    dctx.fillStyle = fill;
    dctx.beginPath(); dctx.moveTo(-w * 0.06 * s, -h * 0.3 * s); dctx.lineTo(w * 0.02 * s, -h * 0.58 * s); dctx.lineTo(w * 0.14 * s, -h * 0.28 * s); dctx.closePath(); dctx.fill(); dctx.stroke();
    dctx.beginPath(); dctx.moveTo(w * 0.1 * s, -h * 0.32 * s); dctx.lineTo(w * 0.2 * s, -h * 0.6 * s); dctx.lineTo(w * 0.28 * s, -h * 0.3 * s); dctx.closePath(); dctx.fill(); dctx.stroke();
    // mata
    drawEye(dctx, w * 0.32 * s, -h * 0.16 * s, isBoss ? 2.6 : 2, isBoss && !hitFlash);
    if (isBoss) {
      dctx.strokeStyle = dark; dctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { dctx.beginPath(); dctx.moveTo(-w * 0.1 + i * 8, -h * 0.24); dctx.lineTo(-w * 0.02 + i * 8, -h * 0.1); dctx.stroke(); }
    }
  } else if (mapId === 'desert') {
    // === KALAJENGKING: segmen badan, dua capit besar, ekor melengkung + sengat ===
    const s = isBoss ? 1.1 : 1;
    dctx.fillStyle = fill; dctx.strokeStyle = outline; dctx.lineWidth = 1.6;
    // kaki-kaki kecil
    dctx.strokeStyle = dark; dctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      const bx = -w * 0.2 * s + i * w * 0.18 * s;
      dctx.beginPath(); dctx.moveTo(bx, h * 0.12 * s); dctx.lineTo(bx - 8, h * 0.3 * s); dctx.stroke();
      dctx.beginPath(); dctx.moveTo(bx, h * 0.1 * s); dctx.lineTo(bx + 8, h * 0.28 * s); dctx.stroke();
    }
    dctx.strokeStyle = outline; dctx.lineWidth = 1.6;
    // ekor melengkung dgn segmen + sengat
    dctx.fillStyle = fill;
    dctx.beginPath();
    dctx.moveTo(-w * 0.28 * s, h * 0.02 * s);
    dctx.quadraticCurveTo(-w * 0.58 * s, -h * 0.22 * s, -w * 0.4 * s, -h * 0.5 * s);
    dctx.quadraticCurveTo(-w * 0.3 * s, -h * 0.62 * s, -w * 0.14 * s, -h * 0.52 * s);
    dctx.lineTo(-w * 0.2 * s, -h * 0.42 * s);
    dctx.quadraticCurveTo(-w * 0.3 * s, -h * 0.5 * s, -w * 0.36 * s, -h * 0.42 * s);
    dctx.quadraticCurveTo(-w * 0.46 * s, -h * 0.2 * s, -w * 0.22 * s, -h * 0.0 * s);
    dctx.closePath(); dctx.fill(); dctx.stroke();
    dctx.fillStyle = '#1a1a1a';
    dctx.beginPath(); dctx.moveTo(-w * 0.16 * s, -h * 0.54 * s); dctx.lineTo(-w * 0.06 * s, -h * 0.62 * s); dctx.lineTo(-w * 0.1 * s, -h * 0.44 * s); dctx.closePath(); dctx.fill();
    // badan bersegmen
    dctx.fillStyle = fill;
    [0, 1, 2].forEach(i => {
      dctx.beginPath();
      dctx.ellipse(-w * 0.05 * s + i * w * 0.16 * s, 2 - i * 1.2, w * 0.16 * s, h * 0.22 * s, 0, 0, Math.PI * 2);
      dctx.fill(); dctx.stroke();
    });
    // dua capit besar
    dctx.fillStyle = fill;
    dctx.beginPath();
    dctx.moveTo(w * 0.34 * s, -h * 0.12 * s);
    dctx.quadraticCurveTo(w * 0.62 * s, -h * 0.32 * s, w * 0.58 * s, -h * 0.06 * s);
    dctx.quadraticCurveTo(w * 0.5 * s, -h * 0.02 * s, w * 0.5 * s, h * 0.06 * s);
    dctx.quadraticCurveTo(w * 0.4 * s, h * 0.02 * s, w * 0.34 * s, -h * 0.02 * s);
    dctx.closePath(); dctx.fill(); dctx.stroke();
    dctx.beginPath();
    dctx.moveTo(w * 0.34 * s, h * 0.14 * s);
    dctx.quadraticCurveTo(w * 0.6 * s, h * 0.1 * s, w * 0.56 * s, h * 0.32 * s);
    dctx.quadraticCurveTo(w * 0.46 * s, h * 0.3 * s, w * 0.44 * s, h * 0.22 * s);
    dctx.quadraticCurveTo(w * 0.38 * s, h * 0.2 * s, w * 0.34 * s, h * 0.14 * s);
    dctx.closePath(); dctx.fill(); dctx.stroke();
    // mata kecil di depan
    drawEye(dctx, w * 0.32 * s, -h * 0.18 * s, isBoss ? 2.4 : 1.8, isBoss && !hitFlash);
  } else if (mapId === 'snow') {
    // === BERUANG ES: badan besar berbulu, moncong hitam, cakar tajam ===
    const s = isBoss ? 1.12 : 1;
    dctx.fillStyle = fill; dctx.strokeStyle = outline; dctx.lineWidth = 1.6;
    // kaki belakang
    dctx.fillStyle = dark;
    dctx.beginPath(); dctx.ellipse(-w * 0.22 * s, h * 0.34 * s, w * 0.14 * s, h * 0.12 * s, 0, 0, Math.PI * 2); dctx.fill();
    dctx.beginPath(); dctx.ellipse(w * 0.02 * s, h * 0.36 * s, w * 0.15 * s, h * 0.12 * s, 0, 0, Math.PI * 2); dctx.fill();
    // badan bulat besar
    dctx.fillStyle = fill;
    dctx.beginPath(); dctx.ellipse(0, 4, w * 0.5 * s, h * 0.4 * s, 0, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    // kaki depan dengan cakar
    dctx.fillStyle = fill;
    dctx.beginPath(); dctx.ellipse(w * 0.2 * s, h * 0.28 * s, w * 0.16 * s, h * 0.16 * s, 0, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    dctx.strokeStyle = '#2b2b2b'; dctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) { dctx.beginPath(); dctx.moveTo(w * 0.16 * s + i * 5, h * 0.36 * s); dctx.lineTo(w * 0.14 * s + i * 5, h * 0.44 * s); dctx.stroke(); }
    dctx.strokeStyle = outline;
    // kepala
    dctx.fillStyle = fill;
    dctx.beginPath(); dctx.arc(w * 0.3 * s, -h * 0.2 * s, h * 0.24 * s, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    // telinga
    dctx.beginPath(); dctx.arc(w * 0.16 * s, -h * 0.4 * s, h * 0.09 * s, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    dctx.beginPath(); dctx.arc(w * 0.42 * s, -h * 0.4 * s, h * 0.09 * s, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    // moncong
    dctx.fillStyle = '#f5f8fb';
    dctx.beginPath(); dctx.ellipse(w * 0.44 * s, -h * 0.1 * s, w * 0.12 * s, h * 0.12 * s, 0, 0, Math.PI * 2); dctx.fill();
    dctx.fillStyle = '#2b2b2b';
    dctx.beginPath(); dctx.arc(w * 0.5 * s, -h * 0.12 * s, 2.4, 0, Math.PI * 2); dctx.fill();
    // taring
    dctx.fillStyle = '#fff';
    dctx.beginPath(); dctx.moveTo(w * 0.4 * s, -h * 0.02 * s); dctx.lineTo(w * 0.43 * s, h * 0.04 * s); dctx.lineTo(w * 0.37 * s, -h * 0.01 * s); dctx.closePath(); dctx.fill();
    drawEye(dctx, w * 0.36 * s, -h * 0.22 * s, isBoss ? 2.6 : 2, isBoss && !hitFlash);
  } else if (mapId === 'city') {
    // === ROBOT PENJAGA: badan kotak berpanel, kepala terpisah, lengan mekanik ===
    const s = isBoss ? 1.12 : 1;
    dctx.strokeStyle = outline; dctx.lineWidth = 1.8;
    // kaki mekanik
    dctx.fillStyle = dark;
    dctx.fillRect(-w * 0.2 * s, h * 0.14 * s, w * 0.12 * s, h * 0.26 * s);
    dctx.fillRect(w * 0.08 * s, h * 0.14 * s, w * 0.12 * s, h * 0.26 * s);
    dctx.strokeRect(-w * 0.2 * s, h * 0.14 * s, w * 0.12 * s, h * 0.26 * s);
    dctx.strokeRect(w * 0.08 * s, h * 0.14 * s, w * 0.12 * s, h * 0.26 * s);
    // lengan
    dctx.fillStyle = fill;
    roundRectPath(dctx, -w * 0.46 * s, -h * 0.08 * s, w * 0.16 * s, h * 0.4 * s, 3); dctx.fill(); dctx.stroke();
    roundRectPath(dctx, w * 0.32 * s, -h * 0.08 * s, w * 0.16 * s, h * 0.4 * s, 3); dctx.fill(); dctx.stroke();
    // badan kotak berpanel
    dctx.fillStyle = fill;
    roundRectPath(dctx, -w * 0.32 * s, -h * 0.34 * s, w * 0.64 * s, h * 0.56 * s, 5); dctx.fill(); dctx.stroke();
    dctx.strokeStyle = 'rgba(0,0,0,0.35)'; dctx.lineWidth = 1;
    dctx.beginPath(); dctx.moveTo(-w * 0.32 * s, -h * 0.06 * s); dctx.lineTo(w * 0.32 * s, -h * 0.06 * s); dctx.stroke();
    dctx.beginPath(); dctx.moveTo(-w * 0.1 * s, -h * 0.34 * s); dctx.lineTo(-w * 0.1 * s, h * 0.22 * s); dctx.stroke();
    dctx.strokeStyle = outline;
    // dada menyala
    dctx.fillStyle = hitFlash ? '#fff' : '#ffd76b';
    dctx.beginPath(); dctx.arc(0, -h * 0.14 * s, w * 0.07 * s, 0, Math.PI * 2); dctx.fill();
    // kepala + antena
    dctx.fillStyle = fill;
    roundRectPath(dctx, -w * 0.16 * s, -h * 0.62 * s, w * 0.32 * s, h * 0.28 * s, 4); dctx.fill(); dctx.stroke();
    dctx.strokeStyle = dark; dctx.lineWidth = 2.2;
    dctx.beginPath(); dctx.moveTo(0, -h * 0.62 * s); dctx.lineTo(0, -h * 0.76 * s); dctx.stroke();
    dctx.fillStyle = hitFlash ? '#fff' : '#ff5d5d';
    dctx.beginPath(); dctx.arc(0, -h * 0.78 * s, 3, 0, Math.PI * 2); dctx.fill();
    // visor mata menyala
    dctx.fillStyle = '#181a1c';
    roundRectPath(dctx, -w * 0.13 * s, -h * 0.52 * s, w * 0.26 * s, h * 0.1 * s, 3); dctx.fill();
    drawEye(dctx, -w * 0.05 * s, -h * 0.47 * s, isBoss ? 2.2 : 1.6, isBoss && !hitFlash);
    drawEye(dctx, w * 0.06 * s, -h * 0.47 * s, isBoss ? 2.2 : 1.6, isBoss && !hitFlash);
  } else {
    // === BANDIT TOMBAK: tubuh berdiri, jubah, kepala berikat kain, tombak ===
    const s = isBoss ? 1.1 : 1;
    dctx.strokeStyle = outline; dctx.lineWidth = 1.6;
    // kaki
    dctx.fillStyle = dark;
    dctx.fillRect(-w * 0.12 * s, h * 0.24 * s, w * 0.1 * s, h * 0.22 * s);
    dctx.fillRect(w * 0.02 * s, h * 0.24 * s, w * 0.1 * s, h * 0.22 * s);
    // jubah/badan
    dctx.fillStyle = fill;
    dctx.beginPath();
    dctx.moveTo(-w * 0.2 * s, -h * 0.4 * s);
    dctx.lineTo(w * 0.2 * s, -h * 0.4 * s);
    dctx.lineTo(w * 0.26 * s, h * 0.3 * s);
    dctx.lineTo(-w * 0.26 * s, h * 0.3 * s);
    dctx.closePath(); dctx.fill(); dctx.stroke();
    // ikat pinggang
    dctx.fillStyle = '#3a2a18';
    dctx.fillRect(-w * 0.24 * s, h * 0.02 * s, w * 0.48 * s, h * 0.07 * s);
    // kepala + ikat kain
    dctx.fillStyle = '#c98f6a';
    dctx.beginPath(); dctx.arc(0, -h * 0.52 * s, h * 0.16 * s, 0, Math.PI * 2); dctx.fill(); dctx.stroke();
    dctx.fillStyle = fill;
    dctx.beginPath(); dctx.arc(0, -h * 0.56 * s, h * 0.17 * s, Math.PI, Math.PI * 2); dctx.fill();
    dctx.beginPath(); dctx.moveTo(w * 0.14 * s, -h * 0.52 * s); dctx.lineTo(w * 0.28 * s, -h * 0.44 * s); dctx.lineTo(w * 0.15 * s, -h * 0.4 * s); dctx.closePath(); dctx.fill();
    drawEye(dctx, w * 0.06 * s, -h * 0.52 * s, isBoss ? 2.2 : 1.6, isBoss && !hitFlash);
    // tombak
    dctx.strokeStyle = '#8a6a42'; dctx.lineWidth = 3;
    dctx.beginPath(); dctx.moveTo(w * 0.3 * s, -h * 0.56 * s); dctx.lineTo(w * 0.4 * s, h * 0.38 * s); dctx.stroke();
    dctx.fillStyle = '#c7ccd2';
    dctx.beginPath(); dctx.moveTo(w * 0.26 * s, -h * 0.58 * s); dctx.lineTo(w * 0.34 * s, -h * 0.56 * s); dctx.lineTo(w * 0.28 * s, -h * 0.78 * s); dctx.closePath(); dctx.fill();
    dctx.strokeStyle = outline; dctx.lineWidth = 1;
    dctx.stroke();
  }
  dctx.restore();
}

/* Bos = versi "boss" dari makhluk yang sama, tapi jauh lebih besar & menyeramkan:
   aura merah berdenyut, mahkota duri tajam, mata menyala terang, armor/bekas luka,
   dan cincin energi. Dipakai SAMA PERSIS baik saat gameplay maupun di panel komik. */
function drawBossByMapId(dctx, mapId, cx, cy, w, h, color, hitFlash) {
  dctx.save();
  const pulse = 0.85 + Math.sin(Date.now() / 220) * 0.15;
  const glow = dctx.createRadialGradient(cx, cy, 4, cx, cy, w * 1.1 * pulse);
  glow.addColorStop(0, 'rgba(255,40,40,0.4)');
  glow.addColorStop(0.6, 'rgba(255,40,40,0.12)');
  glow.addColorStop(1, 'rgba(255,40,40,0)');
  dctx.fillStyle = glow;
  dctx.beginPath(); dctx.arc(cx, cy, w * 1.1 * pulse, 0, Math.PI * 2); dctx.fill();
  dctx.restore();

  // badan utama (skala lebih besar + detail boss aktif)
  drawCreatureByMapId(dctx, mapId, cx, cy, w, h, color, hitFlash, true);

  // mahkota duri besar & tajam di atas kepala, penanda tegas "BOS"
  dctx.save();
  dctx.translate(cx, cy);
  dctx.fillStyle = hitFlash ? '#fff' : '#151312';
  dctx.strokeStyle = hitFlash ? '#fff' : '#000';
  dctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const sx = -w * 0.3 + i * (w * 0.15);
    const tall = i === 2 ? h * 0.78 : (i % 2 === 0 ? h * 0.6 : h * 0.68);
    dctx.beginPath();
    dctx.moveTo(sx, -h * 0.36);
    dctx.lineTo(sx + w * 0.04, -tall);
    dctx.lineTo(sx + w * 0.09, -h * 0.36);
    dctx.closePath();
    dctx.fill(); dctx.stroke();
  }
  dctx.restore();

  // cincin energi ganda penegas ukuran boss
  dctx.save();
  dctx.strokeStyle = hitFlash ? 'rgba(255,255,255,0.85)' : 'rgba(255,220,120,0.6)';
  dctx.lineWidth = 2.4;
  dctx.beginPath(); dctx.arc(cx, cy, Math.max(w, h) * 0.66, 0, Math.PI * 2); dctx.stroke();
  dctx.strokeStyle = hitFlash ? 'rgba(255,255,255,0.5)' : 'rgba(255,80,80,0.35)';
  dctx.lineWidth = 1.4;
  dctx.beginPath(); dctx.arc(cx, cy, Math.max(w, h) * 0.78, 0, Math.PI * 2); dctx.stroke();
  dctx.restore();
}

/* ===================== DARAH BOS (efek tebal & dramatis) ===================== */
let qBloodParticles = [];
function spawnBossBlood(x, y, count, big) {
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.1;
    const spd = (big ? 3.2 : 2) + Math.random() * (big ? 3.5 : 2.2);
    qBloodParticles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (big ? 2 : 1),
      r: (big ? 3.5 : 2) + Math.random() * (big ? 4 : 2.5),
      life: 40 + Math.random() * 30,
      settled: false, sx: 0, sy: 0
    });
  }
}
function updateBossBlood() {
  qBloodParticles.forEach(p => {
    if (!p.settled) {
      p.vy += 0.35;
      p.x += p.vx; p.y += p.vy;
      if (p.y >= GROUND_Y - 2) { p.settled = true; p.sy = GROUND_Y - 2; p.sx = p.x; }
    }
    p.life--;
  });
  qBloodParticles = qBloodParticles.filter(p => p.life > 0);
}
function drawBossBlood() {
  qBloodParticles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = '#8a0e0e';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}
/* Genangan darah tebal & tetesan di bawah bos, makin besar makin sedikit HP-nya */
function drawBossBloodPool(cx, groundY, w, ratio) {
  if (ratio <= 0) return;
  ctx.save();
  const poolW = w * (0.5 + ratio * 0.9);
  const poolH = 6 + ratio * 10;
  const grd = ctx.createRadialGradient(cx, groundY - poolH * 0.3, 2, cx, groundY, poolW);
  grd.addColorStop(0, 'rgba(150,10,10,0.95)');
  grd.addColorStop(0.6, 'rgba(120,8,8,0.85)');
  grd.addColorStop(1, 'rgba(90,5,5,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, poolW, poolH, 0, 0, Math.PI * 2);
  ctx.fill();
  // beberapa tetesan darah kental menetes dari tubuh
  ctx.fillStyle = '#7a0c0c';
  const drips = 2 + Math.floor(ratio * 4);
  for (let i = 0; i < drips; i++) {
    const dx = cx - poolW * 0.6 + (i / Math.max(1, drips - 1)) * poolW * 1.2;
    const dh = 5 + ratio * 14 + (i % 3) * 4;
    ctx.beginPath();
    ctx.moveTo(dx - 3, groundY - dh);
    ctx.quadraticCurveTo(dx - 4, groundY - dh * 0.4, dx, groundY - 1);
    ctx.quadraticCurveTo(dx + 4, groundY - dh * 0.4, dx + 3, groundY - dh);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function qDrawEnemy(e) {
  const map = MAPS[qMapIndex];
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const bob = Math.sin(e.walkPhase * 0.3) * 2;
  drawCreatureByMapId(ctx, map.id, cx, cy + bob, e.w, e.h, map.enemyColor, e.hitFlash > 0);
}
function qDrawBoss() {
  if (!qBoss) return;
  const map = MAPS[qMapIndex];
  const bob = Math.sin(qBoss.bobPhase) * 3;
  drawBossBloodPool(qBoss.x, GROUND_Y - 2, qBoss.w, qBoss.bloodRatio || 0);
  drawBossByMapId(ctx, map.id, qBoss.x, qBoss.y + bob, qBoss.w, qBoss.h, map.bossColor, qBoss.hitFlash > 0);
  drawBossBlood();
  if (qBoss.warnUntil > 0) {
    const pulse = Math.floor(qFrame / 5) % 2 === 0;
    ctx.fillStyle = pulse ? 'rgba(255,80,80,0.5)' : 'rgba(255,80,80,0.15)';
    ctx.beginPath(); ctx.arc(qBoss.x, qBoss.y, qBoss.w * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  if (qBoss.strikeUntil > 0) {
    ctx.fillStyle = 'rgba(255,40,40,0.55)';
    ctx.fillRect(0, GROUND_Y - 6, canvas.width, 6);
  }
}
function qDrawPopups() {
  qPopups.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / 30);
    const scale = p.life > 24 ? 1 + (30 - p.life) * 0.08 : 1;
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  });
}
function qDrawAttackFlash() {
  if (qAttackFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = qAttackFlash / 10;
  ctx.strokeStyle = '#ffd76b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(dino.x + dino.w + 10, dino.y + dino.h / 2, 26, -0.6, 0.6);
  ctx.stroke();
  ctx.restore();
}
function questDraw() {
  qDrawBackground();
  qDrawClouds();
  qDrawFarHills();
  qDrawDecor();
  qDrawGround();
  qEntities.forEach(e => e.type === 'rock' ? qDrawRock(e) : qDrawEnemy(e));
  if (qBossActive) qDrawBoss();
  else if (qBloodParticles.length) drawBossBlood();
  let alpha = 1;
  if (qInvincible > 0 && Math.floor(qFrame / 5) % 2 === 0) alpha = 0.35;
  const skin = getSkin(data.selectedSkin);
  if (qAge < 20) {
    drawBabyDinoShape(ctx, dino.x, dino.y, dino.w, dino.h, skin, dino.jumping, qFrame, alpha);
  } else {
    drawDinoShape(ctx, dino.x, dino.y, dino.w, dino.h, skin, dino.jumping, qFrame, alpha);
  }
  qDrawAttackFlash();
  qDrawPopups();
}

/* ===================== STATE ===================== */
let state = 'menu'; // menu | shop | playing | gameover
let frame = 0;
let score = 0;
let runCoins = 0;
let runDiamonds = 0;
let coinStreak = 0;
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
let biome = 'padang';
let biomeScoreMark = 0;
const BIOME_INTERVAL = 500;

/* ===================== DINO ===================== */
const dino = {
  x: 0, y: 0, w: 40, h: 40,
  vy: 0, jumping: false
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  GROUND_Y = Math.floor(canvas.height * 0.68);
  dino.x = Math.floor(canvas.width * 0.12);
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
  if (alpha !== undefined) c.globalAlpha = alpha;

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

  // buff-affinity badge on chest (small icon showing this skin's signature buff)
  if (skin.affinity) {
    const info = skin.affinity === 'all' ? { icon: '★', color: '#fff2ff' } : BUFF_TYPES[skin.affinity];
    c.save();
    c.translate(x + 9, y + h - 24);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = info.color;
    c.font = 'bold 7px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(info.icon, 0, 0.5);
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
  lpUpdate();
  lobbyCtx.clearRect(0, 0, w, h);
  // langit senja lembut
  const g = lobbyCtx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#a8ddf0'); g.addColorStop(0.55, '#cdeeb0'); g.addColorStop(1, '#eaffe0');
  lobbyCtx.fillStyle = g;
  lobbyCtx.fillRect(0, 0, w, h);
  // matahari
  lobbyCtx.save();
  const sx = w * 0.82, sy = h * 0.16, sr = Math.max(20, w * 0.05);
  const sg = lobbyCtx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
  sg.addColorStop(0, 'rgba(255,244,190,0.95)');
  sg.addColorStop(1, 'rgba(255,244,190,0)');
  lobbyCtx.fillStyle = sg;
  lobbyCtx.beginPath(); lobbyCtx.arc(sx, sy, sr * 2.4, 0, Math.PI * 2); lobbyCtx.fill();
  lobbyCtx.fillStyle = '#fff3c0';
  lobbyCtx.beginPath(); lobbyCtx.arc(sx, sy, sr, 0, Math.PI * 2); lobbyCtx.fill();
  lobbyCtx.restore();
  // bukit jauh (parallax statis, dekorasi)
  lobbyCtx.fillStyle = 'rgba(80,150,80,0.28)';
  lobbyCtx.beginPath();
  lobbyCtx.moveTo(0, groundY);
  lobbyCtx.quadraticCurveTo(w * 0.2, groundY - h * 0.14, w * 0.42, groundY);
  lobbyCtx.quadraticCurveTo(w * 0.68, groundY - h * 0.1, w * 0.85, groundY);
  lobbyCtx.lineTo(w, groundY);
  lobbyCtx.lineTo(w, h); lobbyCtx.lineTo(0, h);
  lobbyCtx.closePath(); lobbyCtx.fill();
  // awan
  lobbyCtx.fillStyle = 'rgba(255,255,255,0.75)';
  [[0.13, 0.18, 1], [0.5, 0.12, 0.8], [0.32, 0.28, 0.65]].forEach(([fx, fy, scale]) => {
    const cx = w * fx, cy = h * fy, r = Math.max(10, w * 0.032) * scale;
    lobbyCtx.beginPath(); lobbyCtx.arc(cx, cy, r, 0, Math.PI * 2); lobbyCtx.fill();
    lobbyCtx.beginPath(); lobbyCtx.arc(cx + r * 0.85, cy + 3, r * 0.7, 0, Math.PI * 2); lobbyCtx.fill();
    lobbyCtx.beginPath(); lobbyCtx.arc(cx - r * 0.75, cy + 4, r * 0.6, 0, Math.PI * 2); lobbyCtx.fill();
  });
  // tanah
  const gg = lobbyCtx.createLinearGradient(0, groundY, 0, h);
  gg.addColorStop(0, '#4f9c36'); gg.addColorStop(1, '#33691f');
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
  // rintangan (batu)
  lpObstacles.forEach(o => {
    lobbyCtx.fillStyle = '#6b5a45';
    roundRectPath(lobbyCtx, o.x, groundY - o.h, o.w, o.h, 3);
    lobbyCtx.fill();
    lobbyCtx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRectPath(lobbyCtx, o.x + 2, groundY - o.h + 2, o.w - 6, 3, 2);
    lobbyCtx.fill();
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
  const n = weather === 'rain' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    clouds.push({ x: Math.random() * canvas.width, y: 20 + Math.random() * (GROUND_Y * 0.3), w: 34 + Math.random() * 30 });
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
  for (let i = 0; i < 60; i++) {
    rainDrops.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, len: 10 + Math.random() * 10, speed: 8 + Math.random() * 6 });
  }
}

let fogPatches = [];
function initFog() {
  fogPatches = [];
  for (let i = 0; i < 10; i++) {
    fogPatches.push({
      x: Math.random() * canvas.width,
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
  for (let i = 0; i < 18; i++) {
    windLines.push({ x: Math.random() * canvas.width, y: Math.random() * GROUND_Y, len: 20 + Math.random() * 30, speed: 10 + Math.random() * 8 });
  }
  windLeaves = [];
  for (let i = 0; i < 14; i++) {
    windLeaves.push({
      x: Math.random() * canvas.width,
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
  const groundTypes = ['cactusSmall', 'cactusBig', 'cactusGroup'];
  let pool = [...groundTypes, ...groundTypes];

  if (weather === 'rain') pool.push('lightning');
  if (weather === 'wind') pool.push('flyingLow', 'flyingHigh', 'flyingDebris');
  if (weather === 'kabut') pool.push('batuKabut', 'batuKabut');

  const type = pool[Math.floor(Math.random() * pool.length)];
  let obs = { type, x: canvas.width + 30 };

  if (type === 'cactusSmall') {
    obs.w = 18; obs.h = 36; obs.y = GROUND_Y - obs.h;
  } else if (type === 'cactusBig') {
    obs.w = 26; obs.h = 52; obs.y = GROUND_Y - obs.h;
  } else if (type === 'cactusGroup') {
    obs.w = 52; obs.h = 36; obs.y = GROUND_Y - obs.h;
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
  coins.push({ x: canvas.width + 30, y, r: 12, collected: false, spin: 0 });
}

function spawnBuff() {
  const pool = ['speed', 'speed', 'jump', 'jump', 'coin2x', 'coin2x', 'shield', 'shield', 'magnet', 'magnet', 'slowmo', 'slowmo', 'life'];
  const type = pool[Math.floor(Math.random() * pool.length)];
  const highChance = Math.random() < 0.5;
  const y = highChance ? GROUND_Y - 100 : GROUND_Y - 38;
  buffs.push({ x: canvas.width + 30, y, r: 16, type, collected: false, bob: Math.random() * Math.PI * 2 });
}

function spawnDiamond() {
  const highChance = Math.random() < 0.5;
  const y = highChance ? GROUND_Y - 105 : GROUND_Y - 34;
  diamonds.push({ x: canvas.width + 30, y, r: 11, collected: false, spin: 0 });
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
  weatherPill.textContent = w === 'rain' ? '🌧 HUJAN' : (w === 'wind' ? '💨 ANGIN' : (w === 'kabut' ? '🌫 BERKABUT' : '☀ CERAH'));
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
  biome = b;
  biomeSeen.add(b);
  biomePill.textContent = BIOMES[b].label;
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
  if (state !== 'playing' || qPaused) return;
  if (inChapter2) { q2Thrust = true; return; }
  if (!dino.jumping) {
    dino.jumping = true;
    dino.vy = mode === 'quest' ? JUMP_FORCE : currentJumpForce();
  }
}
function releaseFlight() {
  if (inChapter2) q2Thrust = false;
}
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); releaseFlight(); }, { passive: false });
canvas.addEventListener('mousedown', jump);
canvas.addEventListener('mouseup', releaseFlight);

/* ===================== SCREEN MANAGEMENT ===================== */
function showScreen(name) {
  lobby.classList.remove('active');
  shop.classList.remove('active');
  account.classList.remove('active');
  gameover.classList.remove('active');
  hud.style.display = 'none';
  questHud.style.display = 'none';
  attackBtn.classList.remove('ready');
  if (name !== 'playing') bossBarWrap.style.display = 'none';
  if (name === 'menu') { dino.w = 40; dino.h = 40; resetDino(); lobby.classList.add('active'); refreshLobbyStats(); }
  if (name === 'shop') { shop.classList.add('active'); renderShop(); }
  if (name === 'account') { account.classList.add('active'); renderAccountScreen(); }
  if (name === 'gameover') { gameover.classList.add('active'); }
  if (name === 'playing') {
    if (mode === 'quest') {
      questHud.style.display = 'flex';
      if (qUnlockedSkills.length || inChapter2) attackBtn.classList.add('ready');
      if (qBossActive) bossBarWrap.style.display = 'block';
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
  renderLobbyDino();
  const profile = getActiveProfile();
  document.getElementById('profilePillName').textContent = profile ? profile.name : 'Pemain';
  const continueBtn = document.getElementById('questContinueBtn');
  const badge = document.getElementById('questStatusBadge');
  const questBtn = document.getElementById('modeQuestBtn');
  const qp = data.questProgress;
  if (data.questCompleted) {
    continueBtn.style.display = 'none';
    if (data.chapter2StageDone) {
      questBtn.textContent = '🔒 CHAPTER 3 — SEGERA';
      badge.style.display = 'block';
      badge.textContent = `🏆 CHAPTER 2 TAMAT — Total mantra: ${data.mantraCount}`;
    } else {
      questBtn.textContent = '🐉 CHAPTER 2 — TERBANG!';
      badge.style.display = 'block';
      badge.textContent = `🐉 NAGA SEJATI — Mantra terkumpul: ${data.mantraCount}`;
    }
  } else {
    questBtn.textContent = '📖 STORY MODE';
    badge.style.display = 'none';
    if (qp && qp.mapIndex > 0 && qp.mapIndex < MAPS.length) {
      continueBtn.style.display = 'block';
      continueBtn.textContent = `▶ LANJUTKAN — ${MAPS[qp.mapIndex].name}`;
    } else {
      continueBtn.style.display = 'none';
    }
  }
}

function renderShop() {
  document.getElementById('shopCoins').textContent = `🪙 ${data.coins} KOIN`;
  const grid = document.getElementById('skinGrid');
  grid.innerHTML = '';
  SKINS.forEach(s => {
    const unlocked = data.unlocked.includes(s.id);
    const selected = data.selectedSkin === s.id;
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
      const afford = data.coins >= s.cost;
      btnHtml = `<button class="skin-btn ${afford ? 'buy' : 'locked'}" data-id="${s.id}" data-action="buy" ${afford ? '' : 'disabled'}>BELI 🪙${s.cost}</button>`;
    }
    const swatchCanvas = document.createElement('canvas');
    swatchCanvas.width = 112; swatchCanvas.height = 88;
    swatchCanvas.className = 'skin-swatch';
    card.innerHTML = `<div class="skin-name">${s.name}</div>${btnHtml}`;
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
        if (data.coins >= s.cost) {
          data.coins -= s.cost;
          data.unlocked.push(id);
          data.selectedSkin = id;
          saveData();
          renderShop();
        }
      } else if (action === 'select') {
        data.selectedSkin = id;
        saveData();
        renderShop();
      }
    });
  });
}

document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('modeBiasaBtn').addEventListener('click', startGame);
document.getElementById('modeQuestBtn').addEventListener('click', () => {
  if (data.questCompleted) {
    if (!data.chapter2IntroSeen) {
      playChapter2Intro();
    } else if (data.chapter2StageDone) {
      // Chapter 2 sudah tamat: dikunci sama seperti Chapter 1, tidak bisa diulang.
      queueComicPage('CHAPTER 2 TAMAT', [
        panel(sceneComingSoonChapter3, null)
      ], `Kamu sudah menamatkan Puncak Langit dan mengumpulkan seluruh mantra kuno di sana!\nSang naga kini telah berevolusi dengan wujud barunya yang berkilau ungu-keemasan.\n\nTotal mantra terkumpul: ${data.mantraCount}\n\nChapter 2 tidak bisa dimainkan ulang dari sini. Nantikan Chapter 3 yang akan datang!`, () => {}, 'OKE');
      playNextStory();
    } else {
      startChapter2();
    }
    return;
  }
  const qp = data.questProgress;
  if (qp && qp.mapIndex > 0) {
    if (confirm('Progres story mode yang tersimpan akan hilang. Mulai petualangan baru dari awal?')) {
      startQuest(true);
    }
  } else {
    startQuest(true);
  }
});
document.getElementById('questContinueBtn').addEventListener('click', () => startQuest(false));
document.getElementById('shopBtnLobby').addEventListener('click', () => showScreen('shop'));
document.getElementById('shopBackBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('retryBtn').addEventListener('click', () => {
  if (mode === 'quest') { inChapter2 ? startChapter2() : startQuest(false); }
  else startGame();
});
document.getElementById('goLobbyBtn').addEventListener('click', () => showScreen('menu'));
document.getElementById('profilePillBtn').addEventListener('click', () => showScreen('account'));
document.getElementById('accountBackBtn').addEventListener('click', () => showScreen('menu'));
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
  inChapter2 = false;
  dino.w = 40; dino.h = 40;
  obstacles = [];
  coins = [];
  buffs = [];
  popups = [];
  dinoTrail = [];
  dustParticles = [];
  activeBuffs = { speed: 0, jump: 0, coin2x: 0, shield: 0, magnet: 0, slowmo: 0 };
  score = 0;
  runCoins = 0;
  runDiamonds = 0;
  coinStreak = 0;
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
  resetDino();
  setWeather('clear');
  setBiome('padang');
  updateHud();
  showScreen('playing');
}

function loseLife() {
  if (invincible > 0) return;
  lives--;
  invincible = 90;
  coinStreak = 0;
  flashRed();
  triggerShake();
  if (lives <= 0) endGame();
}

function registerStreak() {
  coinStreak++;
  if (coinStreak > data.bestStreak) data.bestStreak = coinStreak;
  if (coinStreak > 0 && coinStreak % 10 === 0) {
    const bonus = 5 * (coinStreak / 10);
    runCoins += bonus;
    spawnPopup(dino.x + dino.w / 2, dino.y - 26, `STREAK x${coinStreak}! +${bonus}`, '#ff9f43');
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

function endGame() {
  const isNewBest = Math.floor(score) > data.highScore;
  if (isNewBest) data.highScore = Math.floor(score);
  data.coins += runCoins;
  data.diamonds += runDiamonds;
  const newlyUnlocked = checkAchievements();
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
    if (newlyUnlocked.length) {
      achEl.style.display = '';
      achEl.innerHTML = '🏆 PRESTASI BARU: ' + newlyUnlocked.map(a => `${a.icon} ${a.label}`).join(' &nbsp;·&nbsp; ');
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
  let alpha = 1;
  if (invincible > 0 && Math.floor(frame / 5) % 2 === 0) alpha = 0.35;
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
  ctx.scale(Math.max(scaleX, 0.15), 1);
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23c';
  ctx.fill();
  ctx.strokeStyle = '#c9971f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff2b8';
  ctx.beginPath();
  ctx.arc(-3, -3, c.r * 0.35, 0, Math.PI * 2);
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

function skyColors() {
  if (weather === 'rain') return ['#5b6b7a', '#aab6c2'];
  if (weather === 'wind') return ['#f2c98a', '#fdeccb'];
  if (weather === 'kabut') return ['#b9c2c9', '#e6ebee'];
  return BIOMES[biome].sky;
}
function groundColors() {
  if (weather === 'rain') return { grass: '#3d5a3d', grassDark: '#2c4128', dirt: '#4a3a2e', dirtDark: '#39291f' };
  if (weather === 'wind') return { grass: '#b5a94f', grassDark: '#8f8536', dirt: '#c9a870', dirtDark: '#a8875a' };
  if (weather === 'kabut') return { grass: '#7c8a86', grassDark: '#5e6a67', dirt: '#8a8078', dirtDark: '#6b6259' };
  return BIOMES[biome].ground;
}
function hillColor(layer) {
  if (weather === 'rain') return layer === 'back' ? '#4a5a52' : '#3a4a40';
  if (weather === 'wind') return layer === 'back' ? '#c9b878' : '#b8a05f';
  if (weather === 'kabut') return layer === 'back' ? '#9aa3a6' : '#828b8e';
  return layer === 'back' ? BIOMES[biome].hill.back : BIOMES[biome].hill.front;
}

function drawBackground() {
  const [top, bottom] = skyColors();
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // sun / moon
  if (weather !== 'rain' && weather !== 'kabut') {
    const sx = canvas.width * 0.82, sy = canvas.height * 0.16, sr = 34;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.2);
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
    ctx.beginPath(); ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = weather === 'wind' ? '#ffcf6b' : (biome === 'malam' ? '#eef1ff' : '#ffe36b');
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    if (biome === 'malam' && weather === 'clear') {
      ctx.fillStyle = BIOMES.malam.sky[1];
      ctx.beginPath(); ctx.arc(sx - 10, sy - 8, sr * 0.8, 0, Math.PI * 2); ctx.fill();
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
  ctx.lineTo(canvas.width, baseY + 200);
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
  const dg = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height);
  dg.addColorStop(0, gc.dirt);
  dg.addColorStop(1, gc.dirtDark);
  ctx.fillStyle = dg;
  ctx.fillRect(0, GROUND_Y + 6, canvas.width, canvas.height - GROUND_Y - 6);

  // grass strip
  ctx.fillStyle = gc.grass;
  ctx.fillRect(0, GROUND_Y - 2, canvas.width, 8);

  // grass tufts + pebbles
  const count = Math.ceil(canvas.width / 22) + 2;
  for (let i = 0; i < count; i++) {
    const x = (i * 22 - groundOffset % 22);
    const variant = i % 3;
    if (variant !== 2) {
      ctx.fillStyle = gc.grassDark;
      ctx.fillRect(x, GROUND_Y - 6, 3, 6);
      ctx.fillRect(x + 5, GROUND_Y - 8, 3, 8);
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
        if (o.x < canvas.width && o.x + o.w > 0) flashWhite();
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
      registerStreak();
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
      spawnPopup(dino.x + dino.w / 2, dino.y - 10, '+1 💎', '#7fe3ff');
      registerStreak();
    }
  }

  ['speed', 'jump', 'coin2x', 'shield', 'magnet', 'slowmo'].forEach(k => { if (activeBuffs[k] > 0) activeBuffs[k]--; });

  if (activeBuffs.speed > 0) {
    dinoTrail.push({ x: dino.x, y: dino.y, jumping: dino.jumping, frame });
    if (dinoTrail.length > 4) dinoTrail.shift();
  } else if (dinoTrail.length) {
    dinoTrail = [];
  }

  if (!dino.jumping && frame % 6 === 0) {
    dustParticles.push({ x: dino.x + dino.w * 0.25, y: GROUND_Y - 2, life: 16, vx: -effSpeed * 0.5 - 1 });
  }
  dustParticles.forEach(d => { d.x += d.vx; d.life--; });
  dustParticles = dustParticles.filter(d => d.life > 0);

  popups.forEach(p => { p.y -= 0.6; p.life--; });
  popups = popups.filter(p => p.life > 0);

  if (weather === 'rain') {
    rainDrops.forEach(d => {
      d.y += d.speed;
      d.x -= effSpeed * 0.3;
      if (d.y > canvas.height) { d.y = -10; d.x = Math.random() * canvas.width; }
      if (d.x < 0) d.x = canvas.width;
    });
  }
  if (weather === 'wind') {
    windLines.forEach(l => {
      l.x -= l.speed;
      if (l.x < -l.len) { l.x = canvas.width + Math.random() * 100; l.y = Math.random() * GROUND_Y; }
    });
    windLeaves.forEach(lf => {
      lf.x -= lf.speed;
      lf.rot += lf.rotSpeed;
      lf.bob += 0.07;
      if (lf.x < -20) {
        lf.x = canvas.width + Math.random() * 100;
        lf.y = Math.random() * GROUND_Y;
      }
    });
  }

  if (weather === 'kabut') {
    fogPatches.forEach(f => {
      f.x -= effSpeed * 0.2 + f.speed;
      if (f.x < -f.w) { f.x = canvas.width + Math.random() * 100; f.y = GROUND_Y - 10 - Math.random() * 160; }
    });
  }

  groundOffset += effSpeed;
  hillOffsetBack += effSpeed * 0.2;
  hillOffsetFront += effSpeed * 0.4;
  clouds.forEach(c => {
    c.x -= effSpeed * (weather === 'wind' ? 0.9 : 0.3);
    if (c.x < -60) { c.x = canvas.width + Math.random() * 100; c.y = 20 + Math.random() * (GROUND_Y * 0.3); }
  });

  score += 0.15;
  gameSpeed = Math.min(6 + score / 180, 13);

  maybeChangeWeather();
  maybeChangeBiome();
  updateHud();
}

/* ===================== DRAW ===================== */
function drawDust() {
  dustParticles.forEach(d => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.life / 16) * 0.4;
    ctx.fillStyle = '#a08a6a';
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - (16 - d.life) * 0.4, 5 + (16 - d.life) * 0.3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
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
  drawPopups();
  if (weather === 'rain') drawRain();
  if (weather === 'kabut') drawFog();
}

/* ===================== LOOP ===================== */
function loop() {
  if (state === 'playing') {
    if (mode === 'quest') {
      if (inChapter2) {
        q2Update();
        q2Draw();
      } else {
        questUpdate();
        questDraw();
      }
    } else {
      update();
      draw();
    }
  }
  requestAnimationFrame(loop);
}

/* ===================== INIT ===================== */
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
