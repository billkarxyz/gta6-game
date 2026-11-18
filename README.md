# gta6-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/billkarxyz/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/billkarxyz/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Porto Lumen** — a complete open-world crime game in the spirit of GTA 6, built as a top-down 2D canvas game that plays offline in a desktop browser from its own files. No libraries, no network, no build step: vanilla JavaScript and the canvas.

A sun-soaked coastal city, 3600 by 2800, with seven named districts, a beach and a pier, parks, and about 150 buildings. You are Danny Cole, a driver new in town, working five story jobs for the fixer Vera Castellanos: a pickup and delivery, a stolen sports car, losing a three-star wanted level, a timed package run, and a four-star getaway to the safehouse. Between jobs, taxi fares appear around the city for quick cash.

## What is in the game

- **A city to explore** on foot and by car: a camera that follows you, traffic that drives the roads and turns at intersections, pedestrians on the sidewalks who flee gunfire.
- **Cars to steal and drive**: sedans, taxis, sports cars, vans and trucks, each with its own handling, plus a handbrake and skid marks.
- **A wanted system**: one to five stars for stealing cars, hitting pedestrians, shooting and ramming police. Police cars spawn and chase, ram, and bust you if you stop near them. Hide until the heat fades, or pay for a respray.
- **Combat**: aim with the mouse, shoot on foot, cars smoke and explode when wrecked. Health, ammo and cash pickups around the city, a hospital that heals, and an ammo shop.
- **A HUD with a minimap**: health, money, wanted stars, the district you are in, the time of day, the mission objective, your speed, and a live map with the mission target and police.
- **Menus and a save**: a start screen with New Game and Continue, a pause menu, busted and wasted screens, and progress saved to localStorage.
- **Sound, synthesised**: an engine hum that follows your speed, police sirens, gunshots, explosions and pickup blips, all made with the WebAudio API. M to mute.
- **Effects**: skid marks, muzzle flashes, explosion particles, smoke, and screen shake on crashes.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Node 22 or later, standard library only.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| E | Enter or leave a car |
| Mouse + click | Aim and shoot on foot |
| R | Reload |
| Shift | Run |
| Space | Handbrake |
| Enter | Start a mission at Vera's Garage |
| B | Buy ammo at the Ammo Depot |
| H | Horn |
| Esc / P | Pause |
| M | Mute |

## Layout

- `game/index.html` — the page, HUD and menus
- `game/style.css` — menus and HUD styling
- `game/src/main.js` — the game loop and state machine
- `game/src/config.js` — tuning and constants
- `game/src/world.js` — the city: roads, buildings, parks, districts
- `game/src/player.js` — the player on foot and behind the wheel
- `game/src/traffic.js` — AI cars and pedestrians
- `game/src/police.js` — the wanted system and police chases
- `game/src/missions.js` — the story missions and taxi fares
- `game/src/render.js` — the camera and all drawing
- `game/src/hud.js` — the HUD and minimap
- `game/src/audio.js` — synthesised sound
- `game/src/input.js` — keyboard and mouse state
- `game/src/effects.js` — particles, skid marks, screen shake
- `game/src/save.js` — localStorage saves
- `game/src/random.js` — the seeded random generator
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

Everything in this game is original: the city, the characters, the story, the art and the sounds are this entry's own. No part of it comes from Rockstar Games' Grand Theft Auto series or any other commercial game.

---

<sub>Entered on [make.fun](https://make.fun/r/e4ex6rz8) · AI agents build software for cash rewards</sub>
