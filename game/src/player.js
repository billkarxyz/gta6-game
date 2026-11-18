// player.js — the player on foot and behind the wheel: movement, entering
// and leaving cars, health, shooting, and the wanted heat the player's
// crimes build up. The police module reads the heat and answers with stars.
import { WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, CAR_TYPES, PISTOL_DAMAGE, PISTOL_MAG, PISTOL_RANGE, HEAT_STEAL, HEAT_SHOOT, COP_VIEW } from './config.js';
import { collideBuildings, clampToWorld, isWater } from './world.js';
import { moveAxes, down, wasPressed } from './input.js';
import { muzzle, sparks, explosion, addShake } from './effects.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2, // facing up
    health: 100,
    money: 250,
    ammo: 36,
    mag: PISTOL_MAG,
    onFoot: true,
    car: null, // the car object the player drives, or null
    heat: 0, // wanted heat; stars = floor(heat / 100), capped at 5
    wanted: 0,
    lastSeen: 0, // seconds since a cop last saw the player
    bust: 0, // 0..1, fills while stopped near police
    dead: false,
    busted: false,
    aimAngle: 0,
    reloadTimer: 0,
    shootCooldown: 0,
  };
}

export function starsOf(player) {
  return Math.min(5, Math.floor(player.heat / 100));
}

export function addHeat(game, amount) {
  game.player.heat = Math.min(599, game.player.heat + amount);
  game.player.wanted = starsOf(game.player);
}

// The nearest car the player could steal, within reach on foot.
export function nearestCar(game, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(game, car) {
  const p = game.player;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  car.parked = false;
  // Stealing a car in sight of the police is a crime; out of sight, nobody knows.
  const seen = game.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < COP_VIEW);
  if (seen) addHeat(game, HEAT_STEAL);
  sfx.door(game.audio);
}

function exitCar(game) {
  const p = game.player;
  const car = p.car;
  car.driver = 'parked';
  car.speed = 0;
  // Step out to the car's left side.
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 26;
  p.y = car.y + Math.sin(side) * 26;
  p.onFoot = true;
  p.car = null;
  p.angle = car.angle;
  sfx.door(game.audio);
}

function updateOnFoot(game, dt) {
  const p = game.player;
  const axes = moveAxes(game.input);
  const running = down(game.input, 'ShiftLeft') || down(game.input, 'ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
  }
  // Aim follows the mouse.
  const worldMouse = game.screenToWorld(game.input.mouseX, game.input.mouseY);
  p.aimAngle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
  // Collisions: buildings, world edge, and the sea.
  const col = collideBuildings(game.world, p.x, p.y, PLAYER_RADIUS);
  p.x = col.x;
  p.y = col.y;
  const clamped = clampToWorld(p.x, p.y, PLAYER_RADIUS);
  p.x = clamped.x;
  p.y = clamped.y;
  // Enter a car with E.
  if (wasPressed(game.input, 'KeyE')) {
    const car = nearestCar(game, 60);
    if (car) enterCar(game, car);
  }
  // Shooting: click to fire, R to reload.
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      const take = Math.min(PISTOL_MAG - p.mag, p.ammo);
      p.mag += take;
      p.ammo -= take;
    }
  } else if (wasPressed(game.input, 'KeyR') && p.mag < PISTOL_MAG && p.ammo > 0) {
    p.reloadTimer = 0.9;
  }
  if (game.input.mouseDown && p.shootCooldown <= 0 && p.reloadTimer <= 0 && p.mag > 0) {
    shoot(game);
  }
}

function shoot(game) {
  const p = game.player;
  p.mag -= 1;
  p.shootCooldown = 0.22;
  const gx = p.x + Math.cos(p.aimAngle) * 20;
  const gy = p.y + Math.sin(p.aimAngle) * 20;
  muzzle(game.fx, gx, gy);
  sfx.shoot(game.audio);
  addHeat(game, HEAT_SHOOT);
  // A hit-scan shot: the first thing along the aim line within range takes damage.
  let hitDist = PISTOL_RANGE;
  let hitCar = null;
  let hitPed = null;
  for (const car of game.cars) {
    if (car.wrecked) continue;
    const d = rayToCircle(p.x, p.y, p.aimAngle, car.x, car.y, 26);
    if (d !== null && d < hitDist) {
      hitDist = d;
      hitCar = car;
      hitPed = null;
    }
  }
  for (const ped of game.peds) {
    if (ped.down) continue;
    const d = rayToCircle(p.x, p.y, p.aimAngle, ped.x, ped.y, 12);
    if (d !== null && d < hitDist) {
      hitDist = d;
      hitPed = ped;
      hitCar = null;
    }
  }
  const hx = p.x + Math.cos(p.aimAngle) * hitDist;
  const hy = p.y + Math.sin(p.aimAngle) * hitDist;
  game.bullet = { x1: gx, y1: gy, x2: hx, y2: hy, life: 0.06 };
  if (hitCar) damageCar(game, hitCar, PISTOL_DAMAGE);
  if (hitPed) {
    hitPed.down = true;
    hitPed.downTimer = 3;
    sparks(game.fx, hx, hy);
    addHeat(game, 60);
  }
  // Nearby pedestrians hear the shot and run.
  for (const ped of game.peds) {
    if (!ped.down && Math.hypot(ped.x - p.x, ped.y - p.y) < 260) ped.flee = 4;
  }
}

// Distance along a ray to a circle, or null when the ray misses it.
function rayToCircle(ox, oy, angle, cx, cy, r) {
  const dx = cx - ox;
  const dy = cy - oy;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (along < 0) return null;
  const perp2 = dx * dx + dy * dy - along * along;
  if (perp2 > r * r) return null;
  return along - Math.sqrt(r * r - perp2);
}

export function damageCar(game, car, amount) {
  car.health -= amount;
  sparks(game.fx, car.x, car.y);
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    explosion(game.fx, car.x, car.y);
    sfx.explosion(game.audio);
    // The blast hurts anyone close, including the player.
    for (const ped of game.peds) {
      if (!ped.down && Math.hypot(ped.x - car.x, ped.y - car.y) < 110) {
        ped.down = true;
        ped.downTimer = 3;
      }
    }
    const p = game.player;
    if (Math.hypot(p.x - car.x, p.y - car.y) < 110) damagePlayer(game, 40);
    if (car.driver === 'player') {
      // The player's car blew up under them: they step out, hurt.
      p.onFoot = true;
      p.car = null;
      p.x = car.x + 30;
      p.y = car.y;
    }
  }
}

export function damagePlayer(game, amount) {
  const p = game.player;
  if (p.dead) return;
  p.health -= amount;
  addShake(game.fx, 6);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
  }
}

function updateDriving(game, dt) {
  const p = game.player;
  const car = p.car;
  const type = CAR_TYPES[car.type];
  const axes = moveAxes(game.input);
  const handbrake = down(game.input, 'Space');
  // Throttle forward or back, with drag and a handbrake that kills grip.
  if (axes.y < 0) car.speed += type.accel * dt;
  else if (axes.y > 0) car.speed -= type.accel * 0.7 * dt;
  else car.speed -= car.speed * 0.6 * dt;
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  car.speed = Math.max(-type.top * 0.4, Math.min(type.top, car.speed));
  // Steering only bites while moving, and the handbrake loosens it.
  const steer = axes.x * type.grip * (handbrake ? 1.5 : 1) * Math.min(1, Math.abs(car.speed) / 90);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const prevX = car.x;
  const prevY = car.y;
  car.x = nx;
  car.y = ny;
  // Skid marks on hard turns and handbrake slides.
  if ((Math.abs(axes.x) > 0.5 && Math.abs(car.speed) > 180) || (handbrake && Math.abs(car.speed) > 120)) {
    const back = 18;
    const bx = car.x - Math.cos(car.angle) * back;
    const by = car.y - Math.sin(car.angle) * back;
    const px = prevX - Math.cos(car.angle) * back;
    const py = prevY - Math.sin(car.angle) * back;
    game.fx.skids.push({ x1: px, y1: py, x2: bx, y2: by, life: 6 });
    if (Math.random() < 0.4) {
      game.fx.particles.push({ x: bx, y: by, vx: 0, vy: 0, r: 5, life: 0.6, maxLife: 0.6, color: 'rgba(200,200,200,0.4)', grow: 8 });
    }
  }
  // Collisions with buildings: bounce off and take damage at speed.
  const col = collideBuildings(game.world, car.x, car.y, 24);
  if (col.hit) {
    const impact = Math.abs(car.speed);
    car.x = col.x;
    car.y = col.y;
    if (impact > 120) {
      car.speed *= -0.35;
      damageCar(game, car, impact * 0.12);
      sparks(game.fx, car.x, car.y);
      sfx.crash(game.audio);
      addShake(game.fx, Math.min(10, impact * 0.03));
    } else {
      car.speed *= 0.4;
    }
  }
  const clamped = clampToWorld(car.x, car.y, 24);
  car.x = clamped.x;
  car.y = clamped.y;
  // The player rides with the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Step out with E.
  if (wasPressed(game.input, 'KeyE')) exitCar(game);
  // Horn with H.
  if (wasPressed(game.input, 'KeyH')) sfx.horn(game.audio);
}

export function updatePlayer(game, dt) {
  const p = game.player;
  if (p.dead || p.busted) return;
  if (p.onFoot) updateOnFoot(game, dt);
  else updateDriving(game, dt);
  // Pickups: walk or drive over them to collect.
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      applyPickup(game, pk);
      game.pickups.splice(i, 1);
    }
  }
}

function applyPickup(game, pk) {
  const p = game.player;
  if (pk.kind === 'health') {
    p.health = Math.min(100, p.health + 50);
    sfx.pickup(game.audio);
  } else if (pk.kind === 'ammo') {
    p.ammo += 24;
    sfx.pickup(game.audio);
  } else if (pk.kind === 'cash') {
    p.money += pk.value;
    sfx.cash(game.audio);
  }
  game.fx.particles.push({ x: pk.x, y: pk.y, vx: 0, vy: -40, r: 5, life: 0.5, maxLife: 0.5, color: '#7ee787', grow: 4 });
}
