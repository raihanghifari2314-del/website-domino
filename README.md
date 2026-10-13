# Domino Island 🏝️

Game papan kasual berbasis web — **Gaple** & **QiuQiu**, 4 pemain per meja, dengan **mode turnamen**. MVP lokal, zero-install, UI responsif & colorful.

> Lawan menggunakan **bot heuristik** (bukan AI/LLM). Chip bersifat virtual. Lihat `ARCHITECTURE.md` untuk blueprint produksi (Flutter Web / Unity WebGL + backend realtime).

## Fitur MVP
- 🀱 **Gaple** — domino klasik 4 pemain (block variant), skor sampai 100, deteksi domino & buntu.
- 🎴 **QiuQiu** — Kiu-Kiu / Domino 99, 4 kartu per pemain, kombinasi spesial (Balak, Enam Dewa, Murni Kecil, QiuQiu 9-9).
- 🏆 **Turnamen** — single-elimination 8 peserta, bracket tersimpan di browser.
- 📱 **Responsif** — desktop & mobile browser.

## Cara Menjalankan (lokal)

**Paling gampang — tanpa install apa pun:**
Cukup **double-click `index.html`** (atau klik kanan → Open with → browser). Game langsung jalan.

> Versi yang dipakai `index.html` adalah bundel standalone `game.js` (satu file, tanpa ES Modules), jadi bisa dibuka langsung dari filesystem (`file://`) tanpa server. Cocok untuk mesin tanpa Python/Node.

**Opsional — jalankan lewat server statis** (jika ingin memakai versi modular `src/` lewat ES Modules, lihat catatan di bawah):
```powershell
cd c:\Users\vboxuser\Documents\website-domino
python -m http.server 8080   # butuh Python asli (bukan alias Microsoft Store)
```
Lalu buka http://localhost:8080

### Uji cepat engine
Buka **`test.html`** di browser untuk menjalankan self-test engine (deck, deterministic shuffle, kelengkapan ronde Gaple, scoring QiuQiu, bracket turnamen). Semua assertion tampil hijau/merah.

### Catatan versi modular vs bundel
- `index.html` + `game.js` → **bundel standalone**, zero-install, dipakai untuk main.
- `src/**` (ES Modules) → **sumber modular & referensi arsitektur** untuk port ke server/Flutter/Unity. Perlu server statis karena ESM diblokir di `file://`.

## Struktur
```
index.html              entry + mount point
assets/styles/          theme, layout, game CSS
src/core/               rng, domino model, event emitter
src/engine/             gaple.js, qiuqiu.js (state machines murni)
src/ai/bots.js          bot heuristik
src/tournament/         bracket single-elimination
src/ui/                 lobby, table (gaple), qiuqiu, tournament
src/store/storage.js    localStorage (profil, turnamen)
src/main.js             router view
```

## Cara Main
- **Gaple**: klik tile yang menyala (legal), lalu **Mainkan**. Jika bisa ke dua ujung, pilih kiri/kanan. Tidak ada langkah → **Pass**.
- **QiuQiu**: **Buka Kartu** untuk reveal & tentukan pemenang pot.
- **Turnamen**: mulai turnamen, mainkan match-mu; match bot lain disimulasikan otomatis.
