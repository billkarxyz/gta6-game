// The player, Jax Marlow: on foot with a pistol, or behind the wheel of a stolen car. On foot
// he walks and runs with WASD and aims at the mouse; in a car he drives it with the same keys.
// E steps into the nearest car (stealing it if it has a driver, which the law notices) and
// steps out again beside it. His health, money and ammo live here too.
import { CAR, PLAYER, WANTED } from './config.js';
import { collideCircle } from './world.js';
import { damageCar, driveCar, nearestCar } from './vehicles.js';
import { addWanted } from './police.js';
import { scarePeds } from './peds.js';

/** A fresh player at the start point, on foot, with a full tank of health and a pistol. */
export function createPlayer() {
  return {
    x: PLAYER.startX,
    y: PLAYER.startY,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    money: 150,
    ammo: 48,
    car: null,
    fireCooldown: 0,
    dead: false,
    busted: false,
    speed: 0,
  };
}

/** Move the player on foot: WASD steers, Shift runs, the mouse aims. */
function moveOnFoot(state, dt, input, aimX, aimY) {
  const player = state.player;
  const move = input.move();
  const length = Math.hypot(move.x, move.y);
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (length > 0) {
    const nx = player.x + (move.x / length) * speed * dt;
    const ny = player.y + (move.y / length) * speed * dt;
    const fixed = collideCircle(state.city, nx, ny, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    player.angle = Math.atan2(move.y, move.x);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  player.aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
}

/** Drive the player's car: W/S throttle, A/D steer, Space handbrake. */
function moveInCar(state, dt, input) {
  const player = state.player;
  const car = player.car;
  const move = input.move();
  const throttle = -move.y;
  const steer = move.x;
  const impact = driveCar(state, car, throttle, steer, input.handbrake(), dt);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
  if (impact > 200) {
    state.audio.crash();
    damageCar(state, car, Math.floor(impact / 25));
  }
  if (car.wreck) {
    // The car blew up under them: they are thrown out, hurt.
    player.car = null;
    const fixed = collideCircle(state.city, car.x + 40, car.y + 40, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    damagePlayer(state, 25);
    return;
  }
  // Running over a pedestrian is a crime the police notice.
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 34 && Math.abs(car.speed) > 60) {
      state.audio.crash();
      addWanted(state, WANTED.hitPed, 'hit a pedestrian');
      scarePeds(state, car.x, car.y, PEDS_FLEE);
    }
  }
}

const PEDS_FLEE = 260;

/** Step into the nearest car, or out of the one the player is driving. */
export function enterOrExitCar(state) {
  const player = state.player;
  if (player.car) {
    // Step out beside the car, on the side away from the road's centre.
    const car = player.car;
    const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
    const nx = car.x + side.x * (CAR.width / 2 + 20);
    const ny = car.y + side.y * (CAR.width / 2 + 20);
    const fixed = collideCircle(state.city, nx, ny, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    player.car = null;
    state.audio.door();
    return;
  }
  const car = nearestCar(state, player.x, player.y, PLAYER.enterRange);
  if (!car) return;
  if (car.kind === 'police') {
    // Stealing a police car is bold: two stars, and every cop in earshot notices.
    addWanted(state, 2, 'stole a police car');
  } else if (car.driver) {
    // The driver bails out and runs; taking an occupied car is grand theft auto.
    car.driver = false;
    addWanted(state, WANTED.stealCar, 'stole a car');
    scarePeds(state, car.x, car.y, PEDS_FLEE);
  }
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  state.audio.door();
}

/** Hurt the player; at zero health the game is over. */
export function damagePlayer(state, amount) {
  const player = state.player;
  if (player.dead) return;
  player.health = Math.max(0, player.health - amount);
  if (player.health === 0) {
    player.dead = true;
    state.audio.fail();
  }
}

/** One step of the player: on foot or in a car, following the input. */
export function updatePlayer(state, dt, input, aimX, aimY) {
  const player = state.player;
  if (player.dead || player.busted) return;
  if (player.car) moveInCar(state, dt, input);
  else moveOnFoot(state, dt, input, aimX, aimY);
}
