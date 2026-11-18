// The game's whole state in one place, built fresh by createState: the city, the player, the
// cars and people on the streets, the pickups, the story, the wanted level, the clock and the
// sound. main.js builds one for a real game; shots.js builds one for each screenshot scene.
// Nothing here draws or reads input; it only assembles the world.
import { createRandom } from './random.js';
import { createCity } from './world.js';
import { createPlayer } from './player.js';
import { createMissions } from './missions.js';
import { spawnTraffic } from './vehicles.js';
import { spawnPeds } from './peds.js';
import { spawnPickups } from './combat.js';
import { createAudio } from './audio.js';

/** A fresh game at the given seed: the city, the streets full, the story at its first job. */
export function createState(seed) {
  const state = {
    random: createRandom(seed),
    city: createCity(),
    time: 0,
    // The day starts at 08:00; an in-game hour passes every two real minutes.
    clock: 8 * 3600,
    player: createPlayer(),
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    missions: createMissions(),
    wanted: 0,
    wantedTimer: 0,
    bustTimer: 0,
    lastCrime: '',
    message: '',
    messageTimer: 0,
    shake: 0,
    audio: createAudio(),
  };
  spawnTraffic(state);
  spawnPeds(state);
  spawnPickups(state);
  return state;
}
