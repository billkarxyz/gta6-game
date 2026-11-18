// missions.js — the story of Porto Lumen and its five jobs for Vera
// Castellanos, the fixer who runs the city's drivers. Each mission is a
// small chain of objectives: drive to a marker, steal a car, lose the cops,
// collect packages, outrun a chase. Completing one pays cash and unlocks
// the next; getting busted or wasted fails it. Between jobs, taxi fares
// appear around the city for quick money.
import { LANDMARKS } from './world.js';
import { createCar } from './traffic.js';
import { sfx } from './audio.js';

export const MISSIONS = [
  {
    title: 'The First Job',
    brief: 'Vera needs a driver she can trust. Pick up her contact at the plaza and take him to the garage. No cops, no drama.',
    reward: 300,
  },
  {
    title: 'Hot Wheels',
    brief: 'A sports car is parked by the stadium, keys in it, owner nowhere. Bring it to the garage. The police may disagree.',
    reward: 500,
  },
  {
    title: 'Lose the Heat',
    brief: 'Vera\'s last driver left you his wanted level: three stars. Lose the cops — hide, or pay for a respray — and come back clean.',
    reward: 400,
  },
  {
    title: 'The Package',
    brief: 'Three packages are waiting around the city. Collect them all within three minutes. Vera pays for speed.',
    reward: 600,
  },
  {
    title: 'The Getaway',
    brief: 'The whole force is on you — four stars. Make it to the safehouse alive, and the city is yours.',
    reward: 1000,
  },
];

export function createMissions() {
  return {
    index: 0, // the next mission to start
    state: 'idle', // idle | active | done | failed
    step: 0,
    timer: 0,
    target: null, // {x, y, label} for the HUD arrow and minimap
    packages: [],
    collected: 0,
    missionCar: null,
    fare: null, // a taxi fare: {pickup, drop, paid}
    fareTimer: 20,
    completed: 0,
    storyDone: false,
  };
}

function setTarget(game, x, y, label) {
  game.missions.target = { x, y, label };
}

export function missionObjective(game) {
  const m = game.missions;
  if (m.state !== 'active') return null;
  const titles = [
    ['Pick up Vera\'s contact at Plaza del Sol', 'Drive him to Vera\'s Garage'],
    ['Steal the sports car at the stadium', 'Deliver it to Vera\'s Garage'],
    ['Lose your wanted level'],
    ['Collect the packages: ' + m.collected + ' of 3'],
    ['Reach the safehouse — the cops are on you'],
  ];
  return titles[m.index] ? titles[m.index][m.step] : null;
}

// The player starts the next mission at Vera's garage.
export function tryStartMission(game) {
  const m = game.missions;
  if (m.state !== 'idle') return false;
  if (m.index >= MISSIONS.length) return false;
  const g = LANDMARKS.garage;
  if (Math.hypot(game.player.x - g.x, game.player.y - g.y) > g.radius + 20) return false;
  startMission(game, m.index);
  return true;
}

function startMission(game, index) {
  const m = game.missions;
  m.state = 'active';
  m.step = 0;
  m.timer = 0;
  m.collected = 0;
  m.packages = [];
  m.missionCar = null;
  const mission = MISSIONS[index];
  game.toast(mission.title + ' — ' + mission.brief);
  if (index === 0) {
    setTarget(game, LANDMARKS.plaza.x, LANDMARKS.plaza.y, 'Pickup');
  } else if (index === 1) {
    // The sports car waits in the stadium lot.
    const car = createCar(LANDMARKS.stadium.x, LANDMARKS.stadium.y + 40, 0, 'sports', 'parked');
    car.missionCar = true;
    car.color = '#d9a521';
    game.cars.push(car);
    m.missionCar = car;
    setTarget(game, car.x, car.y, 'Steal the car');
  } else if (index === 2) {
    game.player.heat = 300;
    game.player.wanted = 3;
    setTarget(game, LANDMARKS.respray.x, LANDMARKS.respray.y, 'Respray — or hide');
  } else if (index === 3) {
    m.timer = 180;
    m.packages = [
      { x: 300, y: 250, got: false },
      { x: 3100, y: 2350, got: false },
      { x: 700, y: 2000, got: false },
    ];
    setTarget(game, m.packages[0].x, m.packages[0].y, 'Package 1 of 3');
  } else if (index === 4) {
    game.player.heat = 400;
    game.player.wanted = 4;
    setTarget(game, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y, 'Safehouse');
  }
  sfx.click(game.audio);
}

function completeMission(game) {
  const m = game.missions;
  const mission = MISSIONS[m.index];
  game.player.money += mission.reward;
  m.completed += 1;
  m.index += 1;
  m.state = 'idle';
  m.target = null;
  game.toast('Mission complete: ' + mission.title + ' — +$' + mission.reward);
  sfx.mission(game.audio);
  if (m.index >= MISSIONS.length) {
    m.storyDone = true;
    game.toast('Story complete! Porto Lumen is yours. Fares still pay around the city.');
  }
  game.save();
}

function failMission(game, reason) {
  const m = game.missions;
  m.state = 'failed';
  m.target = null;
  game.toast('Mission failed: ' + reason + '. Return to the garage to retry.');
  sfx.fail(game.audio);
}

export function updateMissions(game, dt) {
  const m = game.missions;
  const p = game.player;
  // A busted or wasted player fails the active mission.
  if (m.state === 'active' && (p.dead || p.busted)) {
    failMission(game, p.dead ? 'wasted' : 'busted');
    return;
  }
  if (m.state === 'active') {
    if (m.index === 0) {
      if (m.step === 0) {
        if (near(p, LANDMARKS.plaza, 60)) {
          m.step = 1;
          game.toast('Contact picked up. Take him to Vera\'s Garage.');
          setTarget(game, LANDMARKS.garage.x, LANDMARKS.garage.y, 'Garage');
        }
      } else if (near(p, LANDMARKS.garage, 80)) {
        completeMission(game);
      }
    } else if (m.index === 1) {
      if (m.step === 0) {
        if (!p.onFoot && p.car === m.missionCar) {
          m.step = 1;
          game.toast('You have the car. Deliver it to Vera\'s Garage.');
          setTarget(game, LANDMARKS.garage.x, LANDMARKS.garage.y, 'Garage');
        }
      } else if (near(p, LANDMARKS.garage, 80)) {
        completeMission(game);
      }
    } else if (m.index === 2) {
      if (p.wanted === 0) completeMission(game);
    } else if (m.index === 3) {
      m.timer -= dt;
      if (m.timer <= 0) {
        failMission(game, 'out of time');
        return;
      }
      for (const pkg of m.packages) {
        if (!pkg.got && Math.hypot(p.x - pkg.x, p.y - pkg.y) < 50) {
          pkg.got = true;
          m.collected += 1;
          sfx.pickup(game.audio);
          game.toast('Package ' + m.collected + ' of 3 collected.');
          const next = m.packages.find((q) => !q.got);
          if (next) setTarget(game, next.x, next.y, 'Package ' + (m.collected + 1) + ' of 3');
        }
      }
      if (m.collected >= 3) completeMission(game);
    } else if (m.index === 4) {
      if (near(p, LANDMARKS.safehouse, 70)) completeMission(game);
    }
  }
  // Taxi fares: between missions, a fare appears and pays for a quick drive.
  if (m.state !== 'active') {
    m.fareTimer -= dt;
    if (!m.fare && m.fareTimer <= 0 && m.completed > 0) {
      m.fare = makeFare(game);
      m.fareTimer = 45;
    }
    if (m.fare) updateFare(game, dt);
  }
}

function near(p, spot, radius) {
  return Math.hypot(p.x - spot.x, p.y - spot.y) < radius;
}

function makeFare(game) {
  const spots = [
    { x: 300, y: 250 }, { x: 3100, y: 600 }, { x: 700, y: 1650 },
    { x: 2700, y: 2000 }, { x: 1500, y: 950 }, { x: 1100, y: 2350 },
    { x: 2300, y: 1300 }, { x: 1900, y: 250 },
  ];
  const a = spots[Math.floor(Math.random() * spots.length)];
  let b = spots[Math.floor(Math.random() * spots.length)];
  while (b === a) b = spots[Math.floor(Math.random() * spots.length)];
  const pay = 60 + Math.floor(Math.random() * 90);
  game.toast('Fare available: pick up a passenger at the green marker. Pays $' + pay + '.');
  return { pickup: a, drop: b, pay, step: 0 };
}

function updateFare(game, dt) {
  const m = game.missions;
  const fare = m.fare;
  const p = game.player;
  if (fare.step === 0) {
    m.target = { x: fare.pickup.x, y: fare.pickup.y, label: 'Fare pickup' };
    if (Math.hypot(p.x - fare.pickup.x, p.y - fare.pickup.y) < 60 && !p.onFoot) {
      fare.step = 1;
      game.toast('Passenger aboard. Take them to the green marker.');
      sfx.pickup(game.audio);
    }
  } else {
    m.target = { x: fare.drop.x, y: fare.drop.y, label: 'Fare drop-off' };
    if (Math.hypot(p.x - fare.drop.x, p.y - fare.drop.y) < 60 && !p.onFoot) {
      p.money += fare.pay;
      game.toast('Fare complete — +$' + fare.pay);
      sfx.cash(game.audio);
      m.fare = null;
      m.target = null;
      m.fareTimer = 40;
    }
  }
}
