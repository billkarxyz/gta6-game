// render.js — everything the player sees: the camera that follows the
// action, the city drawn from the world data, the cars and people, the
// effects, and the day's light. The HUD lives in hud.js; this file draws
// the world itself onto the main canvas.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, WATER_Y, SAND_Y, SIDEWALK, PALETTE } from './config.js';
import { DISTRICTS, LANDMARKS, districtAt } from './world.js';

export function createCamera(viewW, viewH) {
  return { x: 0, y: 0, viewW, viewH, zoom: 1 };
}

export function updateCamera(game, dt) {
  const cam = game.camera;
  const p = game.player;
  // Follow the player, looking a little ahead in the direction of travel.
  const lead = p.onFoot ? 0 : 60;
  const tx = p.x + Math.cos(p.angle) * lead - cam.viewW / 2;
  const ty = p.y + Math.sin(p.angle) * lead - cam.viewH / 2;
  const k = Math.min(1, dt * 4);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.x = Math.max(-40, Math.min(WORLD_W - cam.viewW + 40, cam.x));
  cam.y = Math.max(-40, Math.min(WORLD_H - cam.viewH + 40, cam.y));
}

function drawCarShape(ctx, car) {
  const len = car.type === 'truck' ? 58 : car.type === 'van' ? 54 : 48;
  const wid = car.type === 'truck' ? 26 : car.type === 'van' ? 24 : 22;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = car.wrecked ? '#2a2a2a' : car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = car.wrecked ? '#1a1a1a' : '#9fc8d8';
  ctx.fillRect(-len * 0.22, -wid / 2 + 3, len * 0.18, wid - 6);
  ctx.fillRect(len * 0.12, -wid / 2 + 3, len * 0.14, wid - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 3, wid / 2 - 7, 3, 5);
  // Police livery: a black stripe and a light bar.
  if (car.type === 'police') {
    ctx.fillStyle = '#1a3a8a';
    ctx.fillRect(-len * 0.1, -wid / 2, len * 0.2, wid);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-len * 0.32, -wid / 2, len * 0.1, wid);
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -wid / 2 - 1, 8, 5);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, wid / 2 - 4, 8, 5);
  }
  // Taxi sign.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#f5d90a';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, shirt, skin, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    // Lying on the ground: a still figure, rotated flat.
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.fillRect(-11, -5, 22, 10);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(13, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and head.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function render(game) {
  const ctx = game.ctx;
  const cam = game.camera;
  const fx = game.fx;
  const vw = cam.viewW;
  const vh = cam.viewH;
  ctx.clearRect(0, 0, vw, vh);
  // Screen shake: offset the whole world by a small random amount.
  const shakeX = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake : 0;
  const shakeY = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake : 0;
  ctx.save();
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
  const x0 = cam.x - 60;
  const y0 = cam.y - 60;
  const x1 = cam.x + vw + 60;
  const y1 = cam.y + vh + 60;

  // Ground.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Sand and sea at the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, SAND_Y, x1 - x0, WATER_Y - SAND_Y);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(x0, WATER_Y, x1 - x0, y1 - WATER_Y);
  // Gentle waves: light lines that drift with time.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let wx = Math.floor(x0 / 120) * 120; wx < x1; wx += 120) {
    const wy = WATER_Y + 14 + Math.sin(game.time * 0.8 + wx * 0.01) * 6;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + 60, wy);
    ctx.stroke();
  }
  // Parks.
  for (const park of game.world.parks) {
    if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Roads: asphalt, then centre dashes. The avenues stop at the sand —
  // the city ends at the beach, and only the pier goes on into the sea.
  const roadBottom = Math.min(y1, SAND_Y);
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, y0, ROAD_W, roadBottom - y0);
  for (const sy of STREETS) ctx.fillRect(x0, sy - ROAD_W / 2, x1 - x0, ROAD_W);
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const ax of AVENUES) {
    ctx.moveTo(ax, y0);
    ctx.lineTo(ax, roadBottom);
  }
  for (const sy of STREETS) {
    ctx.moveTo(x0, sy);
    ctx.lineTo(x1, sy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalks: pale strips along each road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) {
    ctx.fillRect(ax - ROAD_W / 2 - SIDEWALK, y0, SIDEWALK, roadBottom - y0);
    ctx.fillRect(ax + ROAD_W / 2, y0, SIDEWALK, roadBottom - y0);
  }
  for (const sy of STREETS) {
    ctx.fillRect(x0, sy - ROAD_W / 2 - SIDEWALK, x1 - x0, SIDEWALK);
    ctx.fillRect(x0, sy + ROAD_W / 2, x1 - x0, SIDEWALK);
  }
  // The pier juts into the sea.
  const pier = LANDMARKS.pier;
  ctx.fillStyle = '#a8825a';
  ctx.fillRect(pier.x - 14, pier.y - 40, 28, WATER_Y + 260 - (pier.y - 40));
  ctx.fillStyle = '#8a6a45';
  for (let py = pier.y - 20; py < WATER_Y + 240; py += 30) ctx.fillRect(pier.x - 14, py, 28, 4);

  // Buildings, with a drop shadow that reads as height.
  for (const b of game.world.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop detail: a smaller inner rectangle.
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w * 0.35, b.y + b.h * 0.3, b.w * 0.3, b.h * 0.4);
    }
  }
  // Trees.
  for (const t of game.world.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e8a3e';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6da85c';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Landmark markers on the ground: a coloured ring and a label.
  for (const lm of Object.values(LANDMARKS)) {
    if (lm.x < x0 - 100 || lm.x > x1 + 100 || lm.y < y0 - 100 || lm.y > y1 + 100) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, lm.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(20,20,20,0.65)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.name, lm.x, lm.y - lm.radius - 8);
  }
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.45)';
  ctx.lineWidth = 5;
  for (const s of fx.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Pickups: health crosses, ammo boxes and cash.
  for (const pk of game.pickups) {
    if (pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
    const bob = Math.sin(game.time * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#d92e2e';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.fillRect(-7, -3, 14, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#d9a521';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3);
    } else {
      ctx.fillStyle = '#7ee787';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    }
    ctx.restore();
  }
  // Mission packages: glowing crates.
  for (const pkg of game.missions.packages) {
    if (pkg.got) continue;
    const pulse = 0.6 + Math.sin(game.time * 4) * 0.4;
    ctx.fillStyle = `rgba(255,200,40,${0.5 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(pkg.x, pkg.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c89a2e';
    ctx.fillRect(pkg.x - 12, pkg.y - 12, 24, 24);
    ctx.strokeStyle = '#7a5a10';
    ctx.lineWidth = 2;
    ctx.strokeRect(pkg.x - 12, pkg.y - 12, 24, 24);
  }
  // The mission target: a tall beacon of light.
  const target = game.missions.target;
  if (target) {
    const pulse = 0.5 + Math.sin(game.time * 3) * 0.3;
    const grad = ctx.createLinearGradient(target.x, target.y - 120, target.x, target.y);
    grad.addColorStop(0, 'rgba(255,210,60,0)');
    grad.addColorStop(1, `rgba(255,210,60,${0.35 + pulse * 0.25})`);
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 14, target.y - 120, 28, 120);
    ctx.fillStyle = `rgba(255,210,60,${0.7 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.label, target.x, target.y - 130);
  }
  // Pedestrians.
  for (const ped of game.peds) {
    if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.down);
  }
  // Cars.
  for (const car of game.cars) {
    if (car.x < x0 - 60 || car.x > x1 + 60 || car.y < y0 - 60 || car.y > y1 + 60) continue;
    drawCarShape(ctx, car);
    // A mission car carries a marker above it.
    if (car.missionCar && !car.wrecked) {
      ctx.fillStyle = '#ffd23c';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', car.x, car.y - 34);
    }
  }
  // The player on foot.
  const p = game.player;
  if (p.onFoot && !p.dead) {
    drawPerson(ctx, p.x, p.y, p.angle, '#2e6db3', '#f0c8a0', false);
    // The gun points where the mouse aims.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 14, 4);
    ctx.restore();
  }
  // The bullet tracer, fading fast.
  if (game.bullet && game.bullet.life > 0) {
    ctx.strokeStyle = 'rgba(255,240,150,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(game.bullet.x1, game.bullet.y1);
    ctx.lineTo(game.bullet.x2, game.bullet.y2);
    ctx.stroke();
  }
  // Particles.
  for (const pt of fx.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Muzzle flashes and explosion flashes.
  for (const fl of fx.flashes) {
    ctx.globalAlpha = Math.max(0, fl.life / fl.maxLife);
    ctx.fillStyle = '#fff2a8';
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // District name, drawn large on the ground where the player stands.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(districtAt(p.x, p.y), p.x, p.y - 90);
  ctx.restore();

  // Time of day: a warm tint at noon, orange at dusk, dark blue at night.
  const hour = (game.clock / 3600) % 24;
  let tint = null;
  if (hour >= 18.5 && hour < 20) tint = 'rgba(255,140,40,0.10)';
  else if (hour >= 20 || hour < 6) tint = 'rgba(10,20,70,0.28)';
  else if (hour >= 6 && hour < 7.5) tint = 'rgba(255,180,90,0.08)';
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, vw, vh);
  }
  // Vignette: the edges darken slightly, which makes the centre read better.
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);
}
