// Cars: their arcade physics, the traffic that fills the roads, and the parked cars the player
// can steal. A car is a point with a heading and a signed speed; its velocity is split into a
// forward part (which the engine drives) and a sideways part (which the tyres scrub away), so a
// handbrake turn slides and a normal turn grips. Traffic cars follow a road line and turn at
// intersections; they slow for the car ahead of them.
import { CAR, ROAD_XS, ROAD_YS, TRAFFIC, WORLD } from './config.js';
import { collideCircle, hitsBuilding } from './world.js';
import { addExplosion, addSkid, addSmoke, addSparks } from './effects.js';
import { pickOne } from './random.js';

export const KIND_TRAFFIC = 'traffic';
export const KIND_POLICE = 'police';
export const KIND_PARKED = 'parked';

const TRAFFIC_COLOURS = ['#c9c2b4', '#7d9bb5', '#a86a8f', '#6f9e7e', '#d9a441', '#8a7fb8', '#5a748c', '#b5b5a8', '#c96f4a'];
const TRAFFIC_NAMES = ['Comet', 'Falcon', 'Dune', 'Metro', 'Ridge', 'Sable', 'Vortex', 'Lumen'];

let nextId = 1;

/** A new car at (x, y) facing angle, of the given kind and colour. */
export function createCar(x, y, angle, kind, colour) {
  const car = {
    id: nextId,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    kind,
    colour: colour || '#c9c2b4',
    name: TRAFFIC_NAMES[(nextId - 1) % TRAFFIC_NAMES.length],
    health: CAR.maxHealth,
    wreck: false,
    driver: kind !== KIND_PARKED,
    // Traffic state: which road it follows, which way, and which lane offset it holds.
    vertical: false,
    line: 0,
    dir: 1,
    lane: 0,
    turnCooldown: 0,
    smokeTimer: 0,
    brakeLight: false,
  };
  nextId += 1;
  return car;
}

/** Fill the roads with traffic cars and park a few cars by the kerb. */
export function spawnTraffic(state) {
  const random = state.random;
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const car = spawnTrafficCar(state);
    if (car) state.cars.push(car);
  }
  // Parked cars: beside roads, easy to steal, some with no driver at all.
  for (let i = 0; i < 10; i += 1) {
    const vertical = random() < 0.5;
    const line = vertical ? pickOne(random, ROAD_XS) : pickOne(random, ROAD_YS);
    const along = 120 + random() * (vertical ? WORLD.height - 360 : WORLD.width - 240);
    const side = random() < 0.5 ? -1 : 1;
    const x = vertical ? line + side * 38 : along;
    const y = vertical ? along : line + side * 38;
    if (hitsBuilding(state.city, x, y, 40)) continue;
    const car = createCar(x, y, vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI), KIND_PARKED, pickOne(random, TRAFFIC_COLOURS));
    car.driver = random() < 0.4;
    state.cars.push(car);
  }
}

/** One traffic car placed on a random road, facing along it. */
export function spawnTrafficCar(state) {
  const random = state.random;
  const vertical = random() < 0.5;
  const line = vertical ? pickOne(random, ROAD_XS) : pickOne(random, ROAD_YS);
  const along = 100 + random() * (vertical ? WORLD.height - 400 : WORLD.width - 200);
  const dir = random() < 0.5 ? -1 : 1;
  const lane = (random() < 0.5 ? -1 : 1) * 22;
  const x = vertical ? line + lane : along;
  const y = vertical ? along : line + lane;
  if (hitsBuilding(state.city, x, y, 40)) return null;
  const car = createCar(x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), KIND_TRAFFIC, pickOne(random, TRAFFIC_COLOURS));
  car.vertical = vertical;
  car.line = line;
  car.dir = dir;
  car.lane = lane;
  car.speed = TRAFFIC.speed + (random() - 0.5) * TRAFFIC.speedJitter;
  return car;
}

/** The car's two collision circles, front and back, for buildings and other cars. */
export function carCircles(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const half = CAR.length / 2 - 8;
  return [
    { x: car.x + fx * half, y: car.y + fy * half, r: CAR.width / 2 },
    { x: car.x - fx * half, y: car.y - fy * half, r: CAR.width / 2 },
  ];
}

/** Push a car out of buildings and the map edge; returns true when it hit something hard. */
function collideCar(state, car) {
  let hit = false;
  for (const circle of carCircles(car)) {
    const fixed = collideCircle(state.city, circle.x, circle.y, circle.r);
    const dx = fixed.x - circle.x;
    const dy = fixed.y - circle.y;
    if (dx !== 0 || dy !== 0) {
      car.x += dx;
      car.y += dy;
      hit = true;
    }
  }
  return hit;
}

/** Cars push each other apart; the faster one takes the damage. Returns the impact speed. */
function collideCars(state, car) {
  let impact = 0;
  for (const other of state.cars) {
    if (other === car || other.wreck) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const dist = Math.hypot(dx, dy);
    const min = CAR.length * 0.72;
    if (dist >= min || dist === 0) continue;
    const push = (min - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    car.x -= nx * push;
    car.y -= ny * push;
    other.x += nx * push;
    other.y += ny * push;
    const relSpeed = Math.abs(car.speed - other.speed);
    if (relSpeed > impact) impact = relSpeed;
    // Swap a little of the speed along the push, so a shunt shoves the other car.
    const shove = car.speed * 0.25;
    other.speed += shove;
    car.speed *= 0.7;
  }
  return impact;
}

/**
 * Drive a car with arcade physics. throttle is -1 (reverse) .. 1 (forward), steer is -1..1,
 * handbrake slides the car. Returns the impact speed when it hits something this step.
 */
export function driveCar(state, car, throttle, steer, handbrake, dt) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * forward.x + car.vy * forward.y;
  // Engine and brakes along the heading.
  let accel = 0;
  if (throttle > 0) accel = CAR.accel * throttle;
  else if (throttle < 0) accel = speedAlong > 20 ? -CAR.brake : CAR.reverseAccel * throttle;
  car.vx += forward.x * accel * dt;
  car.vy += forward.y * accel * dt;
  // Steering: sharper at low speed, and reversed when reversing.
  const steerAmount = steer * CAR.turnRate * Math.min(1, Math.abs(speedAlong) / 120) * (speedAlong >= 0 ? 1 : -1);
  car.angle += steerAmount * dt;
  // Grip: the tyres scrub the sideways velocity away, less so with the handbrake.
  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const side = { x: -fwd.y, y: fwd.x };
  const vForward = car.vx * fwd.x + car.vy * fwd.y;
  const vSide = car.vx * side.x + car.vy * side.y;
  const vSideAfter = vSide * Math.max(0, 1 - grip * dt);
  car.vx = fwd.x * vForward + side.x * vSideAfter;
  car.vy = fwd.y * vForward + side.y * vSideAfter;
  // Rolling drag and the speed cap.
  const drag = 1 - 0.35 * dt;
  car.vx *= drag;
  car.vy *= drag;
  const speed = Math.hypot(car.vx, car.vy);
  const cap = speedAlong >= 0 ? CAR.maxSpeed : CAR.maxReverse * 2;
  if (speed > CAR.maxSpeed) {
    car.vx = (car.vx / speed) * CAR.maxSpeed;
    car.vy = (car.vy / speed) * CAR.maxSpeed;
  }
  car.speed = car.vx * fwd.x + car.vy * fwd.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // Skid marks when the handbrake is on and the car is sliding.
  if (handbrake && Math.abs(vSide) > 120) {
    addSkid(state, car.x - fwd.x * 20, car.y - fwd.y * 20, car.angle);
    addSkid(state, car.x - fwd.x * 20 + side.x * 14, car.y - fwd.y * 20 + side.y * 14, car.angle);
  }
  const hitWall = collideCar(state, car);
  const impact = collideCars(state, car);
  if (hitWall && speed > 150) {
    car.speed *= 0.4;
    car.vx *= 0.4;
    car.vy *= 0.4;
    addSparks(state, car.x + fwd.x * 30, car.y + fwd.y * 30);
    return speed;
  }
  if (impact > 120) addSparks(state, car.x, car.y);
  return Math.max(impact, hitWall ? speed * 0.5 : 0);
}

/** A traffic car's steering: stay on its road line, slow for the car ahead, turn at crossings. */
function trafficDrive(state, car, dt) {
  car.turnCooldown -= dt;
  const along = car.vertical ? car.y : car.x;
  const across = car.vertical ? car.x : car.y;
  // At an intersection, sometimes turn onto the crossing road.
  const crossings = car.vertical ? ROAD_YS : ROAD_XS;
  for (const cross of crossings) {
    if (car.turnCooldown <= 0 && Math.abs(along - cross) < 8 && state.random() < 0.3) {
      car.vertical = !car.vertical;
      car.line = cross;
      car.dir = state.random() < 0.5 ? -1 : 1;
      car.lane = (state.random() < 0.5 ? -1 : 1) * 22;
      car.turnCooldown = 2;
      break;
    }
  }
  // Steer toward the lane: the target point is ahead on the road line.
  const targetAcross = car.line + car.lane;
  const ahead = 60;
  const tx = car.vertical ? targetAcross : car.x + car.dir * ahead;
  const ty = car.vertical ? car.y + car.dir * ahead : targetAcross;
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.5));
  // Slow for the car ahead.
  let throttle = 0.6;
  const lookX = car.x + Math.cos(car.angle) * TRAFFIC.minGap;
  const lookY = car.y + Math.sin(car.angle) * TRAFFIC.minGap;
  for (const other of state.cars) {
    if (other === car || other.wreck) continue;
    if (Math.hypot(other.x - lookX, other.y - lookY) < 40) { throttle = -0.4; break; }
  }
  // Slow for a pedestrian crossing ahead.
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - lookX, ped.y - lookY) < 30) { throttle = -0.6; break; }
  }
  // Turn around at the map edge.
  const edge = car.vertical ? WORLD.height - 120 : WORLD.width - 60;
  const low = 60;
  if ((car.vertical ? car.y : car.x) > edge || (car.vertical ? car.y : car.x) < low) {
    car.dir *= -1;
    car.lane *= -1;
    car.turnCooldown = 2;
  }
  driveCar(state, car, throttle, steer, false, dt);
}

/** Advance every car that is not the player's: traffic follows roads, wrecks smoke. */
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.wreck) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.25;
        addSmoke(state, car.x, car.y);
      }
      continue;
    }
    if (car === state.player.car) continue;
    if (car.kind === KIND_TRAFFIC) trafficDrive(state, car, dt);
    // A damaged car smokes.
    if (car.health < 40) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.4;
        addSmoke(state, car.x + Math.cos(car.angle) * 24, car.y + Math.sin(car.angle) * 24);
      }
    }
  }
  // Keep the streets full: replace traffic cars that left the city or were wrecked.
  let traffic = 0;
  for (const car of state.cars) if (car.kind === KIND_TRAFFIC && !car.wreck) traffic += 1;
  if (traffic < TRAFFIC.count) {
    const car = spawnTrafficCar(state);
    if (car) state.cars.push(car);
  }
}

/** Damage a car; at zero health it becomes a burning wreck. */
export function damageCar(state, car, amount) {
  if (car.wreck) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wreck = true;
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    addExplosion(state, car.x, car.y);
    state.audio.explosion();
  }
}

/** The nearest car to a point within range, or null. */
export function nearestCar(state, x, y, range) {
  let best = null;
  let bestDist = range;
  for (const car of state.cars) {
    if (car.wreck) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}
