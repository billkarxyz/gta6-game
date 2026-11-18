// Saving: the player's place in the story, kept in localStorage between visits. What is saved
// is small on purpose — position, health, money, ammo, the job and stage, the wanted level and
// the clock — so a save is a few hundred bytes and loads in a blink. Traffic, pedestrians and
// police are rebuilt fresh on load: the city is always alive again.
import { SAVE_KEY } from './config.js';

/** Save the game's state; silent when storage is off (a private window). */
export function saveGame(state) {
  try {
    const player = state.player;
    const data = {
      version: 1,
      x: Math.round(player.x),
      y: Math.round(player.y),
      health: Math.round(player.health),
      money: player.money,
      ammo: player.ammo,
      missionIndex: state.missions.index,
      missionStage: state.missions.stage,
      missionCollected: state.missions.collected,
      wanted: state.wanted,
      clock: Math.round(state.clock),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Load a save, or null when there is none or it does not parse. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

/** True when a save exists to continue from. */
export function hasSave() {
  return loadGame() !== null;
}

/** Apply a loaded save to a fresh state: the player, the money, the job, the clock. */
export function applySave(state, data) {
  const player = state.player;
  player.x = data.x;
  player.y = data.y;
  player.health = data.health;
  player.money = data.money;
  player.ammo = data.ammo;
  state.missions.index = data.missionIndex;
  state.missions.stage = data.missionStage;
  state.missions.collected = data.missionCollected;
  state.missions.started = false;
  state.wanted = data.wanted;
  state.clock = data.clock;
}
