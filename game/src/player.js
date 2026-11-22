// Riley, the player: on-foot movement (8 directions, aim with the mouse, punch
// and pistol), entering and stealing vehicles, driving, taking damage, dying.

import { PLAYER, VEHICLE_TYPES, PLACES } from './config.js';
import { clamp, dist, TAU } from './util.js';
import { driveVehicle } from './vehicles.js';
import { audio } from './audio.js';

export function createPlayer(world) {
  return {
    x: PLACES.playerStart.x, y: PLACES.playerStart.y,
    angle: 0, vx: 0, vy: 0,
    radius: PLAYER.radius,
    health: PLAYER.maxHealth, maxHealth: PLAYER.maxHealth,
    money: 0,
    inVehicle: null,
    weapon: 'pistol', // 'pistol' | 'fists'
    ammo: 30,
    fireCd: 0, punchCd: 0, hurtCd: 0, hurtFlash: 0,
    walkCycle: 0,
    enterCd: 0,
    hasPackage: false,
  };
}

export function updatePlayer(p, dt, input, world, game) {
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.enterCd = Math.max(0, p.enterCd - dt);
  const mouse = input.mouse;

  if (p.inVehicle) {
    updateDriving(p, dt, input, world, game);
  } else {
    updateOnFoot(p, dt, input, world, game);
  }

  // Aim toward the mouse (world coordinates are kept up to date by main).
  const aim = Math.atan2(mouse.worldY - p.y, mouse.worldX - p.x);
  if (!p.inVehicle) p.angle = aim;

  // Shooting: hold the left button; the pistol has a fire-rate cap.
  if (mouse.down && p.weapon === 'pistol' && p.ammo > 0 && p.fireCd <= 0 && !p.inVehicle) {
    p.fireCd = 0.17;
    p.ammo--;
    game.combat.fire(p, p.angle, { owner: 'player' });
    audio.shot();
    game.camera.kick(2.4);
    game.onShotFired();
  }
  // Punch: F key, a short melee swing.
  if (input.wasPressed('KeyF') && p.punchCd <= 0 && !p.inVehicle) {
    p.punchCd = 0.42;
    audio.punch();
    const hx = p.x + Math.cos(p.angle) * PLAYER.punchRange * 0.7;
    const hy = p.y + Math.sin(p.angle) * PLAYER.punchRange * 0.7;
    const targets = [...game.peds.peds, ...game.police.cops, ...(game.missions.rivals || [])];
    for (const t of targets) {
      if (t.dead || t.state === 'dead') continue;
      if (dist(hx, hy, t.x, t.y) < PLAYER.punchRange) {
        t.health -= PLAYER.punchDamage;
        t.hurtFlash = 0.25;
        t.x += Math.cos(p.angle) * 26;
        t.y += Math.sin(p.angle) * 26;
        game.combat.blood(t.x, t.y, p.angle);
        game.onPedHit();
      }
    }
  }

  // Enter / exit vehicles.
  if (input.wasPressed('KeyE') && p.enterCd <= 0) {
    p.enterCd = 0.4;
    if (p.inVehicle) exitVehicle(p, world, game);
    else tryEnterVehicle(p, game);
  }

  // Death.
  if (p.health <= 0 && game.state === 'playing') {
    game.wastePlayer();
  }
}

function updateOnFoot(p, dt, input, world, game) {
  const ax = input.axis();
  const speed = PLAYER.speed;
  p.vx = ax.x * speed;
  p.vy = ax.y * speed;
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  // Slide along walls: try x and y separately.
  if (!world.isBlocked(nx, p.y, p.radius)) p.x = nx;
  if (!world.isBlocked(p.x, ny, p.radius)) p.y = ny;
  if (ax.x !== 0 || ax.y !== 0) p.walkCycle += dt * 10;
}

function updateDriving(p, dt, input, world, game) {
  const v = p.inVehicle;
  const t = VEHICLE_TYPES[v.type];
  const ax = input.axis();
  const throttle = ax.y < 0 ? 1 : ax.y > 0 ? -1 : 0;
  const steer = ax.x;
  const brake = input.keys.has('Space');

  const others = [...game.traffic.cars, ...game.police.cars];
  const res = driveVehicle(v, dt, world, throttle, steer, brake, others);
  v.flash = Math.max(0, v.flash - dt);

  // Track velocity for the camera.
  p.vx = Math.cos(v.angle) * v.speed;
  p.vy = Math.sin(v.angle) * v.speed;
  p.x = v.x; p.y = v.y;

  audio.setEngine(Math.abs(v.speed) / t.maxSpeed);

  if (res.crash > 70) {
    p.vehicleCrash(res.crash * 0.35);
    game.combat.sparks(v.x, v.y);
    game.camera.kick(Math.min(12, res.crash * 0.03));
    // Running into traffic at speed is a crime witnesses report.
    if (res.other && res.other.driver === 'ai' && res.crash > 150) {
      game.police.addWanted(0.4, game);
      res.other.health -= res.crash * 0.1;
      if (res.other.health <= 0) game.traffic.wreckCar(res.other, game.combat);
    }
  }
  if (v.health <= 0) {
    // The rig is gone — Riley is thrown clear, worse for wear.
    game.traffic.wreckCar(v, game.combat);
    exitVehicle(p, world, game);
    p.health -= 28;
    p.hurtFlash = 0.4;
    game.camera.kick(14);
    audio.hurt();
  }
}

function tryEnterVehicle(p, game) {
  let best = null, bestD = 52;
  const candidates = [...game.traffic.cars, ...game.police.cars, ...(game.missions.missionVehicles || [])];
  for (const v of candidates) {
    if (v.wreck) continue;
    const d = dist(p.x, p.y, v.x, v.y);
    if (d < bestD) { best = v; bestD = d; }
  }
  if (!best) return;
  const wasAi = best.driver === 'ai';
  const wasPolice = best.driver === 'police';
  best.driver = 'player';
  best.ai = null;
  p.inVehicle = best;
  p.vx = 0; p.vy = 0;
  audio.startEngine();
  if (wasAi) {
    // Carjacking in front of witnesses is a crime.
    game.police.addWanted(game.police.stars() >= 1 ? 1 : 1, game);
    game.onCarjack();
  }
  if (wasPolice) game.police.addWanted(0.5, game);
}

export function exitVehicle(p, world, game) {
  const v = p.inVehicle;
  if (!v) return;
  v.driver = null;
  v.speed *= 0.4;
  // Step out to the left side of the car.
  const side = v.angle + Math.PI / 2;
  let ex = v.x + Math.cos(side) * (v.w + 14);
  let ey = v.y + Math.sin(side) * (v.w + 14);
  if (world.isBlocked(ex, ey, p.radius)) { ex = v.x - Math.cos(side) * (v.w + 14); ey = v.y - Math.sin(side) * (v.w + 14); }
  p.x = world.resolve(ex, ey, p.radius).x;
  p.y = world.resolve(ex, ey, p.radius).y;
  p.inVehicle = null;
  p.health = Math.min(p.maxHealth, p.health);
  audio.stopEngine();
}

// Damage from bullets, crashes and explosions.
export function hurtPlayer(p, amount, game) {
  if (p.hurtCd > 0 || game.state !== 'playing') return;
  p.health -= amount;
  p.hurtCd = PLAYER.hurtCooldown;
  p.hurtFlash = 0.35;
  game.camera.kick(Math.min(9, amount * 0.35));
  game.flash = Math.min(0.6, game.flash + amount * 0.006);
  audio.hurt();
}

// Player method attached in main: vehicle crash damage wrapper.
export function crashInVehicle(p, amount, game) {
  if (!p.inVehicle) return;
  p.inVehicle.health -= amount;
  p.inVehicle.flash = 0.2;
  if (p.inVehicle.health <= 0) {
    game.traffic.wreckCar(p.inVehicle, game.combat);
    exitVehicle(p, game.world, game);
    p.health -= 25;
    p.hurtFlash = 0.4;
    game.camera.kick(14);
    audio.hurt();
  }
}
