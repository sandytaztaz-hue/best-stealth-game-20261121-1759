# Moonpetal Glasshouse

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![make.fun · rank](https://make.fun/badge/best-stealth-game-20261121-1759/sandytaztaz-hue/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![make.fun · reward](https://make.fun/badge/best-stealth-game-20261121-1759/sandytaztaz-hue/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game in a Victorian glasshouse at night. Three Moonpetals
were stolen from the glasshouse. Slip in as the gardener's apprentice, steal
them back, and leave unseen.

[Play the bounty on make.fun](https://make.fun/bounty/best-stealth-game-20261121-1759)

## How to play

- **Goal:** collect all 3 glowing Moonpetals in each house, then reach the
  exit gate. The gate stays locked and grey until the third petal is taken.
  Clear all three houses — the Potting Shed, the Fern House, the Orchid
  Vault — to win.
- **WASD / arrows** — move. **Shift** — tiptoe: slow and quiet, and the
  detection meter rises half as fast.
- **Click** — toss a pebble. Wardens within earshot walk over to investigate
  the ping. Three pebbles per house.
- **M** — mute. **R** — restart the house. **Enter** — start / continue.

## The stealth

- Night wardens patrol fixed routes (shown as faint dotted paths — learn
  them), and one sentry per house sweeps a slow full turn from a brass post.
- Vision cones are raycast against walls and hedges, so a cone visibly stops
  at cover. Hedges block every cone: crouch behind one and the **HIDDEN**
  tag appears.
- Standing in a lamp pool doubles how fast you are spotted; shadow is safer.
- Footsteps carry: walking rings reach 90px, tiptoe only 30px, and wardens
  turn toward a noise they hear.
- Getting seen fills the eye meter. At a third full the nearest warden gets
  suspicious (`?`) and comes to look. At full the alarm sounds (`!`) and
  every warden converges — but break line of sight and hide, and the hunt
  burns out: they search your last-seen spot (marked with a fading ghost)
  and go back to patrol. Only a warden touching you catches you.
- Finish without ever being spotted for a **GHOST** rating; spotted once is
  a **SHADOW**.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no build step, no network requests, no libraries. All
art is canvas vector drawing; all sound is synthesized WebAudio.

## Screenshots

The four screenshots under `screenshots/` are real renders of the game's own
code (`?shot=start|play|alarm|end&seed=1`): the title over the Orchid Vault,
mid-play in the Vault, a near miss at the meter's edge, and the ghost win.
