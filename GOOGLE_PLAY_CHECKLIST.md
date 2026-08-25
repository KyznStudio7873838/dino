# Checklist: Dino Runner → Google Play Store

Game ini PWA. Jalur resminya: bungkus jadi **TWA (Trusted Web Activity)** — app Android tipis yang menampilkan PWA kamu, didukung resmi oleh Google.

## ✅ SUDAH SELESAI (gw siapin di paket ini)

- [x] `manifest.json` lengkap (id, name, icons 192/512, maskable, categories, standalone)
- [x] Service worker offline caching (`sw.js`), sudah include halaman privacy policy
- [x] Icon 512x512 & maskable-512 ukurannya benar
- [x] Password akun di-hash (scrypt), bukan plaintext
- [x] `SERVER_API_BASE` di script.js SUDAH otomatis pakai domain tempat game di-host — kamu TIDAK perlu edit manual kalau server & frontend satu domain
- [x] `privacy-policy.html` — halaman siap upload, tinggal isi tanggal & email
- [x] Link "Kebijakan Privasi" sudah ditaruh di menu Akun dalam game
- [x] `feature-graphic-1024x500.png` — feature graphic siap upload ke Play Console
- [x] `server/Dockerfile` — siap deploy ke Railway/Render/VPS mana pun yang support Docker
- [x] `server/render.yaml` — blueprint deploy otomatis ke Render.com (termasuk disk permanen buat data akun)
- [x] `netlify.toml` — config hosting frontend ke Netlify dengan header cache yang benar buat PWA

## ⛔ YANG HARUS KAMU LAKUKAN SENDIRI (butuh akun/pembayaran milikmu, gw gak bisa lakuin ini)

### 1. Isi data pribadi di privacy-policy.html
Buka file itu, ganti semua `[ISI TANGGAL]` dan `[ISI EMAIL]` dengan data asli.

### 2. Deploy frontend (file-file utama: index.html, script.js, dll — JANGAN folder /server)
Pilih salah satu (gratis):
- **Netlify**: netlify.com → drag & drop folder ini (tanpa `/server`) → langsung dapat HTTPS
- **Cloudflare Pages**: pages.cloudflare.com → sama, drag & drop
- **GitHub Pages**: push ke repo → aktifkan Pages di Settings

Setelah live, kamu punya URL seperti `https://dinorunner.netlify.app`.

### 3. Deploy server akun (folder `/server`) — kalau mau fitur Akun Online aktif
- **Render.com**: New → Blueprint → connect repo yang isi folder `server/` → otomatis kebaca `render.yaml`
- **Railway.app**: New Project → Deploy from repo → otomatis kebaca `Dockerfile`

Setelah live, update `CORS_ORIGIN` di environment variable server ke domain frontend kamu (dari langkah 2), misal `https://dinorunner.netlify.app`.

Kalau server dan frontend beda domain, buka `script.js` dan isi `manualOverride` (ada komentar jelas di dekat baris ~406) dengan URL server-mu.

### 4. Generate Android App Bundle (.aab) via PWABuilder
1. pwabuilder.com → masukkan URL frontend yang sudah live
2. Pilih Android → isi package name, misal `com.kyzenteam.dinorunner`
3. Download hasil: `.aab` + signing key + `assetlinks.json`
4. Upload `assetlinks.json` ke `https://domainkamu.com/.well-known/assetlinks.json` (redeploy frontend dengan file ini)

### 5. Screenshot gameplay
Play Console butuh minimal 2 screenshot asli gameplay (disarankan 4-8), ukuran min 320px sisi terpendek. Ambil langsung dari HP/browser pas main.

### 6. Google Play Console
1. Daftar (biaya sekali $25) di play.google.com/console
2. Buat app baru, isi:
   - Nama, deskripsi singkat & lengkap
   - Upload `feature-graphic-1024x500.png` dan `icon-512.png`
   - Upload screenshot dari langkah 5
   - **Content rating**: isi kuesioner IARC
   - **Data safety form**: cocokkan dengan isi privacy-policy.html (username+password dikumpulkan jika user login, di-hash, tidak dibagikan ke pihak ketiga)
   - **Privacy policy URL**: link ke `privacy-policy.html` yang sudah live
3. Upload `.aab` ke track **Internal Testing** dulu, tes beberapa hari, baru promosikan ke Production
4. Submit for review (biasanya 1-7 hari)

## Urutan tercepat
1. Isi privacy-policy.html → 2. Deploy frontend (Netlify) → 3. Deploy server (Render) → 4. Set CORS_ORIGIN → 5. PWABuilder generate .aab → 6. Upload assetlinks.json → 7. Screenshot → 8. Isi Play Console → 9. Internal Testing → 10. Production

Kalau nyangkut di salah satu langkah (misal error CORS, PWABuilder score rendah, dll), kirim screenshot error-nya ke gw, langsung gw bantu debug.
