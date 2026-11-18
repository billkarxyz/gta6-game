// The city of Solmar: its streets, blocks, buildings, parks and beach, built once from a fixed
// seed so every game plays the same city. The layout is a grid: roads every 400 units, blocks
// between them holding buildings or a park, and the sea along the south edge. The helpers here
// answer what the rest of the game asks about the ground: is this point a road, does this circle
// hit a building, which district is this, where is the nearest road.
import { BEACH_Y, CITY_SEED, DISTRICTS, PALETTE, PLACES, ROAD_XS, ROAD_YS, WATER_Y, WORLD } from './config.js';
import { createRandom, pickInt, pickOne } from './random.js';

const HALF_ROAD = WORLD.roadWidth / 2;
const BLOCK_MARGIN = 22;

/** True when the point is on a road (within half a road's width of a road centre line). */
export function isRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

/** True when the point is on a sidewalk: beside a road, but not on the road itself. */
export function isSidewalk(x, y) {
  const margin = HALF_ROAD + 14;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= margin && Math.abs(x - rx) > HALF_ROAD) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= margin && Math.abs(y - ry) > HALF_ROAD) return true;
  return false;
}

/** The district a point falls in, by the named regions of the map. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Solmar';
}

/** The nearest point on any road centre line to (x, y). */
export function nearestRoadPoint(x, y) {
  let bestX = ROAD_XS[0];
  let bestY = ROAD_YS[0];
  let best = Infinity;
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; bestX = rx; }
  }
  best = Infinity;
  for (const ry of ROAD_YS) {
    const d = Math.abs(y - ry);
    if (d < best) { best = d; bestY = ry; }
  }
  // The nearer of the closest vertical road and the closest horizontal road.
  return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
}

/**
 * Build the city: every block between the roads holds either buildings or a park, with trees.
 * A block is the rectangle between two neighbouring roads (or the map edge). The beach strip
 * and the water are drawn from the world's constants, not stored here.
 */
export function createCity() {
  const random = createRandom(CITY_SEED);
  const buildings = [];
  const parks = [];
  const trees = [];
  const blockXs = [0, ...ROAD_XS.map((x) => x + HALF_ROAD), WORLD.width];
  const blockYs = [0, ...ROAD_YS.map((y) => y + HALF_ROAD), BEACH_Y];
  // Block edges are the road edges: block i spans from the right edge of road i-1 to the left
  // edge of road i. Recompute them as (road centre + half road) to (next road centre - half road).
  const edgesX = [0];
  for (const rx of ROAD_XS) { edgesX.push(rx - HALF_ROAD, rx + HALF_ROAD); }
  edgesX.push(WORLD.width);
  const edgesY = [0];
  for (const ry of ROAD_YS) { edgesY.push(ry - HALF_ROAD, ry + HALF_ROAD); }
  edgesY.push(BEACH_Y);

  for (let bx = 0; bx < edgesX.length - 1; bx += 2) {
    for (let by = 0; by < edgesY.length - 1; by += 2) {
      const x0 = edgesX[bx] + BLOCK_MARGIN;
      const y0 = edgesY[by] + BLOCK_MARGIN;
      const x1 = edgesX[bx + 1] - BLOCK_MARGIN;
      const y1 = edgesY[by + 1] - BLOCK_MARGIN;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      // A few blocks are parks; the rest hold buildings. The block around the plaza is a park.
      const isPlaza = Math.abs((x0 + x1) / 2 - PLACES.plaza.x) < 250 && Math.abs((y0 + y1) / 2 - PLACES.plaza.y) < 250;
      if (isPlaza || random() < 0.16) {
        parks.push({ x: x0, y: y0, w, h });
        const count = pickInt(random, 6, 12);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 14 + random() * (w - 28), y: y0 + 14 + random() * (h - 28), r: 9 + random() * 7 });
        }
        continue;
      }
      // One to four buildings in the block, split along its longer side.
      const splits = w > h ? pickInt(random, 1, 3) : pickInt(random, 1, 2);
      for (let i = 0; i < splits; i += 1) {
        const horizontal = w > h;
        const bw = horizontal ? w / splits - 14 : w - 14;
        const bh = horizontal ? h - 14 : h / splits - 14;
        const bx0 = horizontal ? x0 + (i * w) / splits + 7 : x0 + 7;
        const by0 = horizontal ? y0 + 7 : y0 + (i * h) / splits + 7;
        if (bw < 40 || bh < 40) continue;
        const colour = pickInt(random, 0, PALETTE.building.length - 1);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          colour: PALETTE.building[colour],
          roof: PALETTE.roof[colour],
          floors: pickInt(random, 1, 5),
        });
      }
      // A tree or two on the block's corners.
      if (random() < 0.6) trees.push({ x: x0 + 10, y: y0 + 10, r: 8 + random() * 5 });
      if (random() < 0.6) trees.push({ x: x1 - 10, y: y1 - 10, r: 8 + random() * 5 });
    }
  }
  // Palm trees along the beach.
  for (let x = 60; x < WORLD.width; x += 90 + random() * 60) {
    trees.push({ x, y: BEACH_Y + 18 + random() * 40, r: 10 + random() * 4, palm: true });
  }
  return { buildings, parks, trees, blockXs, blockYs };
}

/**
 * Push a circle out of every building it overlaps and out of the water and the map edge.
 * Returns the corrected position; the caller keeps its own velocity.
 */
export function collideCircle(city, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx;
    const dy = py - ny;
    const dist2 = dx * dx + dy * dy;
    if (dist2 >= radius * radius) continue;
    if (dist2 === 0) {
      // The centre is inside the building: push it out along the shortest side.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = b.x - radius;
      else if (min === right) px = b.x + b.w + radius;
      else if (min === top) py = b.y - radius;
      else py = b.y + b.h + radius;
      continue;
    }
    const dist = Math.sqrt(dist2);
    px = nx + (dx / dist) * radius;
    py = ny + (dy / dist) * radius;
  }
  px = Math.max(radius, Math.min(WORLD.width - radius, px));
  py = Math.max(radius, Math.min(WATER_Y - radius - 6, py));
  return { x: px, y: py };
}

/** True when a circle of the given radius at (x, y) overlaps any building. */
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}
