// Drawing only: the city's streets and buildings, the cars and people on them, the effects,
// and the light. The camera follows the player with a look-ahead in the direction of travel,
// and the world is drawn in a fixed logical height so the view is the same on every screen.
// Nothing here changes the game; it reads the state and paints pixels.
import { BEACH_Y, CAR, FONT, PALETTE, PLACES, ROAD_XS, ROAD_YS, WATER_Y, WORLD } from './config.js';

/** How many world units fill the screen's height. */
const VIEW_HEIGHT = 880;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, width: 0, height: 0 };
  const camera = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    view.scale = canvas.height / VIEW_HEIGHT;
    view.ratio = ratio;
  }

  const fonts = new Map();
  function font(size, weight) {
    const key = (weight || '') + size;
    if (!fonts.has(key)) fonts.set(key, (weight ? weight + ' ' : '') + size + 'px ' + FONT);
    return fonts.get(key);
  }

  /** Move the camera toward the player, looking ahead in the direction of travel. */
  function updateCamera(state, dt) {
    const player = state.player;
    const look = 90;
    const tx = player.x + Math.cos(player.angle) * look * Math.min(1, player.speed / 300);
    const ty = player.y + Math.sin(player.angle) * look * Math.min(1, player.speed / 300);
    const halfW = (view.width / view.scale / view.ratio) / 2;
    const halfH = VIEW_HEIGHT / 2;
    const k = 1 - Math.exp(-5 * dt);
    camera.x += (tx - camera.x) * k;
    camera.y += (ty - camera.y) * k;
    camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
    camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
  }

  function drawGround(state) {
    // Grass everywhere, then the beach and the sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, WATER_Y - BEACH_Y);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, WATER_Y, WORLD.width, WORLD.height - WATER_Y);
    // A lighter shoreline where the sea meets the sand.
    context.fillStyle = '#7fc4dd';
    context.fillRect(0, WATER_Y, WORLD.width, 10);
    // Parks: darker green with a path.
    for (const park of state.city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = '#c9b98a';
      context.fillRect(park.x + park.w / 2 - 4, park.y, 8, park.h);
    }
  }

  function drawRoads() {
    // Sidewalks first (a pale border around every road), then the asphalt.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROAD_XS) context.fillRect(rx - WORLD.roadWidth / 2 - 14, 0, WORLD.roadWidth + 28, BEACH_Y);
    for (const ry of ROAD_YS) context.fillRect(0, ry - WORLD.roadWidth / 2 - 14, WORLD.width, WORLD.roadWidth + 28);
    context.fillStyle = PALETTE.road;
    for (const rx of ROAD_XS) context.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, BEACH_Y);
    for (const ry of ROAD_YS) context.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    // Dashed centre lines.
    context.fillStyle = PALETTE.lane;
    for (const rx of ROAD_XS) {
      for (let y = 20; y < BEACH_Y; y += 60) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROAD_YS) {
      for (let x = 20; x < WORLD.width; x += 60) context.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalks at every intersection.
    context.fillStyle = '#d8d3c2';
    for (const rx of ROAD_XS) {
      for (const ry of ROAD_YS) {
        for (let i = -2; i <= 2; i += 1) {
          context.fillRect(rx - WORLD.roadWidth / 2 + 8 + i * 18, ry - WORLD.roadWidth / 2 - 12, 10, 8);
          context.fillRect(rx - WORLD.roadWidth / 2 + 8 + i * 18, ry + WORLD.roadWidth / 2 + 4, 10, 8);
        }
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      // A soft shadow, then the walls, the roof, and windows by floor.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.colour;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      context.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 10 + (c * (b.w - 20)) / Math.max(1, cols - 1) - 4, b.y + 10 + (r * (b.h - 20)) / Math.max(1, rows - 1) - 4, 8, 8);
        }
      }
    }
    // Named places get a sign: the garage, the spray shop, the safehouse.
    drawPlaceSign(PLACES.garage.x, PLACES.garage.y, 'GARAGE', '#f2a33c');
    drawPlaceSign(PLACES.spray.x, PLACES.spray.y, 'SPRAY', '#4fc3f7');
    drawPlaceSign(PLACES.safehouse.x, PLACES.safehouse.y, 'SAFEHOUSE', '#7ee081');
  }

  function drawPlaceSign(x, y, label, colour) {
    context.font = font(15, '700');
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const w = context.measureText(label).width + 18;
    context.fillStyle = 'rgba(13,17,23,0.85)';
    context.fillRect(x - w / 2, y - 34, w, 22);
    context.fillStyle = colour;
    context.fillText(label, x, y - 23);
  }

  function drawTrees(state) {
    for (const tree of state.city.trees) {
      context.fillStyle = 'rgba(0,0,0,0.15)';
      context.beginPath();
      context.arc(tree.x + 3, tree.y + 4, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = tree.palm ? '#4a9e4a' : PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSkids(state) {
    context.strokeStyle = 'rgba(20,20,20,0.5)';
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.beginPath();
    for (const skid of state.skids) {
      const dx = Math.cos(skid.angle) * 14;
      const dy = Math.sin(skid.angle) * 14;
      context.moveTo(skid.x - dx, skid.y - dy);
      context.lineTo(skid.x + dx, skid.y + dy);
    }
    context.stroke();
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(state.time * 3 + pickup.x) * 3;
      const colour = pickup.kind === 'health' ? '#7ee081' : pickup.kind === 'ammo' ? '#f2c94c' : '#4fc3f7';
      context.fillStyle = 'rgba(13,17,23,0.7)';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = colour;
      context.font = font(16, '700');
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(pickup.kind === 'health' ? '+' : pickup.kind === 'ammo' ? 'A' : '$', pickup.x, pickup.y + bob + 1);
    }
  }

  function drawCar(car, isPlayer, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-halfL + 3, -halfW + 4, CAR.length, CAR.width);
    // Body.
    context.fillStyle = car.wreck ? '#2c2c2c' : car.colour;
    context.beginPath();
    context.roundRect(-halfL, -halfW, CAR.length, CAR.width, 8);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = car.wreck ? '#1a1a1a' : '#bfe3ee';
    context.fillRect(4, -halfW + 5, 14, CAR.width - 10);
    context.fillRect(-18, -halfW + 5, 10, CAR.width - 10);
    // Headlights and brake lights.
    context.fillStyle = car.brakeLight ? '#ff3b30' : '#ffd94a';
    context.fillRect(halfL - 4, -halfW + 3, 4, 6);
    context.fillRect(halfL - 4, halfW - 9, 4, 6);
    context.fillStyle = '#ff3b30';
    context.fillRect(-halfL, -halfW + 3, 4, 6);
    context.fillRect(-halfL, halfW - 9, 4, 6);
    if (car.kind === 'police' && !car.wreck) {
      // The light bar flashes red and blue, alternating twice a second.
      const phase = Math.floor(time * 2) % 2 === 0;
      context.fillStyle = phase ? '#ff3b30' : '#3b82ff';
      context.fillRect(-6, -halfW + 2, 12, 10);
      context.fillStyle = phase ? '#3b82ff' : '#ff3b30';
      context.fillRect(-6, halfW - 12, 12, 10);
      context.fillStyle = '#f5f1e6';
      context.font = font(10, '700');
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('POLICE', 0, 0);
    }
    if (isPlayer) {
      // A small marker above the player's car so it is never lost in traffic.
      context.rotate(-car.angle);
      context.fillStyle = PALETTE.accent;
      context.beginPath();
      context.moveTo(0, -halfW - 18);
      context.lineTo(-7, -halfW - 6);
      context.lineTo(7, -halfW - 6);
      context.closePath();
      context.fill();
    }
    context.restore();
    // Smoke from a wreck is drawn by the particles; a wrecked car gets a scorch mark.
    if (car.wreck) {
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath();
      context.ellipse(car.x, car.y, 40, 26, car.angle, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPed(ped) {
    if (ped.down) {
      context.fillStyle = 'rgba(0,0,0,0.2)';
      context.beginPath();
      context.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ped.shirt;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 11, 6, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const swing = Math.sin(ped.walkPhase) * 4;
    const side = { x: -Math.sin(ped.angle), y: Math.cos(ped.angle) };
    // Legs swing as the pedestrian walks.
    context.fillStyle = ped.pants;
    context.beginPath();
    context.arc(ped.x + side.x * 4 + Math.cos(ped.angle) * swing, ped.y + side.y * 4 + Math.sin(ped.angle) * swing, 4, 0, Math.PI * 2);
    context.arc(ped.x - side.x * 4 - Math.cos(ped.angle) * swing, ped.y - side.y * 4 - Math.sin(ped.angle) * swing, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.shirt;
    context.beginPath();
    context.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.car) return;
    if (player.dead) {
      context.fillStyle = 'rgba(0,0,0,0.2)';
      context.beginPath();
      context.ellipse(player.x, player.y, 16, 10, player.angle, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.ellipse(player.x, player.y, 12, 7, player.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const aim = player.aimAngle;
    // Body, head, and the pistol pointing at the aim.
    context.fillStyle = '#2c3038';
    context.beginPath();
    context.arc(player.x, player.y, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(player.x + Math.cos(aim) * 3, player.y + Math.sin(aim) * 3, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#1a1a1a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(player.x + Math.cos(aim) * 6, player.y + Math.sin(aim) * 6);
    context.lineTo(player.x + Math.cos(aim) * 18, player.y + Math.sin(aim) * 18);
    context.stroke();
    // A marker above the player so they are never lost in a crowd.
    context.fillStyle = PALETTE.accent;
    context.beginPath();
    context.moveTo(player.x, player.y - 22);
    context.lineTo(player.x - 7, player.y - 10);
    context.lineTo(player.x + 7, player.y - 10);
    context.closePath();
    context.fill();
  }

  function drawBullets(state) {
    context.fillStyle = '#ffe9a8';
    for (const bullet of state.bullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.colour;
      context.beginPath();
      context.arc(p.x, p.y, p.size * (0.5 + 0.5 * (p.life / p.maxLife)), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawMissionMarker(state, target) {
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    // A beacon of light and a ring on the ground, visible from far away.
    context.fillStyle = 'rgba(242,163,60,0.25)';
    context.beginPath();
    context.arc(target.x, target.y, 60 * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.accent;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(target.x, target.y, 44 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.accent;
    context.beginPath();
    context.moveTo(target.x, target.y - 70);
    context.lineTo(target.x - 12, target.y - 40);
    context.lineTo(target.x + 12, target.y - 40);
    context.closePath();
    context.fill();
    // A column of light rising from the marker.
    const gradient = context.createLinearGradient(0, target.y - 220, 0, target.y);
    gradient.addColorStop(0, 'rgba(242,163,60,0)');
    gradient.addColorStop(1, 'rgba(242,163,60,0.35)');
    context.fillStyle = gradient;
    context.fillRect(target.x - 14, target.y - 220, 28, 220);
  }

  /** The time-of-day tint: warm at dawn and dusk, clear at noon, cool at night. */
  function drawLight(state) {
    const hour = (state.clock / 3600) % 24;
    let colour = null;
    let alpha = 0;
    if (hour >= 6 && hour < 9) { colour = '255,170,80'; alpha = 0.10; }
    else if (hour >= 17 && hour < 20) { colour = '255,140,60'; alpha = 0.12; }
    else if (hour >= 20 || hour < 6) { colour = '40,60,140'; alpha = 0.18; }
    if (!colour) return;
    context.fillStyle = 'rgba(' + colour + ',' + alpha + ')';
    context.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  /** Paint the world for one frame: the ground, the city, everything on it, the light. */
  function draw(state, missionTarget) {
    const ratio = view.ratio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const scale = view.scale;
    context.setTransform(scale, 0, 0, scale, (canvas.width / 2 - camera.x * scale) + shakeX * scale, (canvas.height / 2 - camera.y * scale) + shakeY * scale);
    drawGround(state);
    drawRoads();
    drawSkids(state);
    drawBuildings(state);
    drawTrees(state);
    drawPickups(state);
    drawMissionMarker(state, missionTarget);
    for (const car of state.cars) drawCar(car, car === state.player.car, state.time);
    for (const ped of state.peds) drawPed(ped);
    drawPlayer(state);
    drawBullets(state);
    drawParticles(state);
    drawLight(state);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, updateCamera, camera, view };
}
