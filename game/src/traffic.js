// traffic.js — the city's life: cars driving its roads and pedestrians on
// its sidewalks. Traffic cars follow a road, turn at intersections, and
// slow for the car ahead; pedestrians stroll the sidewalks and run from
// gunfire, explosions and speeding cars.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, CAR_TYPES, CAR_COLORS, TRAFFIC_COUNT, PED_COUNT, HEAT_HIT_PED } from './config.js';
import { collideBuildings, clampToWorld, isWater } from './world.js';
import { damageCar, addHeat } from './player.js';
import { sparks } from './effects.js';
import { sfx } from './audio.js';

export function createCar(x, y, angle, type, driver) {
  return {
    x, y, angle,
    speed: 0,
    type,
    color: type === 'police' ? '#f0f0f0' : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    driver, // 'traffic' | 'parked' | 'player' | 'police'
    health: CAR_TYPES[type].health,
    wrecked: false,
    parked: driver === 'parked',
    // Traffic state: which road it follows and which way it goes.
    road: null,
    dir: 1,
    lane: 0,
    wait: 0,
  };
}

export function spawnTraffic(game) {
  // Moving traffic on the roads.
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const vertical = Math.random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = AVENUES[Math.floor(Math.random() * AVENUES.length)] + (Math.random() < 0.5 ? -22 : 22);
      y = Math.random() * (WORLD_H - 400);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = Math.random() * WORLD_W;
      y = STREETS[Math.floor(Math.random() * STREETS.length)] + (Math.random() < 0.5 ? -22 : 22);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    const type = Math.random() < 0.12 ? 'taxi' : Math.random() < 0.1 ? 'truck' : Math.random() < 0.08 ? 'sports' : Math.random() < 0.1 ? 'van' : 'sedan';
    const car = createCar(x, y, angle, type, 'traffic');
    car.speed = 120 + Math.random() * 60;
    car.road = vertical ? 'v' : 'h';
    car.dir = Math.cos(angle) + Math.sin(angle) > 0 ? 1 : -1;
    car.lane = Math.abs(x - Math.round(x / 100) * 100) < 30 ? -22 : 22;
    game.cars.push(car);
  }
  // Parked cars along the roads, waiting to be stolen.
  for (let i = 0; i < 16; i++) {
    const vertical = Math.random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = AVENUES[Math.floor(Math.random() * AVENUES.length)] + (Math.random() < 0.5 ? -36 : 36);
      y = 150 + Math.random() * (WORLD_H - 700);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = 150 + Math.random() * (WORLD_W - 300);
      y = STREETS[Math.floor(Math.random() * STREETS.length)] + (Math.random() < 0.5 ? -36 : 36);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    const type = Math.random() < 0.15 ? 'sports' : Math.random() < 0.1 ? 'van' : 'sedan';
    game.cars.push(createCar(x, y, angle, type, 'parked'));
  }
}

export function spawnPedestrians(game) {
  const shirts = ['#d96a4a', '#4a8ed9', '#7ab84a', '#d9b84a', '#9a5ad9', '#4ad9c2', '#e8e4da', '#d94a7a'];
  for (let i = 0; i < PED_COUNT; i++) {
    const vertical = Math.random() < 0.5;
    let x;
    let y;
    if (vertical) {
      x = AVENUES[Math.floor(Math.random() * AVENUES.length)] + (Math.random() < 0.5 ? -58 : 58);
      y = Math.random() * (WORLD_H - 400);
    } else {
      x = Math.random() * WORLD_W;
      y = STREETS[Math.floor(Math.random() * STREETS.length)] + (Math.random() < 0.5 ? -58 : 58);
    }
    game.peds.push({
      x, y,
      angle: Math.random() * Math.PI * 2,
      speed: 40 + Math.random() * 30,
      shirt: shirts[Math.floor(Math.random() * shirts.length)],
      skin: ['#f0c8a0', '#c89060', '#8a5a38', '#e8b88a'][Math.floor(Math.random() * 4)],
      down: false,
      downTimer: 0,
      flee: 0,
      wander: Math.random() * 4,
    });
  }
}

function updateTrafficCar(game, car, dt) {
  if (car.wrecked) return;
  const type = CAR_TYPES[car.type];
  // Slow down for the car ahead.
  let target = 130 + (car.type === 'sports' ? 40 : 0);
  const aheadX = car.x + Math.cos(car.angle) * 70;
  const aheadY = car.y + Math.sin(car.angle) * 70;
  for (const other of game.cars) {
    if (other === car || other.wrecked) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 34) {
      target = 0;
      break;
    }
  }
  // At an intersection, sometimes turn onto the crossing road.
  const nearV = AVENUES.some((ax) => Math.abs(car.x - ax) < 6);
  const nearH = STREETS.some((sy) => Math.abs(car.y - sy) < 6);
  if (nearV && nearH && car.wait <= 0 && Math.random() < 0.012) {
    car.road = car.road === 'v' ? 'h' : 'v';
    car.angle += Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    car.dir = Math.cos(car.angle) + Math.sin(car.angle) > 0 ? 1 : -1;
    car.wait = 2;
  }
  car.wait = Math.max(0, car.wait - dt);
  // Ease toward the target speed and steer back to the road centre.
  car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
  let wantAngle = car.angle;
  if (car.road === 'v') {
    const ax = nearestRoad(car.x, AVENUES);
    const laneX = ax + car.lane;
    wantAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    // Drift toward the lane.
    const off = laneX - car.x;
    wantAngle += Math.max(-0.4, Math.min(0.4, off * 0.01)) * (car.dir > 0 ? -1 : 1);
  } else {
    const sy = nearestRoad(car.y, STREETS);
    const laneY = sy + car.lane;
    wantAngle = car.dir > 0 ? 0 : Math.PI;
    const off = laneY - car.y;
    wantAngle += Math.max(-0.4, Math.min(0.4, off * 0.01)) * (car.dir > 0 ? 1 : -1);
  }
  car.angle = turnToward(car.angle, wantAngle, 1.6 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the world edges so traffic never runs out.
  if (car.x < -60) car.x = WORLD_W + 60;
  if (car.x > WORLD_W + 60) car.x = -60;
  if (car.y < -60) car.y = WORLD_H - 400;
  if (car.y > WORLD_H - 340) car.y = -60;
  // A traffic car that hits a building stops and turns around.
  const col = collideBuildings(game.world, car.x, car.y, 22);
  if (col.hit) {
    car.x = col.x;
    car.y = col.y;
    car.angle += Math.PI;
    car.dir *= -1;
    car.speed *= 0.3;
  }
}

function nearestRoad(v, list) {
  let best = list[0];
  for (const r of list) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}

export function turnToward(angle, target, maxTurn) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxTurn) return target;
  return angle + Math.sign(diff) * maxTurn;
}

function updatePed(game, ped, dt) {
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      // They get up and run away from the scene.
      ped.down = false;
      ped.flee = 5;
    }
    return;
  }
  ped.flee = Math.max(0, ped.flee - dt);
  ped.wander -= dt;
  if (ped.wander <= 0) {
    ped.wander = 2 + Math.random() * 4;
    ped.angle += (Math.random() - 0.5) * 1.6;
  }
  // A fleeing pedestrian runs from the player.
  let speed = ped.speed;
  if (ped.flee > 0) {
    speed = 220;
    ped.angle = Math.atan2(ped.y - game.player.y, ped.x - game.player.x);
  }
  // Pedestrians avoid the sea and the roads' middle; they keep to sidewalks.
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!isWater(nx, ny)) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.angle += Math.PI;
  }
  const col = collideBuildings(game.world, ped.x, ped.y, 10);
  ped.x = col.x;
  ped.y = col.y;
  const clamped = clampToWorld(ped.x, ped.y, 10);
  ped.x = clamped.x;
  ped.y = clamped.y;
  // A speeding car that hits a pedestrian knocks them down — and the law notices.
  for (const car of game.cars) {
    if (car.wrecked) continue;
    if (Math.abs(car.speed) < 60) continue;
    if (Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
      ped.down = true;
      ped.downTimer = 3;
      sparks(game.fx, ped.x, ped.y);
      if (car.driver === 'player') {
        addHeat(game, HEAT_HIT_PED);
        sfx.crash(game.audio);
      }
      break;
    }
  }
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.driver === 'traffic') updateTrafficCar(game, car, dt);
  }
  for (const ped of game.peds) updatePed(game, ped, dt);
  // Car-to-car collisions: a simple push apart with damage at speed.
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.01) {
        const overlap = 40 - d;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 140) {
          damageCar(game, a, impact * 0.08);
          damageCar(game, b, impact * 0.08);
          a.speed *= 0.5;
          b.speed *= 0.5;
          sparks(game.fx, (a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.driver === 'player' || b.driver === 'player') sfx.crash(game.audio);
        }
      }
    }
  }
}
