// The law: the wanted level, the police cars that chase the player, and the bust. Every crime
// adds stars (stealing a car, hitting a pedestrian, shooting, ramming a cop); the more stars,
// the more police cars hunt and the faster they drive. A cop that stays beside a slow player
// busts them. Out of every cop's sight the heat cools, one star at a time, and the Spray Shop
// clears the lot for a fee. Police cars are just cars with a chase brain: they steer at the
// player and ram, and at high wanted levels they try to cut the player off.
import { CAR, PLACES, POLICE, WANTED } from './config.js';
import { createCar, damageCar, driveCar, KIND_POLICE } from './vehicles.js';
import { nearestRoadPoint } from './world.js';
import { addSparks } from './effects.js';

/** Add stars for a crime, capped at five, and wake the police up. */
export function addWanted(state, stars, reason) {
  if (state.wanted >= WANTED.max) return;
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  state.wantedTimer = 0;
  state.lastCrime = reason;
  state.audio.sirenBlip();
}

/** Clear the wanted level entirely (the Spray Shop, or a mission that ends the heat). */
export function clearWanted(state) {
  state.wanted = 0;
  state.wantedTimer = 0;
  state.bustTimer = 0;
}

/** How many police cars should be hunting right now. */
function wantedCount(state) {
  return POLICE.chaseCount[Math.min(state.wanted, WANTED.max)];
}

/** Spawn a police car on a road near the player, facing toward them. */
function spawnPoliceCar(state) {
  const player = state.player;
  const angle = state.random() * Math.PI * 2;
  const dist = 500 + state.random() * 300;
  const point = nearestRoadPoint(player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist);
  const car = createCar(point.x, point.y, Math.atan2(player.y - point.y, player.x - point.x), KIND_POLICE, '#2f6fd0');
  car.speed = POLICE.speed * 0.6;
  state.cars.push(car);
  return car;
}

/** The police cars currently hunting (not wrecked). */
export function policeCars(state) {
  return state.cars.filter((car) => car.kind === KIND_POLICE && !car.wreck);
}

/** Drive one police car: steer at the player, ram when close, cut off at high stars. */
function chaseDrive(state, car, dt) {
  const player = state.player;
  // Aim ahead of the player when the wanted level is high, to cut them off.
  const lead = state.wanted >= 4 ? 0.6 : state.wanted >= 3 ? 0.3 : 0;
  const px = player.car ? player.car.x + player.car.vx * lead : player.x;
  const py = player.car ? player.car.y + player.car.vy * lead : player.y;
  const wantAngle = Math.atan2(py - car.y, px - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Full throttle, easing off only when about to overshoot a slow player on foot.
  let throttle = 1;
  const dist = Math.hypot(px - car.x, py - car.y);
  if (!player.car && dist < 80) throttle = 0.2;
  const impact = driveCar(state, car, throttle, steer, false, dt);
  if (impact > 200) {
    damageCar(state, car, Math.floor(impact / 30));
    if (player.car && Math.hypot(car.x - player.car.x, car.y - player.car.y) < 80) {
      damageCar(state, player.car, POLICE.ramDamage);
      addSparks(state, car.x, car.y);
    }
  }
  // A police car that rams the player on foot knocks them down hard.
  if (!player.car && dist < 40 && Math.abs(car.speed) > 100) {
    state.audio.crash();
    player.health = Math.max(0, player.health - 20);
    if (player.health === 0) player.dead = true;
  }
}

/**
 * One step of the law: spawn hunters up to the wanted level's count, drive them, check for a
 * bust, and cool the heat when the player is out of sight. Returns true while any cop is near
 * (for the siren).
 */
export function updatePolice(state, dt) {
  const player = state.player;
  if (player.dead || player.busted) return false;
  // Spawn hunters.
  const hunters = policeCars(state);
  if (hunters.length < wantedCount(state)) spawnPoliceCar(state);
  // Drive them; with no heat left, they give up and drive off.
  for (const car of hunters) {
    if (state.wanted === 0) {
      const away = Math.atan2(car.y - player.y, car.x - player.x);
      let diff = away - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      driveCar(state, car, 0.7, Math.max(-1, Math.min(1, diff * 2)), false, dt);
      if (Math.hypot(car.x - player.x, car.y - player.y) > 1200) {
        car.wreck = true;
        car.health = 0;
        const index = state.cars.indexOf(car);
        if (index !== -1) state.cars.splice(index, 1);
      }
      continue;
    }
    chaseDrive(state, car, dt);
  }
  // The bust: a cop beside a slow player for a few seconds ends the run.
  let near = false;
  for (const car of hunters) {
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < POLICE.sightRange) near = true;
    if (dist < POLICE.bustRange && player.speed < POLICE.bustSpeed) {
      state.bustTimer += dt;
      if (state.bustTimer >= POLICE.bustTime) {
        player.busted = true;
        state.audio.fail();
        return false;
      }
    }
  }
  if (hunters.length === 0 || !hunters.some((car) => Math.hypot(car.x - player.x, car.y - player.y) < POLICE.bustRange && player.speed < POLICE.bustSpeed)) {
    state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
  }
  // Cooling off: out of every cop's sight, one star drops after a while.
  if (state.wanted > 0 && !near) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= POLICE.decaySeconds) {
      state.wanted -= 1;
      state.wantedTimer = 0;
    }
  } else {
    state.wantedTimer = 0;
  }
  // The Spray Shop: drive in, pay the fee, walk out clean.
  if (state.wanted > 0 && player.car && Math.hypot(player.x - PLACES.spray.x, player.y - PLACES.spray.y) < 70) {
    if (player.money >= WANTED.sprayCost) {
      player.money -= WANTED.sprayCost;
      clearWanted(state);
      state.message = 'Fresh paint, clean record. -$' + WANTED.sprayCost;
      state.messageTimer = 3;
      state.audio.cash();
    } else {
      state.message = 'The Spray Shop wants $' + WANTED.sprayCost + ' and you are short.';
      state.messageTimer = 3;
    }
  }
  return near;
}
