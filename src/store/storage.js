// localStorage wrapper for profile, settings, and tournament progress.
const KEY = 'domino-island:v1';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export const store = {
  get(key, fallback = null) {
    const all = readAll();
    return key in all ? all[key] : fallback;
  },
  set(key, value) {
    const all = readAll();
    all[key] = value;
    writeAll(all);
  },
  remove(key) {
    const all = readAll();
    delete all[key];
    writeAll(all);
  },
};

export function getProfile() {
  let p = store.get('profile');
  if (!p) {
    p = { name: 'Pemain', chips: 1000, wins: 0, created: Date.now() };
    store.set('profile', p);
  }
  return p;
}

export function saveProfile(p) {
  store.set('profile', p);
}
