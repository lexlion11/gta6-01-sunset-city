// Vehicles: traffic cars that cruise the grid, parked cars, and the driving
// model the player uses after stealing one — acceleration, turning, friction,
// and collisions with buildings and other cars.

import { VEHICLE_TYPES, TRAFFIC, WORLD, BLOCK, ROAD, WATER_X } from './config.js';
import { roadPoint } from './world.js';
import { clamp, angLerp, angDiff, dist, makeRng, pick } from './util.js';

const DIRS = ['E', 'W', 'N', 'S'];
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
const DV = { E: { x: 1, y: 0 }, W: { x: -1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } };

export function createVehicle(typeName, x, y, angle, colorOverride) {
  const t = VEHICLE_TYPES[typeName];
  const color = colorOverride || pick(makeRng((Math.random() * 1e9) | 0), t.colors);
  return {
    type: typeName,
    x, y, angle,
    speed: 0, // signed, along heading
    vx: 0, vy: 0, // world-space velocity (for camera lead + crash transfer)
    w: t.w, l: t.l,
    health: t.health, maxHealth: t.health,
    color,
    driver: null, // 'player' | 'ai' | 'police' | null
    ai: null,
    wreck: false,
    flash: 0,
    stuckTimer: 0,
    mission: false, // a mission-critical vehicle
    onWreck: null,
  };
}

// Physics for a vehicle driven by the player (or the chase AI, via steer/brake).
export function driveVehicle(v, dt, world, throttle, steer, brake, others) {
  const t = VEHICLE_TYPES[v.type];
  if (throttle > 0) v.speed += t.accel * throttle * dt;
  else if (throttle < 0) v.speed += t.accel * 0.7 * throttle * dt;
  if (brake) v.speed *= Math.exp(-3.2 * dt);
  v.speed *= Math.exp(-(1 - t.grip) * 1.6 * dt); // rolling drag
  v.speed = clamp(v.speed, -t.reverseSpeed, t.maxSpeed);

  // Steering authority grows with speed; a parked car cannot turn.
  const authority = clamp(Math.abs(v.speed) / 70, 0, 1);
  v.angle += steer * t.turn * authority * dt * Math.sign(v.speed || 1);

  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;

  // Building collision: stop, bleed speed, push out.
  if (world.isBlocked(nx, ny, Math.max(v.w, v.l) * 0.42)) {
    const impact = Math.abs(v.speed);
    v.speed *= -0.18;
    const r = world.resolve(v.x, v.y, Math.max(v.w, v.l) * 0.42);
    v.x = r.x; v.y = r.y;
    return { crash: impact };
  }
  v.x = nx; v.y = ny;

  // Car-vs-car: simple circle overlap, transfer a shove and damage on hard hits.
  if (others) {
    for (const o of others) {
      if (o === v || o.wreck) continue;
      const d = dist(v.x, v.y, o.x, o.y);
      const minD = (v.l + o.l) * 0.42;
      if (d < minD && d > 0.001) {
        const push = (minD - d) / minD;
        const ux = (v.x - o.x) / d, uy = (v.y - o.y) / d;
        v.x += ux * push * 10; o.x -= ux * push * 10;
        v.y += uy * push * 10; o.y -= uy * push * 10;
        const rel = Math.abs(v.speed) + Math.abs(o.speed);
        v.speed *= 0.55; o.speed *= 0.7;
        return { crash: rel > 120 ? rel * 0.5 : 0, other: o };
      }
    }
  }
  return { crash: 0 };
}

export class TrafficSystem {
  constructor(world) {
    this.world = world;
    this.cars = [];
    this.rng = makeRng(777);
    for (let i = 0; i < TRAFFIC.count; i++) this.spawn();
  }

  spawn(typeName) {
    const rng = this.rng;
    const dir = pick(rng, DIRS);
    const p = this.world.randomRoadPoint(rng, dir);
    const type = typeName || pick(rng, ['sedan', 'sedan', 'sports', 'truck', 'sedan']);
    const car = createVehicle(type, p.x, p.y, dirAngle(dir));
    car.driver = 'ai';
    car.ai = { dir, target: this.nextTarget(p, dir) };
    this.cars.push(car);
    return car;
  }

  // Next intersection in `dir`, offset into the right lane; turns are chosen there.
  nextTarget(pos, dir) {
    const node = this.world.nearestNode(pos.x, pos.y);
    const d = DV[dir];
    let i = node.i, j = node.j;
    if (dir === 'E') i = Math.min(10, node.i + 1);
    if (dir === 'W') i = Math.max(0, node.i - 1);
    if (dir === 'N') j = Math.max(0, node.j - 1);
    if (dir === 'S') j = Math.min(10, node.j + 1);
    // Never route into the ocean column.
    if (dir === 'E' && i * BLOCK > WATER_X - ROAD) i = node.i;
    return roadPoint(i, j, dir);
  }

  remove(car) {
    const k = this.cars.indexOf(car);
    if (k >= 0) this.cars.splice(k, 1);
  }

  update(dt, world, player, combat, police) {
    const cars = this.cars;
    for (let k = cars.length - 1; k >= 0; k--) {
      const car = cars[k];
      if (car.driver === 'player' || car.wreck) continue;
      if (car.driver === 'police') continue; // police.js drives those
      this.aiDrive(car, dt, world, player, cars, combat, police);
      if (car.wreck) cars.splice(k, 1);
    }
    // Keep the streets populated: respawn off-screen despawns.
    for (let k = cars.length - 1; k >= 0; k--) {
      const car = cars[k];
      if (car.driver !== 'ai') continue;
      const d = dist(car.x, car.y, player.x, player.y);
      if (d > 1300) {
        cars.splice(k, 1);
        this.spawn();
      }
    }
  }

  aiDrive(car, dt, world, player, cars, combat, police) {
    const ai = car.ai;
    if (!ai) return;
    const t = VEHICLE_TYPES[car.type];

    // Steer toward the lane point ahead.
    const target = ai.target;
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    car.angle = angLerp(car.angle, want, 1 - Math.exp(-5.5 * dt));

    // Cruise speed, unless something is in the way.
    let limit = t.maxSpeed * TRAFFIC.cruise;
    for (const o of cars) {
      if (o === car || o.wreck) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const fwd = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const lat = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
      if (fwd > 0 && fwd < TRAFFIC.brakeDist && Math.abs(lat) < 26) { limit = Math.min(limit, Math.abs(o.speed) * 0.8); break; }
    }
    // The player on foot makes traffic slow down too.
    if (!player.inVehicle) {
      const dx = player.x - car.x, dy = player.y - car.y;
      const fwd = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const lat = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
      if (fwd > 0 && fwd < TRAFFIC.brakeDist && Math.abs(lat) < 20) limit = 0;
    }
    const accel = car.speed < limit ? 1 : -1;
    const res = driveVehicle(car, dt, world, accel, 0, car.speed > limit, cars);
    if (res.crash > 90) {
      car.health -= res.crash * 0.08;
      combat.sparks(car.x, car.y);
      if (res.other && res.other.driver === 'ai') res.other.health -= res.crash * 0.05;
    }
    if (car.health <= 0) { this.wreckCar(car, combat); return; }

    // Reached the intersection: keep going or pick a turn.
    const dToTarget = dist(car.x, car.y, ai.target.x, ai.target.y);
    if (dToTarget < 46) {
      const node = this.world.nearestNode(car.x, car.y);
      const options = [];
      for (const d of DIRS) {
        if (d === OPP[ai.dir]) continue;
        const ni = d === 'E' ? node.i + 1 : d === 'W' ? node.i - 1 : node.i;
        const nj = d === 'S' ? node.j + 1 : d === 'N' ? node.j - 1 : node.j;
        if (ni < 0 || ni > 10 || nj < 0 || nj > 10) continue;
        if (d === 'E' && ni * BLOCK > WATER_X - ROAD) continue;
        options.push(d);
      }
      let next = ai.dir;
      if (options.length && this.rng() < 0.34) next = pick(this.rng, options);
      else if (!options.includes(next) && options.length) next = pick(this.rng, options);
      ai.dir = next;
      ai.target = this.nextTarget(car, next);
    }

    // Unstick: if nearly stopped for a while, nudge sideways.
    if (Math.abs(car.speed) < 12) car.stuckTimer += dt; else car.stuckTimer = 0;
    if (car.stuckTimer > 2.2) {
      car.stuckTimer = 0;
      car.angle += (this.rng() < 0.5 ? -1 : 1) * 0.9;
      car.speed = t.maxSpeed * 0.3;
    }
  }

  wreckCar(car, combat) {
    car.wreck = true;
    car.driver = null;
    car.speed = 0;
    combat.explosion(car.x, car.y);
    if (car.onWreck) car.onWreck();
  }
}

export function dirAngle(dir) {
  return { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 }[dir];
}
