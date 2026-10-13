// Lobby view: profile, mode selection cards.
import { getProfile, saveProfile } from '../store/storage.js';

export function mountLobby(root, { onSelectMode } = {}) {
  const profile = getProfile();

  root.innerHTML = `
    <div class="lobby">
      <header class="lobby-header">
        <div class="brand">
          <div class="logo">🁣</div>
          <div>
            <h1>Domino <span>Island</span></h1>
            <p class="tagline">Casual board game · Gaple & QiuQiu</p>
          </div>
        </div>
        <div class="profile-chip">
          <input id="nameInput" class="name-input" value="${profile.name}" maxlength="14" />
          <div class="chips">💰 ${profile.chips}</div>
        </div>
      </header>

      <section class="mode-grid">
        <button class="mode-card gaple" data-mode="gaple">
          <div class="mode-emoji">🀱</div>
          <h2>Gaple</h2>
          <p>Domino klasik 4 pemain. Habiskan kartu, kunci lawan.</p>
          <span class="play-cta">Main →</span>
        </button>
        <button class="mode-card qiuqiu" data-mode="qiuqiu">
          <div class="mode-emoji">🎴</div>
          <h2>QiuQiu</h2>
          <p>Kiu-Kiu / Domino 99. Nilai tertinggi menang pot.</p>
          <span class="play-cta">Main →</span>
        </button>
        <button class="mode-card tourney" data-mode="tournament">
          <div class="mode-emoji">🏆</div>
          <h2>Turnamen</h2>
          <p>Single-elimination 8 peserta. Jadilah juara pulau.</p>
          <span class="play-cta">Masuk →</span>
        </button>
      </section>

      <footer class="lobby-footer">
        <span>MVP lokal · tanpa AI · bot heuristik · chip virtual</span>
      </footer>
    </div>`;

  const nameInput = root.querySelector('#nameInput');
  nameInput.addEventListener('change', () => {
    profile.name = nameInput.value.trim() || 'Pemain';
    saveProfile(profile);
  });

  root.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      profile.name = nameInput.value.trim() || 'Pemain';
      saveProfile(profile);
      onSelectMode && onSelectMode(card.dataset.mode, profile);
    });
  });

  return { destroy: () => (root.innerHTML = '') };
}
