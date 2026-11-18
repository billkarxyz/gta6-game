// hud.js — the heads-up display: health, money, wanted stars, the mission
// objective, speed, the clock, and a live minimap. The bars and text are
// DOM elements (crisp at any size); the minimap is a small canvas drawn
// from the same world data as the main view.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, WATER_Y } from './config.js';
import { LANDMARKS, districtAt } from './world.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    healthBar: el('hud-health-fill'),
    healthText: el('hud-health-text'),
    money: el('hud-money'),
    stars: el('hud-stars'),
    district: el('hud-district'),
    clock: el('hud-clock'),
    objective: el('hud-objective'),
    speed: el('hud-speed'),
    toast: el('hud-toast'),
    bust: el('hud-bust'),
    minimap: el('minimap'),
    prompt: el('hud-prompt'),
    toastTimer: 0,
  };
}

export function showToast(hud, text, seconds) {
  hud.toast.textContent = text;
  hud.toast.classList.add('show');
  hud.toastTimer = seconds || 4;
}

export function showPrompt(hud, text) {
  if (text) {
    hud.prompt.textContent = text;
    hud.prompt.classList.add('show');
  } else {
    hud.prompt.classList.remove('show');
  }
}

function formatClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function updateHud(game, dt) {
  const hud = game.hud;
  const p = game.player;
  hud.toastTimer -= dt;
  if (hud.toastTimer <= 0) hud.toast.classList.remove('show');
  // Health.
  hud.healthBar.style.width = Math.max(0, p.health) + '%';
  hud.healthBar.className = 'fill' + (p.health < 30 ? ' low' : '');
  hud.healthText.textContent = Math.ceil(p.health);
  // Money and wanted stars.
  hud.money.textContent = '$' + p.money.toLocaleString('en-US');
  hud.stars.textContent = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
  hud.stars.className = p.wanted > 0 ? 'wanted' : '';
  // Where the player is, and what time it is.
  hud.district.textContent = districtAt(p.x, p.y);
  hud.clock.textContent = formatClock(game.clock);
  // The mission objective, or the fare, or a hint.
  const obj = game.missionObjective();
  const m = game.missions;
  let text = '';
  if (m.state === 'active') {
    text = obj || '';
    if (m.index === 3) text += ' — ' + Math.max(0, Math.ceil(m.timer)) + 's';
  } else if (m.fare) {
    text = m.fare.step === 0 ? 'Fare: pick up the passenger' : 'Fare: drop off the passenger';
  } else if (m.index < 5) {
    text = 'Go to Vera\'s Garage (yellow V) to start: ' + (m.index === 0 ? 'The First Job' : 'mission ' + (m.index + 1));
  } else {
    text = 'Free roam — fares pay around the city';
  }
  hud.objective.textContent = text;
  // Speed, only while driving.
  if (!p.onFoot && p.car) {
    hud.speed.textContent = Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h';
    hud.speed.classList.add('show');
  } else {
    hud.speed.classList.remove('show');
  }
  // The bust meter, while the police close in.
  if (p.bust > 0.05) {
    hud.bust.classList.add('show');
    hud.bust.querySelector('.fill').style.width = Math.round(p.bust * 100) + '%';
  } else {
    hud.bust.classList.remove('show');
  }
  drawMinimap(game);
}

function drawMinimap(game) {
  const hud = game.hud;
  const canvas = hud.minimap;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.clearRect(0, 0, w, h);
  // Ground and sea.
  ctx.fillStyle = '#c9b896';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2e8fb3';
  ctx.fillRect(0, WATER_Y * sy, w, h - WATER_Y * sy);
  // Roads.
  ctx.fillStyle = '#4a4a52';
  for (const ax of AVENUES) ctx.fillRect(ax * sx - 1, 0, 2, h);
  for (const sy2 of STREETS) ctx.fillRect(0, sy2 * sy - 1, w, 2);
  // Landmarks: the garage (yellow V), the respray (blue), the hospital (red),
  // the safehouse (green).
  const marks = [
    { lm: LANDMARKS.garage, color: '#ffd23c' },
    { lm: LANDMARKS.respray, color: '#4a8ed9' },
    { lm: LANDMARKS.hospital, color: '#d92e2e' },
    { lm: LANDMARKS.safehouse, color: '#7ee787' },
    { lm: LANDMARKS.gunshop, color: '#d9a521' },
  ];
  for (const mk of marks) {
    ctx.fillStyle = mk.color;
    ctx.beginPath();
    ctx.arc(mk.lm.x * sx, mk.lm.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The mission target blinks.
  const target = game.missions.target;
  if (target && Math.floor(game.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police cars are blue dots.
  for (const car of game.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    ctx.fillStyle = '#2e6bff';
    ctx.beginPath();
    ctx.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player is a white arrow, pointing the way they face.
  const p = game.player;
  ctx.save();
  ctx.translate(p.x * sx, p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // A frame around the map.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}
