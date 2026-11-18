// Combat: the player's pistol, its bullets, and the pickups scattered around the city. Bullets
// fly straight and die on the first thing they hit: a building, a car, a pedestrian or a police
// car. A car that takes enough bullets explodes and hurts everything near it. Health, ammo and
// money pickups wait on sidewalks and respawn after a while.
import { COMBAT, PICKUPS, WANTED } from './config.js';
import { hitsBuilding } from './world.js';
import { damageCar } from './vehicles.js';
import { addWanted } from './police.js';
import { knockPed, randomSidewalkPoint, scarePeds } from './peds.js';
import { addCashBurst, addExplosion, addHitPuff, addMuzzle } from './effects.js';

/** Fire one bullet from the player toward the aim angle, if the pistol is ready. */
export function shoot(state) {
  const player = state.player;
  if (player.car || player.fireCooldown > 0 || player.ammo <= 0) return;
  player.ammo -= 1;
  player.fireCooldown = COMBAT.fireInterval;
  const angle = player.aimAngle;
  state.bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: COMBAT.bulletLife,
  });
  addMuzzle(state, player.x, player.y, angle);
  state.audio.shot();
  addWanted(state, WANTED.shoot, 'fired a shot');
  scarePeds(state, player.x, player.y, 300);
}

/** Blow a car up: fire, damage to everything near it, and a crime on the record. */
export function explodeCar(state, car) {
  addExplosion(state, car.x, car.y);
  state.audio.explosion();
  scarePeds(state, car.x, car.y, 400);
  for (const ped of state.peds) {
    if (!ped.down && Math.hypot(ped.x - car.x, ped.y - car.y) < COMBAT.explosionRadius) knockPed(state, ped);
  }
  const player = state.player;
  if (Math.hypot(player.x - car.x, player.y - car.y) < COMBAT.explosionRadius) {
    player.health = Math.max(0, player.health - COMBAT.explosionDamage / 2);
    if (player.health === 0) player.dead = true;
  }
}

/** Move the bullets and resolve what they hit. */
export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    let dead = bullet.life <= 0;
    if (!dead && hitsBuilding(state.city, bullet.x, bullet.y, 2)) {
      dead = true;
      addHitPuff(state, bullet.x, bullet.y);
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.wreck || car === state.player.car) continue;
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 34) {
          dead = true;
          damageCar(state, car, COMBAT.pistolDamage);
          addHitPuff(state, bullet.x, bullet.y);
          if (car.wreck) {
            explodeCar(state, car);
            if (car.kind === 'police') addWanted(state, WANTED.killPolice, 'destroyed a police car');
          }
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
          dead = true;
          knockPed(state, ped);
          addWanted(state, WANTED.hitPed, 'shot a pedestrian');
          scarePeds(state, ped.x, ped.y, 300);
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Scatter health, ammo and money pickups on the sidewalks. */
export function spawnPickups(state) {
  const kinds = ['health', 'ammo', 'money'];
  for (const kind of kinds) {
    const count = PICKUPS[kind].count;
    for (let i = 0; i < count; i += 1) {
      const point = randomSidewalkPoint(state);
      state.pickups.push({ kind, x: point.x, y: point.y, taken: false, respawn: 0 });
    }
  }
}

/** Collect a pickup the player walks or drives over, and respawn taken ones. */
export function updatePickups(state, dt) {
  const player = state.player;
  for (const pickup of state.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) {
        const point = randomSidewalkPoint(state);
        pickup.x = point.x;
        pickup.y = point.y;
        pickup.taken = false;
      }
      continue;
    }
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 30) {
      pickup.taken = true;
      pickup.respawn = 45;
      if (pickup.kind === 'health') {
        player.health = Math.min(100, player.health + COMBAT.healthPickup);
        state.message = 'Health restored';
        state.audio.pickup();
      } else if (pickup.kind === 'ammo') {
        player.ammo += COMBAT.ammoPickup;
        state.message = '+' + COMBAT.ammoPickup + ' ammo';
        state.audio.pickup();
      } else {
        player.money += PICKUPS.moneyValue;
        state.message = '+$' + PICKUPS.moneyValue;
        addCashBurst(state, pickup.x, pickup.y);
        state.audio.cash();
      }
      state.messageTimer = 2;
    }
  }
}
