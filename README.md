# Moonpetal Glasshouse

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![make.fun · best-stealth-game-20261121-1759 rank](https://make.fun/badge/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![make.fun · best-stealth-game-20261121-1759 reward](https://make.fun/badge/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game set in a Victorian glasshouse at night. Three
Moonpetals were stolen from the glasshouse. Slip in as the gardener's
apprentice, steal them back, and leave unseen.

Entry for the make.fun bounty [best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759).

## How to play

- **Objective:** collect all 3 glowing Moonpetal seeds on each level, then
  reach the exit gate. The gate stays locked and grey until the third seed
  is picked up, then it glows green. Finish all 3 glasshouses to win.
- **Stay out of the amber vision cones.** Night wardens patrol fixed
  routes, pausing at each waypoint. A cone that touches you fills the
  detection meter — faster in lamp light, slower in shadow, half as fast
  while tiptoeing.
- **Hide behind hedges and glass walls.** Cover blocks a warden's line of
  sight completely: cones visibly stop at it, and the meter drains while
  you are unseen.
- **Detection gives you a chance to recover.** At 35% the wardens get
  suspicious ("?") and come to look. At 100% the alarm sounds ("!") and
  they converge on you — but break line of sight, hide for 4 seconds, and
  they give up and go back to patrol while the meter drains.
- **Noise matters.** Walking leaves expanding footstep rings wardens can
  hear. Tiptoeing is quiet. Click (or E) to toss a pebble: it pings and
  nearby wardens walk over to investigate it. 3 pebbles per level.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift (hold) | Tiptoe — slow and quiet, detection rises half as fast |
| Click / E | Toss a pebble at that point (max 260 px) |
| Enter / click | Start from the title screen, advance from level-clear |
| R | Restart the level (or the whole run from the win screen) |
| M | Mute |

## The three glasshouses

1. **The Potting Shed** — 2 wardens, generous cover. Learn the cones.
2. **The Fern House** — 4 wardens, the showcase level.
3. **The Orchid Vault** — 6 wardens, more lamps, tighter patrols.

**The one rule that matters:** the meter always drains while no warden
sees you, and every warden gives up the chase after 4 seconds without a
sighting. A near miss is never the end of a run — it is the game.

## How to run

No build step, no network, no libraries — plain static files.

```sh
node serve.ts
# open http://localhost:8080/ in desktop Chrome
```

Or serve `game/` with any static server and open `game/index.html`.

## Files

- `game/index.html` — the page, 1280×720 canvas.
- `game/src/main.js` — game loop and screen state machine.
- `game/src/config.js` — tuning numbers and colours.
- `game/src/levels.js` — the 3 level definitions.
- `game/src/world.js` — simulation: movement, guard AI, line of sight,
  detection meter, noise, pebbles, seeds, exit, caught.
- `game/src/render.js` — all canvas drawing: floor, walls, hedges, lamp
  pools, occluded vision cones, guards, player, seeds, exit, HUD, screens.
- `game/src/input.js` — keyboard + mouse.
- `game/src/audio.js` — WebAudio sounds (footsteps, pebble ping, pickup
  chime, alert sting, crickets), no audio files.
- `game/src/random.js` — seeded RNG for moss, fireflies and crickets.
- `game/src/shots.js` — the deterministic `?shot=` scenes used for the
  screenshots: each plays the real rules forward from a fresh world.
- `main.ts` — the make.fun entry program: copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json`.
- `screenshots/` — real renders of the game's own code.

All art is canvas vector drawing; all sounds are synthesized with WebAudio.
