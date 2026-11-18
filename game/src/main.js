// main.js — the game itself: it builds the world, runs the loop, and owns
// the state machine (menu, playing, paused, busted, wasted). Every other
// module plugs into the one game object this file creates.
import { WORLD_W, WORLD_H, CLOCK_START, CLOCK_RATE, CAR_TYPES } from './config.js';
import { buildWorld, LANDMARKS } from './world.js';
import { createAudio, initAudio, setMuted, updateEngine, updateSiren, sfx } from './audio.js';
import { createInput, endFrame, wasPressed, down } from './input.js';
import { createEffects, updateEffects } from './effects.js';
import { createPlayer, updatePlayer, damagePlayer, starsOf } from './player.js';
import { spawnTraffic, spawnPedestrians, updateTraffic, createCar } from './traffic.js';
import { updatePolice } from './police.js';
import { createMissions, updateMissions, tryStartMission, missionObjective, MISSIONS } from './missions.js';
import { createCamera, updateCamera, render } from './render.js';
import { createHud, updateHud, showToast, showPrompt } from './hud.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function createGame() {
  const game = {
    ctx,
    time: 0,
    clock: CLOCK_START,
    state: 'menu', // menu | playing | paused | busted | wasted
    world: buildWorld(),
    player: createPlayer(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y - 60),
    cars: [],
    peds: [],
    pickups: [],
    missions: createMissions(),
    fx: createEffects(),
    audio: createAudio(),
    camera: null,
    hud: null,
    input: null,
    bullet: null,
    muted: false,
  };
  game.camera = createCamera(canvas.width, canvas.height);
  game.input = createInput(canvas);
  game.hud = createHud();
  game.screenToWorld = (sx, sy) => ({ x: sx + game.camera.x, y: sy + game.camera.y });
  game.toast = (text, seconds) => showToast(game.hud, text, seconds);
  game.save = () => saveGame(game);
  game.missionObjective = () => missionObjective(game);
  spawnTraffic(game);
  spawnPedestrians(game);
  spawnPickups(game);
  return game;
}

function spawnPickups(game) {
  // Health, ammo and cash in fixed spots around the city, plus a few random ones.
  const spots = [
    { x: 700, y: 950, kind: 'health' },
    { x: 1900, y: 2000, kind: 'ammo' },
    { x: 1100, y: 600, kind: 'cash', value: 100 },
    { x: 2700, y: 1300, kind: 'health' },
    { x: 300, y: 1650, kind: 'ammo' },
    { x: 2300, y: 250, kind: 'cash', value: 150 },
    { x: 1500, y: 2350, kind: 'health' },
    { x: 3100, y: 950, kind: 'cash', value: 200 },
  ];
  for (const s of spots) game.pickups.push({ ...s });
  for (let i = 0; i < 8; i++) {
    const kind = ['health', 'ammo', 'cash'][Math.floor(Math.random() * 3)];
    game.pickups.push({
      x: 150 + Math.random() * (WORLD_W - 300),
      y: 150 + Math.random() * (WORLD_H - 700),
      kind,
      value: kind === 'cash' ? 50 + Math.floor(Math.random() * 100) : 0,
    });
  }
}

// Scene presets for screenshots and testing (?scene=cover&autostart=1).
// They set up a moment of the game — a chase, a mission — and let it play.
function applyScene(game, scene) {
  const p = game.player;
  if (scene === 'cover') {
    // Driving a sports car through downtown, mission one under way.
    const car = createCar(1500, 950, 0, 'sports', 'player');
    car.color = '#b3402e';
    car.speed = 300;
    game.cars.push(car);
    p.onFoot = false;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.money = 1250;
    game.missions.state = 'active';
    game.missions.index = 0;
    game.missions.step = 1;
    game.missions.target = { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: 'Garage' };
  } else if (scene === 'chase') {
    // Three stars, police in pursuit, the player fleeing downtown.
    const car = createCar(1900, 1300, -Math.PI / 2, 'sedan', 'player');
    car.color = '#2e6db3';
    car.speed = 380;
    game.cars.push(car);
    p.onFoot = false;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.heat = 300;
    p.wanted = 3;
    p.money = 850;
    for (let i = 0; i < 3; i++) {
      const cop = createCar(car.x + 120 + i * 90, car.y + 160 + i * 60, -Math.PI / 2, 'police', 'police');
      cop.speed = 360;
      game.cars.push(cop);
    }
  } else if (scene === 'mission') {
    // Mission four: collecting packages, on foot by the plaza.
    p.x = LANDMARKS.plaza.x + 40;
    p.y = LANDMARKS.plaza.y + 30;
    p.money = 2100;
    game.missions.state = 'active';
    game.missions.index = 3;
    game.missions.step = 0;
    game.missions.timer = 142;
    game.missions.collected = 1;
    game.missions.packages = [
      { x: 300, y: 250, got: true },
      { x: LANDMARKS.plaza.x + 180, y: LANDMARKS.plaza.y - 60, got: false },
      { x: 700, y: 2000, got: false },
    ];
    game.missions.target = { x: LANDMARKS.plaza.x + 180, y: LANDMARKS.plaza.y - 60, label: 'Package 2 of 3' };
  } else if (scene === 'city') {
    // On foot at the beach, the city behind and the sea ahead.
    p.x = 1500;
    p.y = 2380;
    p.angle = Math.PI / 2;
    p.money = 3400;
    game.missions.index = 5;
    game.missions.completed = 5;
    game.missions.storyDone = true;
  }
}

function startPlaying(game, fromSave) {
  if (fromSave) {
    const data = loadSave();
    if (data) {
      const p = game.player;
      p.x = data.x;
      p.y = data.y;
      p.health = data.health;
      p.money = data.money;
      p.ammo = data.ammo;
      game.missions.index = Math.min(data.missionIndex || 0, MISSIONS.length);
      game.missions.completed = data.completed || 0;
      game.clock = data.clock || CLOCK_START;
      game.toast('Welcome back to Porto Lumen.');
    }
  } else {
    clearSave();
  }
  game.state = 'playing';
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  initAudio(game.audio);
  game.camera.x = game.player.x - game.camera.viewW / 2;
  game.camera.y = game.player.y - game.camera.viewH / 2;
  if (!fromSave) game.toast('Welcome to Porto Lumen. Drive to Vera\'s Garage (yellow V) and press Enter to start your first job.', 6);
}

function showGameOver(game, kind) {
  game.state = kind; // 'busted' or 'wasted'
  const over = document.getElementById('gameover');
  document.getElementById('gameover-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('gameover-text').textContent =
    kind === 'busted'
      ? 'The police caught up with you. You lose $200 bail and your wanted level clears.'
      : 'You didn\'t make it. The hospital patches you up — for $200.';
  over.classList.remove('hidden');
}

function respawn(game) {
  const p = game.player;
  p.dead = false;
  p.busted = false;
  p.bust = 0;
  p.health = 100;
  p.money = Math.max(0, p.money - 200);
  p.heat = 0;
  p.wanted = 0;
  p.onFoot = true;
  p.car = null;
  if (game.state === 'busted') {
    p.x = LANDMARKS.safehouse.x;
    p.y = LANDMARKS.safehouse.y - 60;
  } else {
    p.x = LANDMARKS.hospital.x;
    p.y = LANDMARKS.hospital.y + 60;
  }
  // The police give up the chase.
  game.cars = game.cars.filter((c) => c.driver !== 'police');
  game.state = 'playing';
  document.getElementById('gameover').classList.add('hidden');
  game.toast('Back on your feet. The city is still yours to take.');
}

function update(game, dt) {
  game.time += dt;
  game.clock += CLOCK_RATE * dt;
  if (game.bullet) {
    game.bullet.life -= dt;
    if (game.bullet.life <= 0) game.bullet = null;
  }
  updatePlayer(game, dt);
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  updateEffects(game.fx, dt);
  updateCamera(game, dt);
  updateHud(game, dt);
  // The engine hum follows the player's car; the siren wails when police are near.
  const driving = !game.player.onFoot && game.player.car;
  updateEngine(game.audio, driving ? game.player.car.speed : 0, driving);
  const copNear = game.cars.some((c) => c.driver === 'police' && !c.wrecked && Math.hypot(c.x - game.player.x, c.y - game.player.y) < 600);
  updateSiren(game.audio, copNear, dt);
  // The hospital heals a player who stands in it.
  const p = game.player;
  if (Math.hypot(p.x - LANDMARKS.hospital.x, p.y - LANDMARKS.hospital.y) < LANDMARKS.hospital.radius) {
    p.health = Math.min(100, p.health + 12 * dt);
  }
  // The safehouse saves the game.
  if (Math.hypot(p.x - LANDMARKS.safehouse.x, p.y - LANDMARKS.safehouse.y) < LANDMARKS.safehouse.radius) {
    game.save();
  }
  // Prompts: start a mission at the garage, buy ammo at the gun shop.
  const m = game.missions;
  let prompt = null;
  if (m.state === 'idle' && m.index < MISSIONS.length && Math.hypot(p.x - LANDMARKS.garage.x, p.y - LANDMARKS.garage.y) < LANDMARKS.garage.radius + 20) {
    prompt = 'Press ENTER to start: ' + MISSIONS[m.index].title + ' ($' + MISSIONS[m.index].reward + ')';
    if (wasPressed(game.input, 'Enter')) tryStartMission(game);
  } else if (Math.hypot(p.x - LANDMARKS.gunshop.x, p.y - LANDMARKS.gunshop.y) < LANDMARKS.gunshop.radius && p.onFoot) {
    prompt = 'Press B to buy ammo — $40 for 24 rounds';
    if (wasPressed(game.input, 'KeyB') && p.money >= 40) {
      p.money -= 40;
      p.ammo += 24;
      sfx.cash(game.audio);
      game.toast('Ammo bought: +24 rounds.');
    }
  }
  showPrompt(game.hud, prompt);
  // Death and arrest end the run.
  if (p.dead && game.state === 'playing') showGameOver(game, 'wasted');
  if (p.busted && game.state === 'playing') showGameOver(game, 'busted');
}

function loop(game, last) {
  const now = performance.now();
  let dt = (now - last) / 1000;
  if (dt > 0.05) dt = 0.05; // a stalled frame never jumps the game forward
  // Global keys, whatever the state.
  if (wasPressed(game.input, 'KeyM')) {
    game.muted = !game.muted;
    setMuted(game.audio, game.muted);
  }
  if (game.state === 'playing') {
    if (wasPressed(game.input, 'Escape') || wasPressed(game.input, 'KeyP')) {
      game.state = 'paused';
      document.getElementById('pause').classList.remove('hidden');
      sfx.click(game.audio);
    } else {
      update(game, dt);
    }
  } else if (game.state === 'paused') {
    if (wasPressed(game.input, 'Escape') || wasPressed(game.input, 'KeyP')) {
      game.state = 'playing';
      document.getElementById('pause').classList.add('hidden');
    }
  } else if (game.state === 'menu') {
    // The menu shows the city behind it: drift the camera slowly.
    game.time += dt;
    game.camera.x = 1200 + Math.sin(game.time * 0.05) * 300;
    game.camera.y = 900 + Math.cos(game.time * 0.04) * 200;
  }
  render(game);
  endFrame(game.input);
  requestAnimationFrame(() => loop(game, now));
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function wireMenus(game) {
  const newGame = document.getElementById('btn-new');
  const cont = document.getElementById('btn-continue');
  const resume = document.getElementById('btn-resume');
  const quit = document.getElementById('btn-quit');
  const restart = document.getElementById('btn-restart');
  const retry = document.getElementById('btn-retry');
  const toMenu = document.getElementById('btn-menu');
  const muteBtn = document.getElementById('btn-mute');
  if (hasSave()) cont.classList.remove('hidden');
  newGame.addEventListener('click', () => {
    sfx.click(game.audio);
    startPlaying(game, false);
  });
  cont.addEventListener('click', () => {
    sfx.click(game.audio);
    startPlaying(game, true);
  });
  resume.addEventListener('click', () => {
    game.state = 'playing';
    document.getElementById('pause').classList.add('hidden');
    sfx.click(game.audio);
  });
  quit.addEventListener('click', () => {
    game.save();
    location.reload();
  });
  restart.addEventListener('click', () => {
    clearSave();
    location.reload();
  });
  retry.addEventListener('click', () => {
    sfx.click(game.audio);
    respawn(game);
  });
  toMenu.addEventListener('click', () => location.reload());
  muteBtn.addEventListener('click', () => {
    game.muted = !game.muted;
    setMuted(game.audio, game.muted);
    muteBtn.textContent = game.muted ? 'Unmute (M)' : 'Mute (M)';
  });
}

// Boot.
resize();
window.addEventListener('resize', () => {
  resize();
  game.camera.viewW = canvas.width;
  game.camera.viewH = canvas.height;
});
const game = createGame();
wireMenus(game);
// Scene presets (?scene=chase) and autostart (?autostart=1) are for screenshots
// and testing: they set up a moment of the game and skip the menu.
const params = new URLSearchParams(location.search);
const scene = params.get('scene');
if (scene) applyScene(game, scene);
if (params.get('autostart') === '1') {
  game.state = 'playing';
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  initAudio(game.audio);
  game.camera.x = game.player.x - game.camera.viewW / 2;
  game.camera.y = game.player.y - game.camera.viewH / 2;
}
requestAnimationFrame(() => loop(game, performance.now()));
