// App bootstrap + simple view router.
import { mountLobby } from './ui/lobby.js';
import { mountGapleTable } from './ui/table.js';
import { mountQiuQiuTable } from './ui/qiuqiuView.js';
import { mountTournamentView } from './ui/tournamentView.js';

const app = document.getElementById('app');
let current = null;

function clear() {
  if (current && current.destroy) current.destroy();
  app.innerHTML = '';
  current = null;
}

function goLobby() {
  clear();
  current = mountLobby(app, {
    onSelectMode: (mode, profile) => {
      if (mode === 'gaple') goGaple(profile);
      else if (mode === 'qiuqiu') goQiuQiu(profile);
      else if (mode === 'tournament') goTournament(profile);
    },
  });
}

function goGaple(profile) {
  clear();
  const players = [
    { id: 'you', name: profile.name || 'Kamu', isBot: false },
    { id: 'b1', name: 'Budi', isBot: true },
    { id: 'b2', name: 'Sari', isBot: true },
    { id: 'b3', name: 'Andi', isBot: true },
  ];
  current = mountGapleTable(app, { players, onExit: goLobby });
}

function goQiuQiu(profile) {
  clear();
  const players = [
    { id: 'you', name: profile.name || 'Kamu', isBot: false, chips: profile.chips },
    { id: 'b1', name: 'Budi', isBot: true },
    { id: 'b2', name: 'Sari', isBot: true },
    { id: 'b3', name: 'Andi', isBot: true },
  ];
  current = mountQiuQiuTable(app, { players, onExit: goLobby });
}

function goTournament(profile) {
  clear();
  current = mountTournamentView(app, {
    profile,
    onExit: goLobby,
    onPlayMatch: ({ tablePlayers, onResult }) => {
      clear();
      current = mountGapleTable(app, {
        players: tablePlayers,
        onExit: () => goTournament(profile),
        onMatchOver: (winnerIdx) => {
          const humanWon = winnerIdx === 0;
          onResult(humanWon);
          goTournament(profile);
        },
      });
    },
  });
}

goLobby();
