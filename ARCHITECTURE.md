# Domino Island — Arsitektur MVP (Production-Ready Blueprint)

> Dokumen ini ditulis dari sudut pandang Senior Software Architect / Lead Web Game Developer / System Engineer. Ia memisahkan dua lapisan:
> 1. **MVP Lokal (yang dibangun sekarang)** — stack web vanilla, zero-install, bisa langsung dimainkan di browser.
> 2. **Target Produksi (roadmap)** — Flutter Web / Unity WebGL cross-play + backend realtime multiplayer.

---

## 1. Ringkasan Produk

| Aspek | Spesifikasi |
|---|---|
| Nama | Domino Island |
| Genre | Casual board game |
| Platform | Web browser (desktop & mobile) — target cross-play Flutter Web / Unity WebGL |
| Mode utama | **Gaple** (Domino Block/Draw) dan **QiuQiu** (Kiu-Kiu / Domino 99) |
| Pemain per meja | 4 |
| Fitur tambahan | Mode turnamen (bracket), UI web responsif, tampilan colorful & interaktif |
| Batasan MVP | Tanpa fitur AI/LLM dulu. Semua lawan menggunakan **bot heuristik** deterministik. Berjalan di lokal. |

---

## 2. Prinsip Arsitektur

1. **Pemisahan Engine vs Presentasi.** Logika aturan game (state machine) murni, tanpa DOM/UI, agar bisa dipindah ke Flutter/Unity atau dijalankan di server (authoritative) tanpa menulis ulang.
2. **Deterministik & dapat diuji.** RNG di-seed; pengocokan kartu reproducible untuk testing & anti-cheat.
3. **Server-authoritative ready.** Walau MVP jalan client-side, bentuk state & aksi dirancang seolah akan divalidasi server (mencegah cheat di produksi).
4. **Event-driven.** Engine memancarkan event (`tile_played`, `turn_changed`, `round_over`) yang dikonsumsi UI maupun (nanti) network layer.
5. **Responsive-first.** Layout CSS fluid + breakpoint; kontrol sentuh dan mouse diperlakukan setara.

---

## 3. MVP Lokal — Stack & Struktur

### 3.1 Stack
- **HTML5 + CSS3 (custom properties, grid/flex, animasi)** — tanpa framework agar zero-install.
- **JavaScript ES Modules (vanilla)** — engine, bot, UI controller.
- **Server statis** untuk menyajikan ESM (`python -m http.server` atau `npx serve`). Tidak ada build step.
- **State persistence**: `localStorage` (profil pemain, progres turnamen, pengaturan).

### 3.2 Struktur Direktori
```
website-domino/
├── ARCHITECTURE.md          # dokumen ini
├── README.md                # cara menjalankan
├── index.html               # entry (lobby + mount point)
├── assets/
│   └── styles/
│       ├── theme.css        # token warna, tipografi, variabel
│       ├── layout.css       # layout responsif & komponen
│       └── game.css         # meja, kartu domino, animasi
└── src/
    ├── main.js              # bootstrap aplikasi, router view
    ├── core/
    │   ├── rng.js           # RNG ber-seed (mulberry32)
    │   ├── domino.js        # representasi tile, deck, util
    │   └── events.js        # mini event emitter
    ├── engine/
    │   ├── gaple.js         # state machine Gaple
    │   └── qiuqiu.js        # state machine QiuQiu
    ├── ai/
    │   └── bots.js          # bot heuristik (bukan AI/LLM)
    ├── tournament/
    │   └── bracket.js       # single-elimination bracket
    ├── ui/
    │   ├── components.js    # render tile, pemain, HUD
    │   ├── table.js         # view meja permainan
    │   ├── lobby.js         # view lobby/mode select
    │   └── tournamentView.js# view bracket turnamen
    └── store/
        └── storage.js       # wrapper localStorage
```

### 3.3 Diagram Modul (MVP)
```
          +------------------+        events        +----------------+
          |   UI Controller  | <------------------- |  Game Engine   |
          | (table/lobby)    | --- actions -------> | (gaple/qiuqiu) |
          +------------------+                      +----------------+
                   |                                        |
                   | render                                 | uses
                   v                                        v
          +------------------+                      +----------------+
          |   DOM / CSS      |                      | core (rng,     |
          | responsive UI    |                      | domino, events)|
          +------------------+                      +----------------+
                   ^                                        ^
                   |                                        |
          +------------------+                      +----------------+
          | Tournament View  |                      | Bots (heuristic)|
          +------------------+                      +----------------+
```

---

## 4. Domain Model

### 4.1 Tile Domino
Standar double-six (0–6). Set lengkap = 28 tile. Direpresentasikan `{a, b}` dengan `a <= b`.
- `isDouble = a === b`
- `pipSum = a + b`
- `id = "a-b"`

### 4.2 State Permainan (bentuk umum)
```jsonc
{
  "mode": "gaple" | "qiuqiu",
  "seed": 123456,
  "players": [
    { "id": "p0", "name": "You", "isBot": false, "hand": [], "score": 0, "chips": 0 }
  ],
  "turn": 0,
  "phase": "dealing" | "playing" | "round_over" | "match_over",
  "board": {            // khusus gaple
    "line": [ {"a":3,"b":5} ],
    "leftEnd": 3, "rightEnd": 5
  },
  "boneyard": [],       // tile sisa (draw variant)
  "winner": null,
  "log": []
}
```

### 4.3 Aturan Ringkas

**Gaple (Block/Draw):**
- 4 pemain, masing-masing 7 tile (28 tile dibagi 4 = 7).
- Pembuka: pemegang double tertinggi (atau tile terbesar jika tak ada double).
- Giliran berputar; mainkan tile yang cocok di salah satu ujung rantai.
- Tidak bisa jalan → pass (varian block) atau tarik dari boneyard (varian draw).
- Ronde berakhir bila ada pemain menghabiskan tile ("domino") atau buntu (semua pass).
- Skor buntu/kalah = jumlah pip di tangan; pemenang ronde adalah pip terendah / yang habis.

**QiuQiu (Kiu-Kiu / Domino 99):**
- 4 pemain, masing-masing dibagi kartu domino (2 lalu bisa tambah ke 4 — di MVP disederhanakan ke 4 kartu dibandingkan nilai).
- Nilai per pasangan = `(pipSum) mod 10`; nilai tangan dari dua pasangan.
- Kombinasi spesial (Balak/6 Dewa, dll.) dinilai; pemenang nilai tertinggi.
- Taruhan chip; MVP memakai chip virtual tanpa uang nyata.

### 4.4 Mode Turnamen
- **Single-elimination bracket** untuk 4 atau 8 peserta (manusia + bot).
- Tiap match = 1 meja; pemenang maju. Progres disimpan di `localStorage`.
- State bracket: daftar ronde → daftar match → `{playerA, playerB, winner}`.

---

## 5. Alur Interaksi (contoh: main satu tile Gaple)
```
User klik tile  ->  UI.validate(local)  ->  Engine.applyAction({type:'play', tile, end})
      -> Engine mutasi state + emit 'tile_played','turn_changed'
      -> UI re-render papan & tangan, animasikan tile
      -> jika giliran bot: Bot.decide(state) -> Engine.applyAction(...) (loop)
      -> cek kondisi akhir ronde -> emit 'round_over' -> UI tampilkan skor
```

---

## 6. Target Produksi (Roadmap, di luar MVP lokal)

### 6.1 Arsitektur Multiplayer Server-Authoritative
```
   Browser (Flutter Web / Unity WebGL)         Backend
   +-----------------------------+     WSS     +---------------------------+
   | Presentation + Input        | <---------> | Realtime Gateway (WS)     |
   | Client-side prediction       |            |  - room/table manager     |
   +-----------------------------+             |  - authoritative engine   |
                                               |  - matchmaking            |
                                               +------------+--------------+
                                                            |
                                       +--------------------+--------------------+
                                       |                    |                    |
                                  +----v----+        +------v------+       +-----v-----+
                                  | Session |        | Game State  |       | Persistence|
                                  | (Redis) |        | (in-memory) |       | (Postgres) |
                                  +---------+        +-------------+       +-----------+
```
- **Realtime transport:** WebSocket (atau Colyseus/Nakama/SpacetimeDB) untuk room & sinkronisasi state.
- **Authoritative engine:** engine yang sama (Dart/C#/JS) berjalan di server; client hanya mengirim intent, server memvalidasi → anti-cheat.
- **Matchmaking & lobby:** antrian berbasis skill/ELO, pembuatan meja 4 kursi.
- **Persistence:** Postgres (akun, chip, riwayat, bracket turnamen), Redis (session, presence, leaderboard).
- **Observability:** metrics (Prometheus/Grafana), structured logging, tracing.
- **Skalabilitas:** stateless gateway + sticky room sharding; horizontal scale per region.

### 6.2 Cross-Play Flutter Web / Unity WebGL
- **Kontrak bersama:** protokol pesan JSON/Protobuf identik untuk kedua client.
- **Shared ruleset:** spesifikasi aturan sebagai single source of truth (dok + test vectors) agar engine Dart (Flutter) dan C# (Unity) menghasilkan hasil identik dengan engine referensi JS MVP.
- **Asset pipeline:** sprite/atlas domino & tema warna dibagikan lintas client.

### 6.3 Migrasi dari MVP
1. Engine JS MVP jadi **referensi perilaku** + sumber test vector.
2. Port engine ke server (Node/TS) sebagai authoritative, atau reuse JS engine di Node.
3. Tambahkan network layer; UI MVP tetap jadi web client ringan.
4. Bangun client Flutter/Unity memakai protokol yang sama.

---

## 7. Keamanan & Fair-Play (produksi)
- Server-authoritative: client tak pernah dipercaya untuk hasil kocokan/validasi.
- RNG ber-seed di server; seed tak dibagikan ke client sampai akhir ronde (audit).
- Rate limiting & input validation di gateway.
- Chip virtual saja (tanpa uang nyata) untuk menghindari isu regulasi perjudian.

## 8. Pengujian
- **Unit test engine:** state transition Gaple/QiuQiu, scoring, kondisi menang/buntu.
- **Property/deterministic test:** seed sama → hasil sama.
- **Bot sanity:** bot selalu memilih aksi legal; tidak pernah menghasilkan state ilegal.
- **UI smoke:** render lobby, mulai meja, mainkan ronde penuh vs bot.

## 9. Definition of Done (MVP Lokal)
- [x] Bisa dijalankan di lokal tanpa build step.
- [x] Mode Gaple 4 pemain (1 manusia + 3 bot) dapat dimainkan sampai selesai ronde & match.
- [x] Mode QiuQiu 4 pemain dapat dimainkan satu ronde dengan scoring.
- [x] Mode turnamen single-elimination berjalan dengan bracket tersimpan.
- [x] UI responsif desktop & mobile, colorful, dengan animasi tile.
