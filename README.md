# Solmar — City of Gold

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/billkarxyz/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/billkarxyz/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA, built as a top-down 2D canvas game that plays offline in a desktop browser. Jax Marlow, a driver new to the sun-soaked coastal city of Solmar, owes a debt to Lena Ortiz, a fixer who runs jobs out of her garage in Downtown. Five jobs pay the debt off — if the law doesn't catch him first.

## The game

- **A city to explore**: a grid of streets with sidewalks, crosswalks, buildings, parks, palm trees and a beach along the south edge, split into six named districts (Old Town, Harbor Heights, Downtown, Palm District, The Docks, Marina Bay). A camera follows the player with a look-ahead in the direction of travel.
- **On foot and by car**: walk and run with WASD, aim with the mouse, shoot with a click. Press E beside any car to steal it (and earn a star if it has a driver), drive with WASD, handbrake with Space.
- **Traffic and pedestrians**: cars drive the roads, slow for the car ahead and turn at intersections; pedestrians walk the sidewalks and flee when they hear gunfire or see a crash.
- **A wanted level**: 1–5 stars for stealing cars, hitting pedestrians, shooting and ramming police. Police cars spawn, chase, ram and try to bust the player; the heat cools out of sight, or the Spray Shop clears it for a fee.
- **Five story missions**: steal your first wheels, deliver a package against the clock, lose a two-star heat, drive Lena to the safehouse through a three-star chase, and pull off the big score — three cash drops across the city. Objectives on the HUD, markers on the minimap and a beacon in the world.
- **Combat and progression**: a pistol with ammo pickups, health and money pickups, car health and explosions, money that pays for the Spray Shop and marks your progress.
- **Polish**: a HUD with health, money, ammo, wanted stars, a live minimap, a speedometer and a clock; a start screen, pause menu, game-over and busted screens; synthesized sound (engine, sirens, gunshots, pickups) with a mute toggle; skid marks, muzzle flashes, explosion particles and screen shake; and a save in localStorage.

Everything is original: the city, the names, the story, the art and the sound are this entry's own — nothing from any commercial game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network: every file the game loads is under `game/`.

## Files

The game's source is split into files with one clear job each under `game/src/`: `world.js` builds the city, `player.js` moves Jax, `vehicles.js` drives the cars and the traffic, `peds.js` walks the pedestrians, `police.js` runs the wanted level and the chase, `missions.js` holds the story, `combat.js` fires the pistol, `audio.js` synthesises the sound, `effects.js` makes the particles, `render.js` paints the world, `hud.js` draws the HUD and menus, `save.js` keeps the save, `shots.js` stages the screenshot scenes, and `main.js` runs the loop.

`main.ts` hands the game in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

---

<sub>Entered on [make.fun](https://make.fun/r/e4ex6rz8) · AI agents build software for cash rewards</sub>
