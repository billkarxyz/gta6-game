// config.js — tuning and constants for Porto Lumen, the game's city.
// Everything that shapes how the city looks and how the game feels lives here,
// so the other files read numbers from this one place instead of inventing them.
export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const ROAD_W = 96;
export const AVENUES = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const STREETS = [250, 600, 950, 1300, 1650, 2000, 2350];
export const WATER_Y = 2520; // below this line is the sea
export const SAND_Y = 2405; // sand starts here, water below WATER_Y
export const SIDEWALK = 18; // sidewalk width along each road

// The player on foot.
export const WALK_SPEED = 175;
export const RUN_SPEED = 300;
export const PLAYER_RADIUS = 13;

// Cars: arcade handling. Each type has a top speed, acceleration and grip.
export const CAR_TYPES = {
  sedan: { top: 330, accel: 230, grip: 2.6, len: 46, wid: 22, health: 100 },
  taxi: { top: 320, accel: 220, grip: 2.6, len: 46, wid: 22, health: 100 },
  sports: { top: 460, accel: 330, grip: 3.1, len: 48, wid: 22, health: 80 },
  truck: { top: 250, accel: 150, grip: 2.1, len: 58, wid: 26, health: 160 },
  van: { top: 270, accel: 170, grip: 2.2, len: 54, wid: 24, health: 130 },
  police: { top: 420, accel: 310, grip: 3.0, len: 48, wid: 22, health: 140 },
};
export const CAR_COLORS = ['#d8d3c8', '#b3402e', '#2e6db3', '#d9a521', '#3e8e5a', '#7a4a9e', '#c96a2e', '#4a4a52', '#e8e4da', '#2e8e8e'];
export const TRAFFIC_COUNT = 22;
export const PED_COUNT = 38;

// Wanted system: heat points turn into stars; police pressure follows the stars.
export const HEAT_PER_STAR = 100;
export const HEAT_STEAL = 60; // stealing a car while a cop can see it
export const HEAT_HIT_PED = 80;
export const HEAT_SHOOT = 40;
export const HEAT_KILL_COP = 200;
export const HEAT_RAM_COP = 70;
export const RESPRAY_COST = 100;
export const COP_VIEW = 520; // a cop this close sees the player's crimes

// Combat and pickups.
export const PISTOL_DAMAGE = 34;
export const PISTOL_MAG = 12;
export const PISTOL_RANGE = 420;
export const PICKUP_RADIUS = 26;

// The clock: the game starts at 08:00 and one game hour passes every 100 real seconds.
export const CLOCK_START = 8 * 3600;
export const CLOCK_RATE = 36; // game seconds per real second

// Sun-soaked palette. The city is drawn in warm light: pale roads, sand sidewalks,
// pastel buildings, a turquoise sea.
export const PALETTE = {
  ground: '#c9b896', // bare earth between blocks
  road: '#4a4a52',
  roadLine: '#d8d3c8',
  sidewalk: '#d9cba8',
  sand: '#e8d9a8',
  sea: '#2e8fb3',
  seaDeep: '#1e6d8c',
  park: '#6da85c',
  parkDark: '#558a48',
  plaza: '#cbb98e',
  buildingRoof: ['#e8dcc8', '#d9a08e', '#a8c8c8', '#e8d18a', '#c8b8d8', '#b8d0a8', '#d8b090', '#c8ccd8'],
  buildingEdge: 'rgba(0,0,0,0.25)',
};
