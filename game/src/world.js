// world.js — the city of Porto Lumen: its roads, blocks, buildings, parks,
// beach and districts, all generated once from a fixed seed so the map is
// the same on every load. It also answers collision questions: is a point
// on a road, in the sea, or inside a building.
import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, WATER_Y, SAND_Y, SIDEWALK, PALETTE } from './config.js';
import { mulberry32, pick, range, int } from './random.js';

// Named districts, each a rectangle with a label the HUD shows as you enter it.
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1000, h: 800 },
  { name: 'Porto Centro', x: 1000, y: 0, w: 1200, h: 1000 },
  { name: 'Vista Hills', x: 2200, y: 0, w: 1400, h: 900 },
  { name: 'The Docks', x: 2200, y: 900, w: 1400, h: 1500 },
  { name: 'Marina', x: 0, y: 800, w: 1000, h: 1600 },
  { name: 'Southside', x: 1000, y: 1000, w: 1200, h: 1400 },
  { name: 'Lumen Beach', x: 0, y: 2400, w: 3600, h: 400 },
];

// Landmarks the missions and the HUD point at. Each is a named spot on the map.
export const LANDMARKS = {
  safehouse: { name: 'Safehouse', x: 1500, y: 1300, radius: 70 },
  respray: { name: 'Spray & Go', x: 2700, y: 600, radius: 70 },
  hospital: { name: 'St. Lumen Hospital', x: 700, y: 950, radius: 70 },
  gunshop: { name: 'Ammo Depot', x: 1900, y: 2000, radius: 70 },
  garage: { name: "Vera's Garage", x: 1100, y: 1650, radius: 80 },
  pier: { name: 'Lumen Pier', x: 1500, y: 2500, radius: 80 },
  stadium: { name: 'Porto Stadium', x: 3100, y: 1650, radius: 90 },
  plaza: { name: 'Plaza del Sol', x: 1500, y: 600, radius: 90 },
};

export function buildWorld() {
  const rng = mulberry32(20261124);
  const buildings = [];
  const trees = [];
  const parks = [];

  // The blocks between roads. Each block gets one or two buildings, or a park.
  const xs = [0, ...AVENUES, WORLD_W];
  const ys = [0, ...STREETS, SAND_Y];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx0 = xs[bi] + (bi === 0 ? 0 : ROAD_W / 2 + SIDEWALK);
      const bx1 = xs[bi + 1] - (bi === xs.length - 2 ? 0 : ROAD_W / 2 + SIDEWALK);
      const by0 = ys[bj] + (bj === 0 ? 0 : ROAD_W / 2 + SIDEWALK);
      const by1 = ys[bj + 1] - (bj === ys.length - 2 ? 0 : ROAD_W / 2 + SIDEWALK);
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 90 || bh < 90) continue;
      // A few blocks are parks, with trees instead of buildings.
      if (rng() < 0.14) {
        parks.push({ x: bx0, y: by0, w: bw, h: bh });
        const n = int(rng, 6, 12);
        for (let t = 0; t < n; t++) {
          trees.push({ x: range(rng, bx0 + 14, bx1 - 14), y: range(rng, by0 + 14, by1 - 14), r: range(rng, 9, 15) });
        }
        continue;
      }
      // Downtown blocks get taller, denser buildings.
      const downtown = bx0 > 1000 && bx0 < 2200 && by0 < 1000;
      const count = downtown ? int(rng, 2, 3) : int(rng, 1, 2);
      for (let k = 0; k < count; k++) {
        const w = range(rng, 70, Math.min(170, bw - 16));
        const h = range(rng, 60, Math.min(150, bh - 16));
        const x = range(rng, bx0 + 6, bx1 - w - 6);
        const y = range(rng, by0 + 6, by1 - h - 6);
        const b = { x, y, w, h, color: pick(rng, PALETTE.buildingRoof), tall: downtown && rng() < 0.5 };
        // Keep buildings from overlapping each other.
        if (buildings.some((o) => rectsOverlap(b, o, 8))) continue;
        // Keep the landmark spots clear of buildings.
        if (Object.values(LANDMARKS).some((lm) => dist(x + w / 2, y + h / 2, lm.x, lm.y) < lm.radius + 60)) continue;
        buildings.push(b);
      }
      // A tree or two on the block's edge.
      if (rng() < 0.5) trees.push({ x: range(rng, bx0 + 12, bx1 - 12), y: range(rng, by0 + 12, by1 - 12), r: range(rng, 8, 12) });
    }
  }
  return { buildings, trees, parks };
}

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w + pad && a.x + a.w + pad > b.x - pad && a.y - pad < b.y + b.h + pad && a.y + a.h + pad > b.y - pad;
}
function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Porto Lumen';
}

export function isWater(x, y) {
  return y > WATER_Y;
}
export function isSand(x, y) {
  return y > SAND_Y && y <= WATER_Y;
}

// Is the point on a road (within the asphalt, not the sidewalk)?
export function isRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

// The nearest road centre in each direction, used by traffic to pick a lane.
export function nearestAvenue(x) {
  let best = AVENUES[0];
  for (const ax of AVENUES) if (Math.abs(ax - x) < Math.abs(best - x)) best = ax;
  return best;
}
export function nearestStreet(y) {
  let best = STREETS[0];
  for (const sy of STREETS) if (Math.abs(sy - y) < Math.abs(best - y)) best = sy;
  return best;
}

// Push a circle out of every building it overlaps. Returns true if it hit one.
export function collideBuildings(world, x, y, radius) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = radius - d;
      // The caller moves the circle by the returned offset.
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
  }
  return { x, y, hit };
}

// Keep a point inside the world and out of the sea.
export function clampToWorld(x, y, radius) {
  x = Math.max(radius, Math.min(WORLD_W - radius, x));
  y = Math.max(radius, Math.min(WATER_Y - radius, y));
  return { x, y };
}
