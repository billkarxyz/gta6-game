// The screenshot scenes behind ?shot=cover|chase|mission|city. Each one builds a fresh game,
// puts the player in a scene the real rules produce (driving through Downtown, a police chase
// at three stars, a mission marker ahead, a busy street on foot), plays it forward with a simple
// autopilot that drives toward a target and brakes for nothing, and returns the state for the
// renderer to paint. The same seed always gives the same frame.
import { STEP } from './config.js';
import { createState } from './state.js';
import { createCar, driveCar, KIND_TRAFFIC } from './vehicles.js';
import { addWanted, updatePolice } from './police.js';
import { updateTraffic } from './vehicles.js';
import { updatePeds } from './peds.js';
import { updateBullets, updatePickups } from './combat.js';
import { updateEffects } from './effects.js';
import { startMission, updateMissions } from './missions.js';

/** Drive the player's car toward a point: throttle up, steer at it, brake when close. */
function autopilotDrive(state, target, dt) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  // Stuck recovery: if the car is barely moving while throttling, reverse out for a moment.
  if (Math.abs(car.speed) < 30) {
    state.stuckTimer = (state.stuckTimer || 0) + dt;
  } else {
    state.stuckTimer = 0;
  }
  if (state.stuckTimer > 0.8 && state.stuckTimer < 1.6) {
    driveCar(state, car, -0.8, -1, false, dt);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    return;
  }
  if (state.stuckTimer >= 1.6) state.stuckTimer = 0;
  const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.5));
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  const throttle = dist < 120 ? 0.2 : 1;
  driveCar(state, car, throttle, steer, false, dt);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
}

/** Advance the world one fixed step with the given autopilot target (or none). */
function stepWorld(state, target, dt) {
  state.time += dt;
  state.clock += dt * 30;
  if (target) autopilotDrive(state, target, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  updateMissions(state, dt);
  updateEffects(state, dt);
  if (state.messageTimer > 0) state.messageTimer -= dt;
}

/** Put the player in a fresh car at (x, y), facing angle, as a staged scene needs. */
function putPlayerInCarAt(state, x, y, angle, colour) {
  const car = createCar(x, y, angle, KIND_TRAFFIC, colour || '#e5534b');
  car.driver = false;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
}

/**
 * Stage a scene and return the state to paint. cover: driving through Downtown with the first
 * job's marker ahead. chase: three stars, police cars on the player's tail. mission: on foot at
 * the plaza, the package job's marker overhead. city: a busy street corner on foot, traffic and
 * pedestrians around. Any other name is cover.
 */
export function stageShot(name, seed) {
  const state = createState(seed);
  if (name === 'chase') {
    // Three stars, police cars on the player's tail, driving fast north along the avenue.
    putPlayerInCarAt(state, 1500, 1900, -Math.PI / 2, '#e5534b');
    addWanted(state, 3, 'staged chase');
    state.missions.index = 3;
    state.missions.stage = 0;
    state.missions.started = true;
    state.missions.banner = '';
    state.missions.bannerTimer = 0;
    for (let i = 0; i < 3 / STEP; i += 1) stepWorld(state, { x: 1500, y: 300 }, STEP);
    return state;
  }
  if (name === 'mission') {
    state.player.x = 1100;
    state.player.y = 1350;
    state.player.angle = -Math.PI / 2;
    state.missions.index = 1;
    state.missions.stage = 0;
    state.missions.started = true;
    state.missions.banner = 'The Package — a package is waiting at Solmar Plaza.';
    state.missions.bannerTimer = 30;
    for (let i = 0; i < 3 / STEP; i += 1) stepWorld(state, null, STEP);
    return state;
  }
  if (name === 'city') {
    state.player.x = 1500;
    state.player.y = 1450;
    state.player.angle = Math.PI / 2;
    state.player.money = 1250;
    for (let i = 0; i < 4 / STEP; i += 1) stepWorld(state, null, STEP);
    // No brief banner in the city shot: the streets speak for themselves.
    state.missions.banner = '';
    state.missions.bannerTimer = 0;
    return state;
  }
  // cover: the first job, driving east along the avenue toward Lena's garage.
  putPlayerInCarAt(state, 700, 1500, 0, '#e5534b');
  state.player.money = 450;
  startMission(state);
  state.missions.banner = '';
  state.missions.bannerTimer = 0;
  for (let i = 0; i < 3 / STEP; i += 1) stepWorld(state, { x: 2300, y: 1500 }, STEP);
  return state;
}
