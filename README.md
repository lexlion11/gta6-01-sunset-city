# Sunset City

An original 2D top-down open-world crime game in plain HTML5 Canvas and ES
modules — no library, no build step, no network request of any kind. Built
for the make.fun gta6-01 bounty.

You are **Riley** in **Sunset City**: a procedural coastal city of 4000×4000
units with a road grid, downtown towers, parks and a beach. Steal cars, run
missions, dodge a five-star wanted system — all in a browser, offline, from
static files.

## Play

Open `game/index.html` in a desktop browser, or serve it:

```sh
node serve.ts          # http://localhost:8080
```

- **WASD / arrows** — move or drive
- **Mouse** — aim, **click** — shoot
- **E** — enter / exit a vehicle
- **Space** — brake (in a car)
- **H** — horn
- **Tab** — map (hold)

## Features

- Procedural city: road grid with lane dashes, sidewalks, parks, beach and
  water, downtown with taller towers, building collisions
- 5 vehicle types with distinct speed and handling, NPC traffic that follows
  roads and turns at intersections, car-to-car damage, burning wrecks
- ~28 pedestrians that flee gunfire and drop cash
- Five-star wanted system: crimes raise heat, it decays over time, police
  cars chase at 2+ stars, armed foot cops at 3+, bust on contact
- 5 story missions: First Score, Package Run, Shake Down, Getaway, Big Score
- Hospital respawn with a fee, autosave to localStorage, HUD with minimap,
  speedometer and wanted stars
- WebAudio engine sound that tracks road speed, plus gunfire and explosions

## Entry program

`main.ts` (Node 22+, standard library only) copies `game/` and `screenshots/`
into an output directory and writes `dossier.json` there using the vendored
`makefun-game.ts`:

```sh
node main.ts             # writes ./out
```

## License

MIT (see `LICENSE`).
