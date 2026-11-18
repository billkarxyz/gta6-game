// police.js — the wanted system and the police who answer it. Stars come
// from the player's heat; police cars spawn at the edge of view and chase,
// ram, and try to box the player in. A stopped player near a cop gets
// busted; a player no cop can see slowly cools off.
import { CAR_TYPES, RESPRAY_COST, COP_VIEW, HEAT_RAM_COP } from './config.js';
import { LANDMARKS, collideBuildings, clampToWorld } from './world.js';
import { createCar, turnToward } from './traffic.js';
import { damageCar, damagePlayer, starsOf } from './player.js';
import { sfx } from './audio.js';

export function wantedCount(game) {
  return game.cars.filter((c) => c.driver === 'police' && !c.wrecked).length;
}

function spawnCop(game) {
  const p = game.player;
  // Appear off-screen, on a road, in the direction the player is heading.
  const angle = Math.random() * Math.PI * 2;
  const dist = 700 + Math.random() * 200;
  const x = p.x + Math.cos(angle) * dist;
  const y = p.y + Math.sin(angle) * dist;
  const clamped = clampToWorld(x, y, 30);
  const car = createCar(clamped.x, clamped.y, Math.atan2(p.y - clamped.y, p.x - clamped.x), 'police', 'police');
  car.speed = 200;
  game.cars.push(car);
}

export function updatePolice(game, dt) {
  const p = game.player;
  const stars = starsOf(p);
  p.wanted = stars;
  // Keep the right number of police on the hunt: one per star, up to five.
  const cops = game.cars.filter((c) => c.driver === 'police' && !c.wrecked);
  if (stars > 0 && cops.length < stars && Math.random() < dt * 1.2) spawnCop(game);
  // A cop that is far away and wrecked is forgotten; a cop far away gives up
  // when the player has no stars.
  for (let i = game.cars.length - 1; i >= 0; i--) {
    const c = game.cars[i];
    if (c.driver !== 'police') continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (c.wrecked && d > 900) game.cars.splice(i, 1);
    else if (stars === 0 && d > 1000) game.cars.splice(i, 1);
  }
  // Each police car chases the player and tries to ram them to a stop.
  for (const cop of game.cars) {
    if (cop.driver !== 'police' || cop.wrecked) continue;
    updateCop(game, cop, dt);
  }
  // The bust meter: stopped or slow, with a cop close by, and the law closes in.
  const playerSpeed = p.onFoot ? 0 : Math.abs(p.car ? p.car.speed : 0);
  const nearestCop = game.cars.reduce((best, c) => {
    if (c.driver !== 'police' || c.wrecked) return best;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    return d < best ? d : best;
  }, Infinity);
  if (stars > 0 && playerSpeed < 30 && nearestCop < 90) {
    p.bust += dt / 2.5;
    if (p.bust >= 1) {
      p.busted = true;
      sfx.fail(game.audio);
    }
  } else {
    p.bust = Math.max(0, p.bust - dt * 0.5);
  }
  // Cooling off: when no cop can see the player, the heat fades.
  const seen = game.cars.some((c) => c.driver === 'police' && !c.wrecked && Math.hypot(c.x - p.x, c.y - p.y) < COP_VIEW);
  if (stars > 0 && !seen) {
    p.lastSeen += dt;
    if (p.lastSeen > 8) {
      p.heat = Math.max(0, p.heat - dt * 12);
      p.wanted = starsOf(p);
    }
  } else {
    p.lastSeen = 0;
  }
  // The respray shop clears the wanted level, for a price, if no cop is near.
  if (stars > 0 && p.money >= RESPRAY_COST && !p.onFoot) {
    const rs = LANDMARKS.respray;
    if (Math.hypot(p.x - rs.x, p.y - rs.y) < rs.radius && nearestCop > 350) {
      p.money -= RESPRAY_COST;
      p.heat = 0;
      p.wanted = 0;
      if (p.car) p.car.health = CAR_TYPES[p.car.type].health;
      game.toast('Respray complete — the heat is off. -$' + RESPRAY_COST);
      sfx.cash(game.audio);
    }
  }
}

function updateCop(game, cop, dt) {
  const p = game.player;
  const type = CAR_TYPES.police;
  // Aim slightly ahead of the player, so the chase cuts corners.
  const px = p.x + (p.car ? Math.cos(p.car.angle) * Math.abs(p.car.speed) * 0.25 : 0);
  const py = p.y + (p.car ? Math.sin(p.car.angle) * Math.abs(p.car.speed) * 0.25 : 0);
  const wantAngle = Math.atan2(py - cop.y, px - cop.x);
  cop.angle = turnToward(cop.angle, wantAngle, 2.6 * dt);
  // Full throttle toward the player, easing off only when very close.
  const dist = Math.hypot(px - cop.x, py - cop.y);
  const target = dist < 60 ? 120 : type.top * 0.92;
  cop.speed += (target - cop.speed) * Math.min(1, dt * 1.2);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  const col = collideBuildings(game.world, cop.x, cop.y, 24);
  if (col.hit) {
    cop.x = col.x;
    cop.y = col.y;
    cop.speed *= 0.4;
    cop.angle += (Math.random() - 0.5) * 1.2;
    damageCar(game, cop, Math.abs(cop.speed) * 0.05);
  }
  const clamped = clampToWorld(cop.x, cop.y, 24);
  cop.x = clamped.x;
  cop.y = clamped.y;
  // Ramming the player on foot hurts them.
  if (p.onFoot && Math.abs(cop.speed) > 80 && Math.hypot(cop.x - p.x, cop.y - p.y) < 30) {
    damagePlayer(game, 15);
    cop.speed *= 0.5;
  }
  // The player ramming a police car is a crime of its own.
  if (p.car && Math.hypot(cop.x - p.x, cop.y - p.y) < 44 && Math.abs(p.car.speed) > 200 && cop.ramCooldown <= 0) {
    cop.ramCooldown = 2;
    p.heat = Math.min(599, p.heat + HEAT_RAM_COP);
    p.wanted = starsOf(p);
  }
  cop.ramCooldown = Math.max(0, (cop.ramCooldown || 0) - dt);
  // A cop's car smokes when it is nearly wrecked.
  if (cop.health < 50 && Math.random() < dt * 6) {
    game.fx.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: -25, r: 6, life: 1, maxLife: 1, color: 'rgba(80,80,80,0.5)', grow: 6 });
  }
}
