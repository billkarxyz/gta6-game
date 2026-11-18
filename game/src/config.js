// Every tuning number, colour and name in one place. The world is a fixed 3600x2800 city;
// the renderer scales a camera view of it to the window, so no rule depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city of Solmar: a sun-soaked coastal grid, roads every 400 units, beach along the south. */
export const WORLD = { width: 3600, height: 2800, roadWidth: 100, roadGap: 400 };
export const ROAD_XS = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROAD_YS = [300, 700, 1100, 1500, 1900, 2300];
/** South of this the beach starts; south of the water line is the sea, out of bounds. */
export const BEACH_Y = 2500;
export const WATER_Y = 2660;

/** The seed that builds the city itself: the same streets, buildings and parks every game. */
export const CITY_SEED = 20261119;

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1500, y1: 1100 },
  { name: 'Harbor Heights', x0: 1500, y0: 0, x1: 3600, y1: 1100 },
  { name: 'Downtown', x0: 0, y0: 1100, x1: 2000, y1: 1900 },
  { name: 'Palm District', x0: 0, y0: 1900, x1: 1500, y1: 2500 },
  { name: 'The Docks', x0: 2000, y0: 1100, x1: 3600, y1: 2500 },
  { name: 'Marina Bay', x0: 0, y0: 2500, x1: 3600, y1: 2800 },
];

/** Named places the story and the HUD point at. */
export const PLACES = {
  garage: { name: "Lena's Garage", x: 1500, y: 1100 },
  spray: { name: 'Spray Shop', x: 700, y: 1900 },
  safehouse: { name: 'Safehouse', x: 2700, y: 700 },
  docks: { name: 'Pier 9', x: 3100, y: 2300 },
  plaza: { name: 'Solmar Plaza', x: 1100, y: 1500 },
  marina: { name: 'Marina', x: 1900, y: 2500 },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 300,
  maxHealth: 100,
  enterRange: 70,
  startX: 1500,
  startY: 1180,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 620,
  maxReverse: 180,
  turnRate: 2.6,
  grip: 6.5,
  handbrakeGrip: 1.6,
  maxHealth: 100,
  enterRange: 70,
};

export const TRAFFIC = {
  count: 22,
  speed: 150,
  speedJitter: 60,
  minGap: 90,
};

export const PEDS = { count: 40, walkSpeed: 55, fleeSpeed: 190, fleeRadius: 220 };

export const POLICE = {
  /** Police cars on the hunt at each wanted level (index = stars). */
  chaseCount: [0, 2, 3, 4, 5, 6],
  speed: 560,
  ramDamage: 8,
  /** Seconds a cop must stay beside a slow player to bust them. */
  bustTime: 3,
  bustRange: 90,
  bustSpeed: 60,
  /** Seconds out of every cop's sight before one star drops. */
  decaySeconds: 12,
  sightRange: 620,
};

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  hitPolice: 2,
  killPolice: 1,
  max: 5,
  sprayCost: 100,
};

export const COMBAT = {
  bulletSpeed: 900,
  bulletLife: 0.9,
  fireInterval: 0.22,
  pistolDamage: 34,
  carRamDamage: 12,
  explosionRadius: 130,
  explosionDamage: 80,
  ammoPickup: 24,
  healthPickup: 40,
};

export const PICKUPS = {
  health: { count: 8, color: '#7ee081' },
  ammo: { count: 8, color: '#f2c94c' },
  money: { count: 10, color: '#4fc3f7' },
  moneyValue: 50,
};

export const CAMERA = { lookAhead: 90, smoothing: 5 };

export const PALETTE = {
  backdrop: '#0d1117',
  grass: '#7fae5a',
  park: '#6da34e',
  sand: '#e8d29a',
  water: '#2e7fa8',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  sidewalk: '#9aa0a8',
  lane: '#e8e3c8',
  building: ['#c96f4a', '#d9a441', '#7d9bb5', '#b5b5a8', '#a86a8f', '#6f9e7e', '#c9c2b4', '#8a7fb8'],
  roof: ['#8a4a30', '#a87a2e', '#5a748c', '#8c8c7e', '#7d4a68', '#4f7a5c', '#9a9284', '#655a92'],
  window: '#ffe9a8',
  tree: '#3f7a3a',
  player: '#f2c94c',
  playerCar: '#e5534b',
  police: '#2f6fd0',
  policeLight: ['#ff3b30', '#3b82ff'],
  text: '#f5f1e6',
  muted: '#b9b3a3',
  panel: '#171a20',
  accent: '#f2a33c',
  star: '#ffd94a',
  health: '#7ee081',
  danger: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-city.save.v1';

/** The game's own names: the city, the player, and the people of its story. */
export const STORY = {
  city: 'Solmar',
  player: 'Jax Marlow',
  fixer: 'Lena Ortiz',
  dealer: 'Tomas Ruiz',
  detective: 'Detective Rosa Kane',
};
