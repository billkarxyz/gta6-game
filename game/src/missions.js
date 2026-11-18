// The story of Solmar and its missions. Jax Marlow, a driver new to the city, owes a debt to
// Lena Ortiz, a fixer who runs jobs out of her garage in Downtown. Five jobs pay the debt off,
// each one a short chain of objectives: drive somewhere, pick something up, lose the law, get
// away clean. A mission is a list of stages; each stage is a place to reach, a wait, a heat to
// lose, or a set of drops to collect. Completing a stage pays nothing; completing the job pays
// its reward. Failing (a timer, a wreck, the law) restarts the job from its first stage.
import { PLACES, STORY } from './config.js';
import { addWanted, clearWanted } from './police.js';

/** The five jobs, in story order. Each stage names its objective in plain words. */
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: STORY.fixer,
    brief: 'Jax, you need wheels before you need anything. Take a car — any car — and bring it to my garage. Try not to bring the law with you.',
    reward: 300,
    stages: [
      { type: 'car', text: 'Get in a car (press E beside one)' },
      { type: 'goto', text: "Drive to Lena's Garage", target: PLACES.garage, radius: 90 },
    ],
  },
  {
    id: 'the-package',
    title: 'The Package',
    giver: STORY.fixer,
    brief: 'A package is waiting at Solmar Plaza. Pick it up and take it to Pier 9. The buyer does not wait: two minutes, or the deal is dead.',
    reward: 500,
    stages: [
      { type: 'goto', text: 'Drive to Solmar Plaza', target: PLACES.plaza, radius: 90 },
      { type: 'wait', text: 'Picking up the package…', target: PLACES.plaza, radius: 90, seconds: 2 },
      { type: 'goto', text: 'Deliver the package to Pier 9', target: PLACES.docks, radius: 90, timeLimit: 120 },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: STORY.dealer,
    brief: 'Tomas here. The law has your plate from the plaza job — two stars, and they are coming. Lose them. Break line of sight, or pay the Spray Shop to make you invisible.',
    reward: 600,
    onStart: 'heat2',
    stages: [
      { type: 'lose-heat', text: 'Lose the police (wanted level to zero)' },
    ],
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    giver: STORY.fixer,
    brief: "I'm in the car with you, Jax. Detective Kane has the whole precinct out — three stars. Get us to the safehouse in one piece. Do not stop. Do not get caught.",
    reward: 900,
    onStart: 'heat3',
    stages: [
      { type: 'goto', text: 'Drive Lena to the Safehouse', target: PLACES.safehouse, radius: 90 },
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: STORY.fixer,
    brief: 'Last job, Jax, and the debt is done. Three cash drops around the city — the Marina, the Docks, the Plaza. Grab them all and bring it home to the garage. The law will be watching.',
    reward: 1500,
    onStart: 'heat1',
    stages: [
      { type: 'collect', text: 'Collect the cash drops (0 of 3)', targets: [PLACES.marina, PLACES.docks, PLACES.plaza], radius: 90 },
      { type: 'goto', text: 'Bring the money home to the garage', target: PLACES.garage, radius: 90 },
    ],
  },
];

/** A fresh mission tracker: the first job, its first stage, nothing collected yet. */
export function createMissions() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    collected: 0,
    banner: '',
    bannerTimer: 0,
    failed: false,
    failedReason: '',
    complete: false,
    started: false,
  };
}

/** The current job, or null when the story is done. */
export function currentMission(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

/** The current stage of the current job. */
export function currentStage(missions) {
  const mission = currentMission(missions);
  return mission ? mission.stages[missions.stage] : null;
}

/** The map marker the HUD and minimap point at right now, or null. */
export function missionTarget(missions) {
  const stage = currentStage(missions);
  if (!stage) return null;
  if (stage.type === 'goto' || stage.type === 'wait') return stage.target;
  if (stage.type === 'collect') return stage.targets[missions.collected] || null;
  return null;
}

/** Start the current job: show its brief and apply its opening heat. */
export function startMission(state) {
  const missions = state.missions;
  const mission = currentMission(missions);
  if (!mission) return;
  missions.started = true;
  missions.stage = 0;
  missions.timer = 0;
  missions.collected = 0;
  missions.failed = false;
  missions.banner = mission.title + ' — ' + mission.brief;
  missions.bannerTimer = 6;
  if (mission.onStart === 'heat1') addWanted(state, 1, 'the job drew attention');
  if (mission.onStart === 'heat2') addWanted(state, 2, 'the law has your plate');
  if (mission.onStart === 'heat3') addWanted(state, 3, 'the whole precinct is out');
  state.audio.sirenBlip();
}

/** Fail the current job with a reason; the player retries from its first stage. */
function failMission(state, reason) {
  const missions = state.missions;
  missions.failed = true;
  missions.failedReason = reason;
  missions.banner = 'Mission failed: ' + reason;
  missions.bannerTimer = 5;
  state.audio.fail();
}

/** Finish the current job: pay the reward, clear the heat, move to the next. */
function completeMission(state) {
  const missions = state.missions;
  const mission = currentMission(missions);
  state.player.money += mission.reward;
  clearWanted(state);
  missions.index += 1;
  missions.stage = 0;
  missions.timer = 0;
  missions.collected = 0;
  missions.started = false;
  if (missions.index >= MISSIONS.length) {
    missions.complete = true;
    missions.banner = 'The debt is paid. Solmar is yours, Jax — free roam, and keep the change.';
    missions.bannerTimer = 8;
  } else {
    missions.banner = 'Job done: ' + mission.title + ' — +$' + mission.reward + '. Next job coming up.';
    missions.bannerTimer = 5;
  }
  state.audio.mission();
}

/** One step of the story: check the current stage, advance it, or fail the job. */
export function updateMissions(state, dt) {
  const missions = state.missions;
  const player = state.player;
  if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
  if (missions.complete || player.dead || player.busted) return;
  const mission = currentMission(missions);
  if (!mission) return;
  if (!missions.started) {
    // The next job starts a few seconds after the last one ended.
    if (missions.bannerTimer <= 0) startMission(state);
    return;
  }
  if (missions.failed) {
    if (missions.bannerTimer <= 0) {
      missions.failed = false;
      startMission(state);
    }
    return;
  }
  const stage = currentStage(missions);
  if (!stage) {
    completeMission(state);
    return;
  }
  missions.timer += dt;
  const dist = (target) => Math.hypot(player.x - target.x, player.y - target.y);
  if (stage.type === 'car') {
    if (player.car) missions.stage += 1;
  } else if (stage.type === 'goto' || stage.type === 'wait') {
    if (dist(stage.target) < stage.radius) {
      if (stage.type === 'goto') {
        missions.stage += 1;
        missions.timer = 0;
        state.audio.pickup();
      } else if (missions.timer >= stage.seconds) {
        missions.stage += 1;
        missions.timer = 0;
        state.audio.pickup();
      }
    } else if (stage.type === 'wait') {
      missions.timer = 0;
    }
    if (stage.timeLimit && missions.timer > stage.timeLimit) {
      failMission(state, 'the buyer walked away — too slow');
    }
  } else if (stage.type === 'collect') {
    const target = stage.targets[missions.collected];
    if (target && dist(target) < stage.radius) {
      missions.collected += 1;
      state.player.money += 200;
      state.audio.cash();
      if (missions.collected >= stage.targets.length) {
        missions.stage += 1;
        missions.timer = 0;
      }
    }
  } else if (stage.type === 'lose-heat') {
    if (state.wanted === 0) {
      missions.stage += 1;
      missions.timer = 0;
    }
  }
}

/** The objective line the HUD shows, with live counts where they matter. */
export function objectiveText(missions) {
  if (missions.complete) return 'Story complete — free roam. Solmar is yours.';
  const mission = currentMission(missions);
  if (!mission) return '';
  if (!missions.started) return 'Next job: ' + mission.title;
  const stage = currentStage(missions);
  if (!stage) return mission.title + ' — done';
  if (stage.type === 'collect') return stage.text.replace('(0 of 3)', '(' + missions.collected + ' of ' + stage.targets.length + ')');
  if (stage.type === 'wait') return stage.text;
  if (stage.timeLimit) {
    const left = Math.max(0, Math.ceil(stage.timeLimit - missions.timer));
    return stage.text + ' — ' + left + 's left';
  }
  return stage.text;
}
