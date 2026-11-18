// The HUD and the menus: health, money, ammo, wanted stars, the minimap, the mission objective,
// the speedometer, and the screens the game shows between play (title, pause, game over, busted,
// mission banners). All of it is drawn on the same canvas as the world, in screen pixels, after
// the world is painted. The minimap is a small live map of the whole city: roads, the player,
// police, and the mission marker.
import { FONT, PALETTE, ROAD_XS, ROAD_YS, WORLD } from './config.js';
import { districtAt } from './world.js';
import { objectiveText } from './missions.js';

const MINIMAP = { width: 200, height: 160, margin: 16 };

export function createHud(canvas) {
  const context = canvas.getContext('2d');

  function size() {
    return { width: window.innerWidth, height: window.innerHeight, ratio: window.devicePixelRatio || 1 };
  }

  const fonts = new Map();
  function font(px, weight) {
    const key = (weight || '') + px;
    if (!fonts.has(key)) fonts.set(key, (weight ? weight + ' ' : '') + px + 'px ' + FONT);
    return fonts.get(key);
  }

  function text(value, x, y, px, colour, align, weight) {
    context.font = font(px, weight);
    context.fillStyle = colour;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = 'rgba(13,17,23,0.72)';
    context.beginPath();
    context.roundRect(x, y, w, h, 8);
    context.fill();
  }

  function star(x, y, size, filled) {
    context.save();
    context.translate(x, y);
    context.fillStyle = filled ? PALETTE.star : 'rgba(255,217,74,0.25)';
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? size : size * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) context.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawStats(state) {
    const { width } = size();
    const player = state.player;
    panel(16, 16, 250, 96);
    // Health bar.
    context.fillStyle = '#2c3038';
    context.fillRect(30, 30, 150, 14);
    context.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.danger;
    context.fillRect(30, 30, 150 * (player.health / 100), 14);
    text(Math.ceil(player.health) + '', 190, 42, 15, PALETTE.text, 'left', '700');
    text('$' + player.money.toLocaleString('en-US'), 30, 70, 22, '#7ee081', 'left', '700');
    text(player.car ? player.car.name : 'On foot', 30, 96, 15, PALETTE.muted);
    if (!player.car) text('Ammo ' + player.ammo, 150, 96, 15, PALETTE.muted);
    // Wanted stars, top right.
    const starsX = width - 16 - 5 * 30;
    panel(starsX - 12, 16, 5 * 30 + 24, 44);
    for (let i = 0; i < 5; i += 1) star(starsX + i * 30 + 15, 38, 11, i < state.wanted);
    // The clock and the district, under the stars.
    const hour = Math.floor((state.clock / 3600) % 24);
    const minute = Math.floor((state.clock / 60) % 60);
    const clock = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    text(clock + '  ·  ' + districtAt(player.x, player.y), width - 16, 84, 15, PALETTE.text, 'right');
  }

  function drawObjective(state) {
    const { height } = size();
    const line = objectiveText(state.missions);
    if (!line) return;
    context.font = font(16, '600');
    const w = Math.min(560, context.measureText(line).width + 32);
    panel(16, height - 76, w, 40);
    text(line, 32, height - 49, 16, PALETTE.text, 'left', '600');
  }

  function drawSpeed(state) {
    const { width, height } = size();
    const player = state.player;
    if (!player.car) return;
    const kmh = Math.round(Math.abs(player.car.speed) * 0.18);
    text(kmh + '', width - MINIMAP.width - 36, height - 40, 34, PALETTE.text, 'right', '700');
    text('km/h', width - MINIMAP.width - 36, height - 18, 13, PALETTE.muted, 'right');
    // The car's health, as a bar under the speed.
    context.fillStyle = '#2c3038';
    context.fillRect(width - MINIMAP.width - 136, height - 12, 100, 6);
    context.fillStyle = player.car.health > 30 ? PALETTE.health : PALETTE.danger;
    context.fillRect(width - MINIMAP.width - 136, height - 12, 100 * (player.car.health / 100), 6);
  }

  function drawMinimap(state, target) {
    const { width, height } = size();
    const x = width - MINIMAP.width - MINIMAP.margin;
    const y = height - MINIMAP.height - MINIMAP.margin;
    const sx = MINIMAP.width / WORLD.width;
    const sy = MINIMAP.height / WORLD.height;
    panel(x - 6, y - 6, MINIMAP.width + 12, MINIMAP.height + 12);
    context.save();
    context.beginPath();
    context.rect(x, y, MINIMAP.width, MINIMAP.height);
    context.clip();
    context.fillStyle = '#5a7a42';
    context.fillRect(x, y, MINIMAP.width, MINIMAP.height);
    context.fillStyle = '#3a3f47';
    for (const rx of ROAD_XS) context.fillRect(x + rx * sx - 2, y, 4, MINIMAP.height);
    for (const ry of ROAD_YS) context.fillRect(x, y + ry * sy - 2, MINIMAP.width, 4);
    context.fillStyle = '#2e7fa8';
    context.fillRect(x, y + 2500 * sy, MINIMAP.width, MINIMAP.height - 2500 * sy);
    // Police cars as blue dots, the mission marker as a pulsing amber diamond.
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.wreck) continue;
      context.fillStyle = '#3b82ff';
      context.beginPath();
      context.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    if (target) {
      const pulse = 5 + Math.sin(state.time * 4) * 1.5;
      context.fillStyle = PALETTE.accent;
      context.save();
      context.translate(x + target.x * sx, y + target.y * sy);
      context.rotate(Math.PI / 4);
      context.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      context.restore();
    }
    // The player: a white arrow pointing where they face.
    const player = state.player;
    context.save();
    context.translate(x + player.x * sx, y + player.y * sy);
    context.rotate(player.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
  }

  function drawBustMeter(state) {
    if (state.bustTimer <= 0) return;
    const { width } = size();
    const w = 220;
    const x = (width - w) / 2;
    panel(x - 12, 76, w + 24, 40);
    text('BUSTED IN', x, 92, 13, PALETTE.danger, 'left', '700');
    context.fillStyle = '#2c3038';
    context.fillRect(x + 84, 82, w - 84, 10);
    context.fillStyle = PALETTE.danger;
    context.fillRect(x + 84, 82, (w - 84) * Math.min(1, state.bustTimer / 3), 10);
  }

  function drawMessage(state) {
    if (state.messageTimer <= 0 || !state.message) return;
    const { width } = size();
    context.font = font(18, '600');
    const w = context.measureText(state.message).width + 32;
    panel((width - w) / 2, 130, w, 38);
    text(state.message, width / 2, 155, 18, PALETTE.text, 'center', '600');
  }

  function drawBanner(state) {
    if (state.missions.bannerTimer <= 0 || !state.missions.banner) return;
    const { width } = size();
    const banner = state.missions.banner;
    context.font = font(17, '600');
    const w = Math.min(720, context.measureText(banner).width + 40);
    // Wrap the brief onto lines of at most 90 characters.
    const words = banner.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 90) {
        lines.push(line.trim());
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    if (line) lines.push(line);
    const h = 24 + lines.length * 24;
    panel((width - w) / 2, 176, w, h);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], width / 2, 176 + 30 + i * 24, 17, PALETTE.text, 'center', i === 0 ? '700' : '400');
    }
  }

  function drawHint(state) {
    const { width, height } = size();
    const player = state.player;
    if (player.car) return;
    const car = state.cars.find((c) => !c.wreck && Math.hypot(c.x - player.x, c.y - player.y) < 70);
    if (!car) return;
    text('Press E to drive the ' + car.name, width / 2, height - 96, 16, PALETTE.text, 'center', '600');
  }

  /** The full HUD over a playing frame. */
  function drawHud(state, target) {
    const { ratio } = size();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawStats(state);
    drawObjective(state);
    drawSpeed(state);
    drawMinimap(state, target);
    drawBustMeter(state);
    drawMessage(state);
    drawBanner(state);
    drawHint(state);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMenu(title, lines, prompt, accent) {
    const { width, height, ratio } = size();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = 'rgba(13,17,23,0.82)';
    context.fillRect(0, 0, width, height);
    const w = 620;
    const h = 150 + lines.length * 30 + 70;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    panel(x, y, w, h);
    text(title, width / 2, y + 62, 44, accent || PALETTE.accent, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], width / 2, y + 112 + i * 30, 17, i === 0 ? PALETTE.text : PALETTE.muted, 'center', i === 0 ? '600' : '400');
    }
    text(prompt, width / 2, y + h - 26, 19, PALETTE.star, 'center', '700');
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawTitle(state, hasSave) {
    const lines = [
      'An open-world crime story in the sun-soaked city of Solmar.',
      'Drive, steal, run from the law, and work off a debt — five jobs.',
      '',
      'WASD / Arrows — move & drive      Shift — run      Space — handbrake',
      'E — enter / exit a car      Mouse — aim      Click — shoot',
      'P — pause      M — mute      R — restart the current job',
    ];
    const prompt = hasSave ? 'Enter — continue your game     N — new game' : 'Enter or click — new game';
    drawMenu('SOLMAR', lines, prompt, PALETTE.accent);
    // The city's name above the panel, in the menu's own accent.
    const { width, height, ratio } = size();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    text('City of Gold', width / 2, height / 2 - 220, 20, PALETTE.muted, 'center', '600');
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawPaused() {
    drawMenu('Paused', ['The city waits for you.', '', 'P or Esc — resume', 'M — mute sound', 'S — save and keep playing'], 'P — resume', PALETTE.text);
  }

  function drawOver(state) {
    const lines = [
      state.player.busted ? 'Detective Kane finally caught up with Jax.' : 'Jax went down in the streets of Solmar.',
      '',
      'Money kept: $' + state.player.money.toLocaleString('en-US'),
      'Jobs done: ' + state.missions.index + ' of 5',
    ];
    drawMenu(state.player.busted ? 'BUSTED' : 'WASTED', lines, 'Enter — retry the job     R — restart the story', state.player.busted ? '#3b82ff' : PALETTE.danger);
  }

  function drawComplete(state) {
    drawMenu('THE DEBT IS PAID', ['Solmar is yours, Jax. The city keeps turning —', 'drive it, own it, and keep the change.', '', 'Money: $' + state.player.money.toLocaleString('en-US')], 'Enter — keep playing', PALETTE.star);
  }

  return { drawHud, drawTitle, drawPaused, drawOver, drawComplete };
}
