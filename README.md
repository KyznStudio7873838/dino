# Server Akun — Dino Runner

Backend kecil untuk sistem akun online. Tiap akun disimpan sebagai baris di
`data/accounts.json`, dan progres tiap akun disimpan **terpisah** di
`data/saves/<username>.json` — jadi data antar pemain tidak akan tercampur.

## Cara jalanin di komputer/HP kamu (lokal)

```
cd server
npm install
npm start
```

Server aktif di `http://localhost:3000`. File `data/` (akun + save tiap
pemain) otomatis dibuat saat pertama kali dipakai — jangan dihapus kalau
tidak mau kehilangan data pemain.

## Supaya bisa dipakai dari game beneran (online)

1. Deploy folder `server/` ini ke hosting yang bisa jalanin Node.js (mis.
   Railway, Render, VPS, dst).
2. Di `script.js`, ganti nilai `SERVER_API_BASE` dari
   `http://localhost:3000` menjadi alamat server kamu yang sudah online
   (contoh: `https://akun-dino-kamu.up.railway.app`).
3. Di `server.js`, ganti `CORS_ORIGIN` dari `*` ke alamat situs game kamu,
   dan jalankan di belakang HTTPS supaya password tidak dikirim polos.

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
