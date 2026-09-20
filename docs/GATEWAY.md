# NEXOVONARSA CORPORATION Gateway

Gateway ini adalah runtime Node.js opsional untuk menjalankan frontend yang sama dengan environment lokal/server.

## Jalankan

```bash
npm install
npm start
```

Default URL:

`http://127.0.0.1:8080`

Environment:

- `HOST` default `127.0.0.1`
- `PORT` default `8080`

## Endpoint

- `GET /api/health` — status gateway dan versi runtime.
- `GET /api/version` — identitas aplikasi dan versi.
- Semua asset frontend tersedia melalui gateway statis.

Gateway menambahkan header keamanan dasar, menolak method selain GET/HEAD, dan memeriksa path agar asset tidak bisa keluar dari root aplikasi.

## Test

```bash
npm test
```

Test mencakup validator repository, smoke test seluruh route frontend, dan smoke test gateway.

GitHub Pages tetap menggunakan deployment statis. Gateway digunakan untuk local development, VPS/container, reverse proxy, atau environment Node.js lain.
