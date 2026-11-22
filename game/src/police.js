// Police: the wanted system (0-5 stars), police cars that chase and ram, and
// armed officers on foot who shoot and make arrests. Heat rises with crimes and
// cools when the player lays low.

import { POLICE, WANTED, VEHICLE_TYPES, BLOCK } from './config.js';
import { createVehicle, driveVehicle } from './vehicles.js';
import { roadPoint } from './world.js';
import { clamp, dist, dist2, angLerp, makeRng, TAU } from './util.js';

export class PoliceSystem {
  constructor(world) {
    this.world = world;
    this.rng = makeRng(9001);
    this.wanted = 0;
    this.crimeTimer = 0;
    this.cars = [];
    this.cops = [];
  }

  stars() { return Math.min(WANTED.max, Math.ceil(this.wanted)); }

  addWanted(n, game) {
    this.wanted = clamp(this.wanted + n, 0, WANTED.max);
    this.crimeTimer = 0;
    if (game && game.onCrime) game.onCrime(n);
  }

  clear() { this.wanted = 0; this.crimeTimer = 0; this.cars.length = 0; this.cops.length = 0; }

  update(dt, world, player, game) {
    // Heat decays only after the player stops committing crimes.
    this.crimeTimer += dt;
    if (this.crimeTimer > WANTED.decayDelay && this.wanted > 0) {
      this.wanted = Math.max(0, this.wanted - WANTED.decayRate * dt);
    }
    const stars = this.stars();

    // Spawn the response.
    const wantCars = stars >= POLICE.carStars ? Math.min(stars - 1, POLICE.maxCars) : 0;
    const wantCops = stars >= POLICE.copStars ? Math.min(stars - 2, POLICE.maxCops) : 0;
    while (this.cars.length < wantCars) this.spawnCar(player);
    while (this.cops.length < wantCops) this.spawnCop(player);
    if (stars === 0) { this.cars.length = 0; this.cops.length = 0; }

    const combat = game.combat;

    // Police cars: chase the player, ram on contact.
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const car = this.cars[k];
      if (car.wreck) { this.cars.splice(k, 1); continue; }
      const d = dist(car.x, car.y, player.x, player.y);
      if (d > POLICE.chaseDespawn) { this.cars.splice(k, 1); continue; }

      const want = Math.atan2(player.y - car.y, player.x - car.x);
      const steer = clamp(((want - car.angle + Math.PI * 3) % TAU - Math.PI) / 1.2, -1, 1);
      const throttle = 1;
      const others = [...this.cars, ...game.traffic.cars];
      const res = driveVehicle(car, dt, world, throttle, steer, false, others);
      car.flash = Math.max(0, car.flash - dt);
      if (res.crash > 60) {
        car.health -= res.crash * 0.05;
        combat.sparks(car.x, car.y);
        if (res.other === player.inVehicle) {
          player.vehicleCrash(res.crash);
          game.camera.kick(Math.min(10, res.crash * 0.03));
        }
      }
      // Ram damage to the player's car on close, fast contact.
      if (player.inVehicle && d < 40 && Math.abs(car.speed) > 120) {
        player.vehicleCrash(22);
        game.camera.kick(6);
      }
      if (car.health <= 0) {
        car.wreck = true;
        combat.explosion(car.x, car.y);
        this.addWanted(WANTED.wreckCopCar, game);
        this.cars.splice(k, 1);
      }
    }

    // Officers on foot: run in, shoot, bust.
    for (let k = this.cops.length - 1; k >= 0; k--) {
      const cop = this.cops[k];
      if (cop.dead) { this.cops.splice(k, 1); continue; }
      cop.hurtFlash = Math.max(0, cop.hurtFlash - dt);
      cop.fireTimer -= dt;
      const d = dist(cop.x, cop.y, player.x, player.y);
      if (d > POLICE.chaseDespawn) { this.cops.splice(k, 1); continue; }

      const want = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = angLerp(cop.angle, want, 1 - Math.exp(-6 * dt));
      if (d > 46) {
        const sp = POLICE.copSpeed * dt;
        const nx = cop.x + Math.cos(cop.angle) * sp;
        const ny = cop.y + Math.sin(cop.angle) * sp;
        if (!world.isBlocked(nx, ny, cop.radius)) { cop.x = nx; cop.y = ny; }
        else cop.angle += 0.7; // shuffle around obstacles
      }

      // Shoot when in range.
      if (d < POLICE.copRange && cop.fireTimer <= 0 && game.state === 'playing') {
        cop.fireTimer = POLICE.copFireInterval + this.rng() * 0.5;
        combat.fire(cop, cop.angle + (this.rng() - 0.5) * 0.12, { enemy: true, owner: 'cop' });
      }

      // Bust the player on foot.
      if (!player.inVehicle && d < POLICE.bustRange && game.state === 'playing') {
        game.bustPlayer();
      }

      if (cop.health <= 0) {
        cop.dead = true;
        combat.blood(cop.x, cop.y, cop.angle);
        this.addWanted(WANTED.copKill, game);
        if (this.rng() < 0.5) combat.dropPickup('ammo', cop.x, cop.y);
      }
    }
  }

  spawnCar(player) {
    const p = this.spawnPoint(player);
    const car = createVehicle('police', p.x, p.y, p.angle);
    car.driver = 'police';
    car.speed = 60;
    this.cars.push(car);
  }

  spawnCop(player) {
    const p = this.spawnPoint(player);
    this.cops.push({
      x: p.x, y: p.y, angle: p.angle, radius: 9,
      health: POLICE.copHealth, maxHealth: POLICE.copHealth,
      fireTimer: 0.6 + this.rng(),
      hurtFlash: 0, dead: false,
    });
  }

  // A road point near the player but off-screen.
  spawnPoint(player) {
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng() * TAU;
      const d = POLICE.spawnMinDist + this.rng() * (POLICE.spawnMaxDist - POLICE.spawnMinDist);
      const x = clamp(player.x + Math.cos(a) * d, 80, 3480);
      const y = clamp(player.y + Math.sin(a) * d, 80, 3920);
      const node = this.world.nearestNode(x, y);
      const dirs = ['E', 'W', 'N', 'S'];
      const dir = dirs[Math.floor(this.rng() * 4)];
      const rp = roadPoint(clamp(node.i, 0, 10), clamp(node.j, 0, 10), dir);
      const distToPlayer = dist(rp.x, rp.y, player.x, player.y);
      if (distToPlayer > POLICE.spawnMinDist * 0.7 && !this.world.isBlocked(rp.x, rp.y, 20)) {
        return { x: rp.x, y: rp.y, angle: { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 }[dir] };
      }
    }
    return { x: player.x + 700, y: player.y, angle: 0 };
  }
}
