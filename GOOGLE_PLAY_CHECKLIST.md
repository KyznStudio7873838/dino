# Checklist: Dino Runner → Google Play Store

Game ini PWA (HTML/CSS/JS), jadi jalur tercepat & resmi ke Play Store adalah bungkus jadi **TWA (Trusted Web Activity)** — Android app tipis yang menampilkan PWA kamu secara native. Ini BUKAN webview biasa, dan Google secara resmi mendukungnya.

## STATUS SEKARANG (sudah OK)
- [x] manifest.json lengkap (name, icons 192/512, maskable, standalone, theme_color)
- [x] Service worker offline caching sudah jalan
- [x] Icon 512x512 & maskable-512 ukurannya benar
- [x] Password akun di-hash (scrypt), tidak plaintext

## BLOKER UTAMA yang HARUS diselesaikan sebelum bisa submit

### 1. Hosting HTTPS publik (WAJIB)
TWA butuh PWA kamu live di domain HTTPS asli (bukan localhost). Opsi murah/gratis:
- GitHub Pages / Cloudflare Pages / Netlify / Vercel → untuk file statis (index.html, script.js, dll)
- Server akun (`server/`) butuh hosting Node terpisah yang bisa jalan terus: Railway, Render, Fly.io, VPS, dll — plus HTTPS.

### 2. Ganti SERVER_API_BASE
Di `script.js` baris ~402:
```js
const SERVER_API_BASE = 'http://localhost:3000';
```
Ganti ke domain server production kamu, HARUS `https://...` (bukan http). Kalau tidak diganti, fitur Akun Online cuma akan gagal senyap dan balik ke localStorage saja (game tetap jalan, tapi sinkron akun tidak berfungsi).

### 3. Digital Asset Links (WAJIB untuk TWA)
Supaya Android tahu app kamu "memiliki" domain itu (biar address bar Chrome hilang / full app-like):
- Generate fingerprint SHA-256 dari keystore signing kamu
- Taruh file `.well-known/assetlinks.json` di root domain kamu, isinya menyatakan package name Android + fingerprint tsb
- PWABuilder (langkah 4) bisa generate file ini otomatis

### 4. Bungkus jadi Android App (AAB)
Cara termudah tanpa install Android Studio: pakai **PWABuilder** (pwabuilder.com, resmi didukung Google/Microsoft):
1. Buka pwabuilder.com → masukkan URL PWA kamu yang sudah live
2. PWABuilder scan manifest.json & service worker kamu (skor akan tinggi karena manifest sudah lengkap)
3. Pilih platform **Android** → generate package (isi package name, mis. `com.kyzenteam.dinorunner`)
4. Download hasil: dapat `.aab` (Android App Bundle) + signing key + file `assetlinks.json`
5. Upload `assetlinks.json` ke `https://domainkamu.com/.well-known/assetlinks.json`

Alternatif lebih advanced: **Bubblewrap CLI** (`npm i -g @bubblewrap/cli`) kalau mau kontrol penuh dari command line.

### 5. Privacy Policy live
File `PRIVACY_POLICY.md` sudah dibuatkan di folder ini — isi bagian [ISI ...], lalu publish sebagai halaman web (bisa halaman biasa di situs Kyzen Team). Link ini WAJIB dimasukkan ke Play Console.

## Setup Play Console (setelah AAB siap)
1. Daftar akun Google Play Console (biaya sekali $25)
2. Buat app baru → isi:
   - **App details**: nama, deskripsi singkat/lengkap (Bahasa Indonesia OK)
   - **Store listing**: screenshot minimal 2 (disarankan 4-8), ukuran min 320px, feature graphic 1024x500, icon 512x512 (ambil dari `icon-512.png`)
   - **Content rating**: isi kuesioner IARC (game ini kekerasan ringan/tanpa kekerasan → biasanya rating rendah)
   - **Data safety form**: WAJIB cocok dengan privacy policy — jelaskan: username & password dikumpulkan (kalau user login), data disimpan terenkripsi, tidak dibagikan ke pihak ketiga
   - **Target audience**: pilih kategori umur
   - **Privacy policy URL**: link ke halaman PRIVACY_POLICY yang sudah live
3. Upload `.aab` ke Production (atau mulai dari Internal Testing track dulu — disarankan)
4. Set **target API level** — PWABuilder/Bubblewrap otomatis pakai versi terbaru yang Play Store syaratkan, biasanya sudah aman
5. Submit for review (biasanya 1-7 hari)

## Rekomendasi urutan pengerjaan
1. Deploy front-end statis ke hosting gratis (Cloudflare Pages tercepat)
2. Deploy `server/` ke Railway/Render (kalau fitur Akun Online mau dipakai — kalau belum siap, bisa disable dulu tombol Akun Online biar tidak membingungkan pemain)
3. Update `SERVER_API_BASE` → redeploy front-end
4. Generate AAB via PWABuilder
5. Isi privacy policy real, publish
6. Isi Play Console lengkap → submit ke Internal Testing dulu → baru Production

Kalau butuh, gw bisa bantuin bikinin halaman privacy policy HTML siap-pasang, atau bantu troubleshoot pas deploy servernya.
