// save.js — the game saves to localStorage: the player's position, money,
// health, mission progress and the clock. The start screen offers to
// continue from the save, and the game saves on every mission completion
// and whenever the player reaches the safehouse.
const KEY = 'porto-lumen-save-v1';

export function saveGame(game) {
  const p = game.player;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      x: p.x,
      y: p.y,
      health: p.health,
      money: p.money,
      ammo: p.ammo,
      missionIndex: game.missions.index,
      completed: game.missions.completed,
      clock: game.clock,
      savedAt: Date.now(),
    }));
  } catch (e) {
    // Storage may be unavailable (private mode); the game plays on without it.
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.x !== 'number' || typeof data.money !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // Ignore: nothing to clear.
  }
}
