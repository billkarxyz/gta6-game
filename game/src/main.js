// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, over (dead or busted) and complete (the story
// done, shown once). Progress saves to localStorage when a job ends and when the player asks.
//
// ?shot=cover|chase|mission|city (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { PLACES, PLAYER, STEP } from './config.js';
import { createState } from './state.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { enterOrExitCar, updatePlayer } from './player.js';
import { updateTraffic } from './vehicles.js';
import { updatePeds } from './peds.js';
import { updatePolice } from './police.js';
import { shoot, updateBullets, updatePickups } from './combat.js';
import { updateEffects } from './effects.js';
import { missionTarget, updateMissions } from './missions.js';
import { applySave, hasSave, loadGame, saveGame } from './save.js';
import { stageShot } from './shots.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Game seconds per real second: an in-game hour passes every two real minutes. */
const CLOCK_RATE = 30;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);

/** The mouse position in world coordinates, for aiming on foot. */
function aimPoint(state, input) {
  const view = renderer.view;
  const ratio = view.ratio || 1;
  const x = renderer.camera.x + (input.mouse.x - view.width / 2) * (ratio / view.scale);
  const y = renderer.camera.y + (input.mouse.y - view.height / 2) * (ratio / view.scale);
  return { x, y };
}

function runShot(name) {
  const state = stageShot(name, seed);
  const target = missionTarget(state.missions);
  // Centre the camera on the player at once: a screenshot has no time to pan.
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  renderer.updateCamera(state, 0.5);
  let painted = 0;
  function paint() {
    renderer.draw(state, target);
    hud.drawHud(state, target);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = createState(seed);
  let screen = SCREEN_TITLE;
  let lastMissionIndex = 0;
  let lastComplete = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    state = createState(Math.floor(Math.random() * 4294967296));
    lastMissionIndex = 0;
    lastComplete = false;
    screen = SCREEN_PLAY;
    state.audio.unlock();
    announce('Playing. ' + state.player.money + ' dollars, first job: First Wheels.');
  }

  function continueGame() {
    const data = loadGame();
    state = createState(Math.floor(Math.random() * 4294967296));
    if (data) applySave(state, data);
    lastMissionIndex = state.missions.index;
    lastComplete = state.missions.complete;
    screen = SCREEN_PLAY;
    state.audio.unlock();
    announce('Continuing. Job ' + (state.missions.index + 1) + ' of 5.');
  }

  /** Retry the current job from its first stage, at the garage, cleaned up. */
  function retryJob() {
    const missions = state.missions;
    missions.stage = 0;
    missions.collected = 0;
    missions.started = false;
    missions.failed = false;
    missions.banner = '';
    missions.bannerTimer = 0;
    state.wanted = 0;
    state.bustTimer = 0;
    state.player.dead = false;
    state.player.busted = false;
    state.player.health = PLAYER.maxHealth;
    state.player.car = null;
    state.player.x = PLACES.garage.x;
    state.player.y = PLACES.garage.y + 80;
    state.player.money = Math.max(0, state.player.money - 100);
    screen = SCREEN_PLAY;
    announce('Retrying the job.');
  }

  function step() {
    state.time += STEP;
    state.clock += STEP * CLOCK_RATE;
    const aim = aimPoint(state, input);
    updatePlayer(state, STEP, input, aim.x, aim.y);
    updateTraffic(state, STEP);
    updatePeds(state, STEP);
    const policeNear = updatePolice(state, STEP);
    updateBullets(state, STEP);
    updatePickups(state, STEP);
    updateMissions(state, STEP);
    updateEffects(state, STEP);
    if (state.messageTimer > 0) state.messageTimer -= STEP;
    // Sound follows the world: the engine, and a siren when the law is near.
    state.audio.engine(state.player.car ? Math.min(1, Math.abs(state.player.car.speed) / 600) : 0);
    state.audio.siren(policeNear, STEP);
    // A finished job saves the game; a finished story shows the complete screen once.
    if (state.missions.index !== lastMissionIndex) {
      lastMissionIndex = state.missions.index;
      saveGame(state);
    }
    if (state.missions.complete && !lastComplete) {
      lastComplete = true;
      screen = SCREEN_COMPLETE;
      saveGame(state);
    }
    if ((state.player.dead || state.player.busted) && screen === SCREEN_PLAY) {
      screen = SCREEN_OVER;
    }
    renderer.updateCamera(state, STEP);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      state.audio.setMuted(!state.audio.isMuted());
      state.message = state.audio.isMuted() ? 'Sound muted' : 'Sound on';
      state.messageTimer = 2;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        if (hasSave()) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) retryJob();
      else if (actions & ACTION_RESTART) startNewGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_ENTER) {
      enterOrExitCar(state);
    } else if (actions & ACTION_RESTART) {
      retryJob();
    }
    if (input.mouse.down && !state.player.car) shoot(state);
  }

  function handleKeys(event) {
    // N starts a new game from the title when a save exists; S saves from pause.
    if (event.code === 'KeyN' && screen === SCREEN_TITLE && hasSave()) startNewGame();
    if (event.code === 'KeyS' && screen === SCREEN_PAUSED) {
      if (saveGame(state)) {
        state.message = 'Game saved';
        state.messageTimer = 2;
      }
    }
  }
  window.addEventListener('keydown', handleKeys);

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // The title screen's backdrop is a live city: the traffic keeps moving.
      if (screen === SCREEN_TITLE) {
        state.time += 1 / 60;
        updateTraffic(state, 1 / 60);
        updatePeds(state, 1 / 60);
        updateEffects(state, 1 / 60);
        renderer.updateCamera(state, 1 / 60);
      }
    }
    const target = missionTarget(state.missions);
    renderer.draw(state, target);
    if (screen === SCREEN_TITLE) hud.drawTitle(state, hasSave());
    else if (screen === SCREEN_PAUSED) {
      hud.drawHud(state, target);
      hud.drawPaused();
    } else if (screen === SCREEN_OVER) {
      hud.drawHud(state, target);
      hud.drawOver(state);
    } else if (screen === SCREEN_COMPLETE) {
      hud.drawHud(state, target);
      hud.drawComplete(state);
    } else {
      hud.drawHud(state, target);
    }
  }

  // Leaving the tab pauses a running game and saves it, rather than letting the law close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });

  announce('Solmar, city of gold. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
