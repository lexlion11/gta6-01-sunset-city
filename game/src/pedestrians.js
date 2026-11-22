// Pedestrians: NPCs strolling the sidewalks. They flee from gunfire, and some
// drop cash when they go down.

import { PEDS, WORLD, BLOCK, ROAD } from './config.js';
import { clamp, dist, dist2, TAU, makeRng } from './util.js';

const SHIRTS = ['#d05050', '#5070d0', '#50b070', '#d0a050', '#a050d0', '#50c0c0', '#d08060', '#c0c060'];
const SKINS = ['#e8b890', '#c08858', '#8a5830', '#f0d0b0'];
const PANTS = ['#3a4a5a', '#5a3a3a', '#3a3a3a', '#4a4a3a'];

export function createPed(rng, world) {
  const p = sidewalkPoint(rng, world);
  return {
    x: p.x, y: p.y, angle: rng() * TAU,
    radius: 9,
    health: 34, maxHealth: 34,
    speed: PEDS.speed * (0.8 + rng() * 0.4),
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    pants: PANTS[Math.floor(rng() * PANTS.length)],
    state: 'walk', // walk | flee | dead
    target: sidewalkPoint(rng, world),
    fleeTimer: 0,
    deadTimer: 0,
    hurtFlash: 0,
    walkCycle: rng() * TAU,
    money: 5 + Math.floor(rng() * 26),
    dead: false,
  };
}

// A point on a sidewalk: just inside a block, off the road.
function sidewalkPoint(rng, world) {
  const i = Math.floor(rng() * 9);
  const j = Math.floor(rng() * 10);
  const x = i * BLOCK + ROAD / 2 + 26 + rng() * (BLOCK - ROAD - 52);
  const y = j * BLOCK + ROAD / 2 + 26 + rng() * (BLOCK - ROAD - 52);
  return { x: clamp(x, 20, 3420), y: clamp(y, 20, WORLD - 20) };
}

export class PedSystem {
  constructor(world) {
    this.world = world;
    this.rng = makeRng(4242);
    this.peds = [];
    for (let i = 0; i < PEDS.count; i++) this.peds.push(createPed(this.rng, world));
  }

  spawnExtra(n) {
    for (let i = 0; i < n; i++) this.peds.push(createPed(this.rng, this.world));
  }

  update(dt, world, player, combat, game) {
    const peds = this.peds;
    const shot = combat.lastShot;
    for (let k = peds.length - 1; k >= 0; k--) {
      const ped = peds[k];
      ped.hurtFlash = Math.max(0, ped.hurtFlash - dt);

      if (ped.state === 'dead') {
        ped.deadTimer += dt;
        if (ped.deadTimer > 10) {
          peds.splice(k, 1);
          peds.push(createPed(this.rng, world));
        }
        continue;
      }

      // Gunfire nearby (or a car barreling down on them) makes them run.
      const threat = shot && combat.time - shot.time < 1.2 && dist(shot.x, shot.y, ped.x, ped.y) < PEDS.fleeRadius;
      if (threat && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeTimer = PEDS.fleeTime;
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) { ped.state = 'walk'; ped.target = sidewalkPoint(this.rng, world); }
      }

      // A car about to hit them: dodge.
      if (player.inVehicle) {
        const d = dist(player.x, player.y, ped.x, ped.y);
        if (d < 120) { ped.state = 'flee'; ped.fleeTimer = 1.6; }
      }

      const speed = ped.state === 'flee' ? PEDS.fleeSpeed : ped.speed;
      let tx, ty;
      if (ped.state === 'flee') {
        // Run away from the shooter (or the player's car).
        const from = shot && combat.time - shot.time < 3 ? shot : player;
        let a = Math.atan2(ped.y - from.y, ped.x - from.x);
        a += (Math.sin(this.rng() * TAU) * 0.5);
        tx = ped.x + Math.cos(a) * 60;
        ty = ped.y + Math.sin(a) * 60;
      } else {
        tx = ped.target.x; ty = ped.target.y;
      }
      const want = Math.atan2(ty - ped.y, tx - ped.x);
      ped.angle = want;
      const dx = Math.cos(ped.angle) * speed * dt;
      const dy = Math.sin(ped.angle) * speed * dt;
      const nx = ped.x + dx, ny = ped.y + dy;
      if (!world.isBlocked(nx, ny, ped.radius)) {
        ped.x = nx; ped.y = ny;
        ped.walkCycle += dt * speed * 0.09;
      } else if (ped.state === 'walk') {
        ped.target = sidewalkPoint(this.rng, world);
      } else {
        // Fleeing into a wall: slide along it.
        if (!world.isBlocked(nx, ped.y, ped.radius)) ped.x = nx;
        else if (!world.isBlocked(ped.x, ny, ped.radius)) ped.y = ny;
      }

      // Death from damage.
      if (ped.health <= 0) {
        ped.state = 'dead';
        ped.dead = true;
        ped.deadTimer = 0;
        ped.angle += Math.PI / 2;
        combat.blood(ped.x, ped.y, ped.angle);
        if (this.rng() < 0.55) combat.dropMoney(ped.x, ped.y, ped.money);
        if (game && game.onPedKilled) game.onPedKilled(ped);
      }
    }
  }
}
