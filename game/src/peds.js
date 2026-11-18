// Pedestrians: the people of Solmar, walking the sidewalks, crossing at corners, and running
// when they are scared. A pedestrian walks toward a waypoint on the sidewalk network; when a
// gunshot, an explosion or a speeding car comes near, they flee away from it for a few seconds.
// A pedestrian hit by a car or a bullet falls and drops a little cash.
import { PEDS, ROAD_XS, ROAD_YS, WORLD } from './config.js';
import { collideCircle, isSidewalk } from './world.js';
import { addCashBurst, addHitPuff } from './effects.js';
import { pickOne } from './random.js';

const SHIRTS = ['#e5534b', '#4fc3f7', '#7ee081', '#f2c94c', '#b58ae0', '#f28ab2', '#7ad1c3', '#e8e3c8'];
const PANTS = ['#2c3038', '#3a4a5a', '#5a4a3a', '#4a3a5a'];

/** A pedestrian at (x, y) on a sidewalk, with a waypoint to walk toward. */
export function createPed(state, x, y) {
  return {
    x, y,
    angle: state.random() * Math.PI * 2,
    waypoint: randomSidewalkPoint(state),
    shirt: pickOne(state.random, SHIRTS),
    pants: pickOne(state.random, PANTS),
    speed: PEDS.walkSpeed * (0.8 + state.random() * 0.4),
    flee: 0,
    fleeX: 0,
    fleeY: 0,
    down: false,
    downTimer: 0,
    walkPhase: state.random() * Math.PI * 2,
  };
}

/** A random point on a sidewalk: beside a road, away from intersections. */
export function randomSidewalkPoint(state) {
  const random = state.random;
  const vertical = random() < 0.5;
  const line = vertical ? pickOne(random, ROAD_XS) : pickOne(random, ROAD_YS);
  const along = 80 + random() * (vertical ? WORLD.height - 300 : WORLD.width - 160);
  const side = random() < 0.5 ? -1 : 1;
  const offset = 56 + random() * 6;
  return vertical ? { x: line + side * offset, y: along } : { x: along, y: line + side * offset };
}

/** Fill the sidewalks with pedestrians. */
export function spawnPeds(state) {
  for (let i = 0; i < PEDS.count; i += 1) {
    const point = randomSidewalkPoint(state);
    state.peds.push(createPed(state, point.x, point.y));
  }
}

/** Scare every pedestrian within radius of (x, y): they run away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.flee = 3 + state.random() * 2;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

/** Knock a pedestrian down: they fall, drop cash, and get up after a while. */
export function knockPed(state, ped) {
  if (ped.down) return;
  ped.down = true;
  ped.downTimer = 6;
  ped.flee = 0;
  addHitPuff(state, ped.x, ped.y);
  addCashBurst(state, ped.x, ped.y);
  state.player.money += 20;
}

/** Walk the pedestrians: toward their waypoint, or away from what scared them. */
export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.waypoint = randomSidewalkPoint(state);
      }
      continue;
    }
    let targetX;
    let targetY;
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      // Run away from the scare, toward the nearest sidewalk point past it.
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      targetX = ped.x + (dx / d) * 200;
      targetY = ped.y + (dy / d) * 200;
      speed = PEDS.fleeSpeed;
    } else {
      targetX = ped.waypoint.x;
      targetY = ped.waypoint.y;
      if (Math.hypot(targetX - ped.x, targetY - ped.y) < 20) {
        ped.waypoint = randomSidewalkPoint(state);
        targetX = ped.waypoint.x;
        targetY = ped.waypoint.y;
      }
    }
    const dx = targetX - ped.x;
    const dy = targetY - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = Math.min(dist, speed * dt);
      const nx = ped.x + (dx / dist) * step;
      const ny = ped.y + (dy / dist) * step;
      const fixed = collideCircle(state.city, nx, ny, 10);
      ped.x = fixed.x;
      ped.y = fixed.y;
      ped.angle = Math.atan2(dy, dx);
      ped.walkPhase += dt * speed * 0.06;
    }
  }
}
