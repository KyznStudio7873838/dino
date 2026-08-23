# Server Akun — Dino Runner

Backend kecil untuk sistem akun online. Tiap akun disimpan sebagai baris di
`data/accounts.json`, dan progres tiap akun disimpan **terpisah** di
`data/saves/<username>.json` — jadi data antar pemain tidak akan tercampur.

## Supaya bisa dipakai dari game beneran (online, tanpa perlu laptop kamu nyala terus)

Cara paling gampang: taruh folder `server` ini di GitHub, lalu sambungkan ke hosting
gratis yang bisa jalanin Node.js (contoh di sini pakai **Render**, tapi Railway/Fly.io
juga bisa dengan langkah serupa).

### A. Push folder `server` ke GitHub

1. Bikin akun GitHub kalau belum punya: https://github.com/join
2. Bikin repository baru (tombol hijau **New**) — kasih nama bebas, misal
   `dino-runner-server`. Biarkan **Public** atau **Private** juga boleh.
3. Di komputer kamu, buka terminal, masuk ke folder `server` ini, lalu:
   ```
   cd server
   git init
   git add .
   git commit -m "server akun dino runner"
   git branch -M main
   git remote add origin https://github.com/USERNAME-KAMU/dino-runner-server.git
   git push -u origin main
   ```
   Ganti `USERNAME-KAMU` dan nama repo sesuai punya kamu (lihat di halaman repo
   GitHub kamu, ada tombol "Code" > salin URL-nya).
   *(Belum ada Git di komputer? Install dulu dari https://git-scm.com)*

### B. Deploy dari GitHub ke Render (gratis)

1. Bikin akun di https://render.com (bisa langsung pakai akun GitHub kamu buat daftar).
2. Di dashboard Render, klik **New +** → **Web Service**.
3. Pilih **Build and deploy from a Git repository**, sambungkan akun GitHub kamu,
   lalu pilih repo `dino-runner-server` yang tadi kamu push.
4. Isi pengaturan:
   - **Name**: bebas, misal `dino-runner-akun`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Klik **Create Web Service**. Tunggu proses build selesai (biasanya 1-3 menit).
6. Setelah selesai, di bagian atas halaman servicenya Render kasih alamat publik,
   bentuknya kira-kira: `https://dino-runner-akun.onrender.com`
7. Cek server-nya hidup: buka `https://dino-runner-akun.onrender.com/api/health`
   di browser, harus muncul `{"ok":true,...}`.

### C. Sambungkan game ke server online ini

Di `script.js`, cari baris:
```js
const SERVER_API_BASE = 'http://localhost:3000';
```
Ganti jadi alamat Render kamu (tanpa garis miring di akhir):
```js
const SERVER_API_BASE = 'https://dino-runner-akun.onrender.com';
```
Lalu di `server.js`, cari baris:
```js
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
```
Boleh dibiarkan `*` dulu untuk uji coba. Kalau situs game kamu sudah punya alamat
tetap, ganti `*` dengan alamat itu supaya lebih aman.

### Catatan penting soal Render gratis

- **Server "tidur" kalau tidak dipakai ±15 menit** — request pertama setelah itu
  akan lambat beberapa detik (server "bangun" dulu). Ini normal untuk tier gratis.
- **Penyimpanan file bisa ke-reset setiap kali kamu deploy ulang** dari GitHub
  (push commit baru). Untuk testing/game kasual ini biasanya tidak masalah, tapi
  kalau nanti butuh data akun benar-benar tidak pernah hilang meski sering
  update kode, pertimbangkan upgrade ke Render Disk (berbayar) atau pindah ke
  database sungguhan.

## Cara jalanin di komputer/HP kamu sendiri (lokal, untuk coba-coba)

```
cd server
npm install
npm start
```

Server aktif di `http://localhost:3000`. File `data/` (akun + save tiap
pemain) otomatis dibuat saat pertama kali dipakai — jangan dihapus kalau
tidak mau kehilangan data pemain.

## Endpoint

| Method | Path            | Perlu login? | Fungsi                          |
|--------|-----------------|--------------|----------------------------------|
| POST   | /api/register   | tidak        | Buat akun baru                   |
| POST   | /api/login      | tidak        | Masuk, dapat token                |
| POST   | /api/logout     | ya           | Keluar (hapus token di server)    |
| GET    | /api/data       | ya           | Ambil data save akun              |
| POST   | /api/data       | ya           | Simpan data save akun             |
| GET    | /api/health     | tidak        | Cek server hidup + jumlah akun    |

Kirim token di header: `Authorization: Bearer <token>`.

## Catatan keamanan

- Password di-hash pakai `scrypt` (bawaan Node.js) + salt acak per akun —
  password asli tidak pernah disimpan.
- Login yang gagal berkali-kali (8x) untuk satu username akan dikunci
  sementara 5 menit, biar tidak gampang ditebak paksa (brute force).
- Ini backend sederhana untuk game single-player kasual. Untuk skala besar
  atau data sensitif, pertimbangkan database sungguhan (mis. PostgreSQL)
  dan proses login yang lebih ketat.
