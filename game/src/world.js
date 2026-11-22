// World generation: the layout of Sunset City — roads, blocks, buildings, parks,
// beach and ocean. Procedural but seeded, so every player sees the same city.

import { WORLD, BLOCK, ROAD, LANE, WATER_X, BEACH_X, COLORS, DOWNTOWN } from './config.js';
import { makeRng, pick, clamp } from './util.js';

const BUILDING_COLORS = [
  '#c9a27a', '#b08a68', '#a8b0a0', '#9aa8b8', '#c2b49a', '#d8b48c',
  '#b8a0a8', '#a0a8b0', '#c8b0a0', '#d0c0a8', '#98a898', '#c0a890',
];
const DOWNTOWN_COLORS = ['#8e9eae', '#9aaab8', '#7e8ea0', '#a4b4c2', '#8898a8', '#b0bcc8'];

export function createWorld() {
  const rng = makeRng(20260615);
  const buildings = [];
  const parks = [];
  const trees = [];

  const parkBlocks = new Set(['1,1', '7,2', '2,7', '5,8', '8,4', '3,8']);

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const x0 = i * BLOCK + ROAD / 2 + 12;
      const y0 = j * BLOCK + ROAD / 2 + 12;
      let x1 = (i + 1) * BLOCK - ROAD / 2 - 12;
      const y1 = (j + 1) * BLOCK - ROAD / 2 - 12;
      if (i >= 9) continue; // the ninth column is ocean
      if (x1 > BEACH_X - 26) x1 = BEACH_X - 26; // beach strip on the east
      if (x1 - x0 < 120) continue;

      const key = `${i},${j}`;
      if (parkBlocks.has(key)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = 7 + Math.floor(rng() * 5);
        for (let t = 0; t < count; t++) {
          trees.push({
            x: x0 + 24 + rng() * (x1 - x0 - 48),
            y: y0 + 24 + rng() * (y1 - y0 - 48),
            r: 13 + rng() * 9,
          });
        }
        continue;
      }

      const dt = i >= DOWNTOWN.i0 && i <= DOWNTOWN.i1 && j >= DOWNTOWN.j0 && j <= DOWNTOWN.j1;
      const split = rng() < 0.42;
      const lots = [];
      if (split) {
        if (rng() < 0.5) {
          const gap = 14 + rng() * 14;
          const half = (x1 - x0 - gap) / 2;
          if (half > 70) { lots.push([x0, y0, half, y1 - y0], [x0 + half + gap, y0, half, y1 - y0]); }
          else lots.push([x0, y0, x1 - x0, y1 - y0]);
        } else {
          const gap = 14 + rng() * 14;
          const half = (y1 - y0 - gap) / 2;
          if (half > 70) { lots.push([x0, y0, x1 - x0, half], [x0, y0 + half + gap, x1 - x0, half]); }
          else lots.push([x0, y0, x1 - x0, y1 - y0]);
        }
      } else {
        lots.push([x0, y0, x1 - x0, y1 - y0]);
      }

      for (const [bx, by, bw, bh] of lots) {
        if (bw < 70 || bh < 70) continue;
        const inset = 6 + rng() * 8;
        const x = bx + inset, y = by + inset, w = bw - inset * 2, h = bh - inset * 2;
        if (w < 60 || h < 60) continue;
        const hh = dt ? 34 + rng() * 34 : 10 + rng() * 20;
        const color = pick(rng, dt ? DOWNTOWN_COLORS : BUILDING_COLORS);
        const roof = dt ? '#c8d4dc' : '#d8c8ae';
        buildings.push({ x, y, w, h, hh, color, roof, downtown: dt });
      }
    }
  }

  // Street trees along a few sidewalks for shade.
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 10; j++) {
      if (rng() < 0.16) {
        trees.push({ x: i * BLOCK + ROAD / 2 + 22, y: j * BLOCK + BLOCK / 2 + (rng() - 0.5) * 200, r: 10 + rng() * 5 });
      }
    }
  }

  return {
    buildings,
    parks,
    trees,
    // Circle collision against buildings, the map border and the ocean.
    isBlocked(x, y, r) {
      if (x < r || y < r || x > WORLD - r || y > WORLD - r) return true;
      if (x > WATER_X - r * 0.5) return true;
      for (let k = 0; k < buildings.length; k++) {
        const b = buildings[k];
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      return false;
    },
    // Push a circle out of every building it overlaps; returns adjusted position.
    resolve(x, y, r) {
      let px = x, py = y;
      for (let k = 0; k < buildings.length; k++) {
        const b = buildings[k];
        if (px + r > b.x && px - r < b.x + b.w && py + r > b.y && py - r < b.y + b.h) {
          const left = px - b.x, right = b.x + b.w - px, top = py - b.y, bottom = b.y + b.h - py;
          const m = Math.min(left, right, top, bottom);
          if (m === left) px = b.x - r;
          else if (m === right) px = b.x + b.w + r;
          else if (m === top) py = b.y - r;
          else py = b.y + b.h + r;
        }
      }
      if (px < r) px = r;
      if (py < r) py = r;
      if (px > WORLD - r) px = WORLD - r;
      if (py > WORLD - r) py = WORLD - r;
      if (px > WATER_X - r * 0.5) px = WATER_X - r * 0.5;
      return { x: px, y: py };
    },
    // A random point on a road centerline, offset into the right lane for `dir`.
    randomRoadPoint(rng2, dir) {
      const i = Math.floor(rng2() * 10);
      const j = Math.floor(rng2() * 10);
      return roadPoint(i, j, dir);
    },
    // The intersection grid index nearest to a world position.
    nearestNode(x, y) {
      return { i: clamp(Math.round(x / BLOCK), 0, 10), j: clamp(Math.round(y / BLOCK), 0, 10) };
    },
  };
}

// Point at intersection (i,j) offset into the right lane for a travel direction.
export function roadPoint(i, j, dir) {
  const x = i * BLOCK, y = j * BLOCK;
  if (dir === 'E') return { x, y: y + LANE };
  if (dir === 'W') return { x, y: y - LANE };
  if (dir === 'N') return { x: x + LANE, y };
  return { x: x - LANE, y }; // 'S'
}

// True when (x,y) lies on a road (within ROAD/2 of a centerline).
export function onRoad(x, y) {
  const mx = x % BLOCK, my = y % BLOCK;
  return mx < ROAD / 2 || mx > BLOCK - ROAD / 2 || my < ROAD / 2 || my > BLOCK - ROAD / 2;
}
