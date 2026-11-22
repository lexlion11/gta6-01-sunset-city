// Combat: bullets, damage, particles and pickups. Anything that shoots, bleeds,
// explodes or sparkles flows through here.

import { BULLET, COP_BULLET, COLORS } from './config.js';
import { dist, dist2, clamp, TAU } from './util.js';

export class CombatSystem {
  constructor() {
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.lastShot = null; // {x, y, time} — the most recent gunshot, makes peds flee
    this.time = 0;
  }

  // Spawn a bullet from a shooter entity ({x, y, angle}) toward `angle`.
  fire(shooter, angle, opts = {}) {
    const spec = opts.enemy ? COP_BULLET : BULLET;
    const muzzle = opts.muzzle ?? 18;
    this.bullets.push({
      x: shooter.x + Math.cos(angle) * muzzle,
      y: shooter.y + Math.sin(angle) * muzzle,
      vx: Math.cos(angle) * spec.speed,
      vy: Math.sin(angle) * spec.speed,
      life: spec.life,
      damage: spec.damage,
      enemy: !!opts.enemy,
      owner: opts.owner || null,
      trail: [],
    });
    this.lastShot = { x: shooter.x, y: shooter.y, time: this.time };
    // Muzzle flash particle.
    this.particles.push({
      kind: 'flash', x: shooter.x + Math.cos(angle) * muzzle, y: shooter.y + Math.sin(angle) * muzzle,
      r: 11, life: 0.06, maxLife: 0.06, color: '#ffe6a0',
    });
  }

  explosion(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      const sp = 60 + Math.random() * 260;
      this.particles.push({
        kind: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 4 + Math.random() * 8, life: 0.5 + Math.random() * 0.5, maxLife: 1,
        color: Math.random() < 0.5 ? '#ff9030' : '#ffd060',
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU;
      const sp = 20 + Math.random() * 90;
      this.particles.push({
        kind: 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        r: 10 + Math.random() * 14, life: 1 + Math.random(), maxLife: 2,
        color: 'rgba(60,60,60,0.5)',
      });
    }
    this.particles.push({ kind: 'ring', x, y, r: 8, life: 0.4, maxLife: 0.4, color: '#ffcc70' });
  }

  blood(x, y, angle) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (Math.random() - 0.5) * 1.6;
      const sp = 40 + Math.random() * 130;
      this.particles.push({
        kind: 'blood', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 2 + Math.random() * 3.5, life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
        color: '#a02020',
      });
    }
  }

  sparks(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const sp = 50 + Math.random() * 160;
      this.particles.push({
        kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 1.5 + Math.random() * 2, life: 0.25 + Math.random() * 0.3, maxLife: 0.55,
        color: '#ffd060',
      });
    }
  }

  floatText(x, y, text, color = '#9ee86a') {
    this.particles.push({ kind: 'text', x, y, vy: -40, life: 1.1, maxLife: 1.1, text, color });
  }

  dropMoney(x, y, amount) {
    this.pickups.push({ kind: 'money', x, y, value: amount, bob: Math.random() * TAU, life: 24 });
  }
  dropPickup(kind, x, y) {
    this.pickups.push({ kind, x, y, value: kind === 'health' ? 35 : kind === 'ammo' ? 14 : 0, bob: Math.random() * TAU, life: 30 });
  }

  // Bullets vs every hittable thing. Systems pass their entities in `groups`.
  update(dt, world, groups) {
    this.time += dt;
    const player = groups.player;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 5) b.trail.shift();
      let dead = b.life <= 0 || world.isBlocked(b.x, b.y, 2);
      if (!dead) {
        const targets = b.enemy ? [player] : [...groups.peds, ...groups.cops, ...(groups.rivals || [])];
        for (const t of targets) {
          if (!t || t.dead) continue;
          if (dist2(b.x, b.y, t.x, t.y) < (t.radius + BULLET.radius) ** 2) {
            t.health -= b.damage;
            t.hurtFlash = 0.25;
            this.blood(t.x, t.y, Math.atan2(b.vy, b.vx));
            if (t.onHit) t.onHit(b.damage);
            dead = true;
            break;
          }
        }
        if (!dead && groups.vehicles) {
          for (const v of groups.vehicles) {
            if (v.wreck || v === player.inVehicle) continue;
            const dx = b.x - v.x, dy = b.y - v.y;
            const c = Math.cos(-v.angle), s = Math.sin(-v.angle);
            const lx = dx * c - dy * s, ly = dx * s + dy * c;
            if (Math.abs(lx) < v.l / 2 + 3 && Math.abs(ly) < v.w / 2 + 3) {
              v.health -= b.damage * 0.6;
              v.flash = 0.15;
              this.sparks(b.x, b.y);
              if (v.onHit) v.onHit(b.damage);
              dead = true;
              break;
            }
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }

    // Particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
      if (p.kind === 'ring') p.r += 260 * dt;
      if (p.kind === 'smoke') p.r += 14 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Pickups: magnet toward the player, collect on touch.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      p.bob += dt * 4;
      const d = dist(p.x, p.y, player.x, player.y);
      if (d < 90) {
        p.x += (player.x - p.x) * 0.14;
        p.y += (player.y - p.y) * 0.14;
      }
      if (d < 22) {
        this.collect(player, p);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) this.pickups.splice(i, 1);
    }
  }

  collect(player, p) {
    if (p.kind === 'money') {
      player.money += p.value;
      this.floatText(player.x, player.y - 24, `+$${p.value}`);
      audioPickup();
    } else if (p.kind === 'health') {
      player.health = Math.min(player.maxHealth, player.health + p.value);
      this.floatText(player.x, player.y - 24, '+HEALTH', '#6adf6a');
      audioPickup();
    } else if (p.kind === 'ammo') {
      player.ammo += p.value;
      this.floatText(player.x, player.y - 24, '+AMMO', '#e8d090');
      audioPickup();
    } else if (p.kind === 'package') {
      player.hasPackage = true;
      this.floatText(player.x, player.y - 24, 'PACKAGE', '#e8a040');
      audioPickup();
    }
    if (p.onCollect) p.onCollect();
  }
}

// Keep the audio import lazy-free: a tiny indirection so combat.js stays standalone.
import { audio } from './audio.js';
function audioPickup() { audio.pickup(); }
