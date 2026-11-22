// Story missions: five jobs given by Riley's contacts Mara and Dex. Markers are
// yellow circles on the map and minimap; walking or driving into one starts the
// job, and each stage updates the objective text in the HUD.

import { MISSIONS } from './config.js';
import { dist } from './util.js';
import { createVehicle } from './vehicles.js';
import { audio } from './audio.js';

export class MissionSystem {
  constructor(world) {
    this.world = world;
    this.index = 0; // next mission to offer
    this.active = null; // the running mission object
    this.stage = -1;
    this.stageTimer = 0;
    this.msg = null; // {title, body, timer} phone-style banner
    this.done = false;
    this.rivals = [];
    this.missionVehicles = [];
    this.packageCarried = false;
    this.completedCount = 0;
  }

  // The world position of the current objective marker, if any.
  marker() {
    if (!this.active || this.stage < 0) return null;
    const s = this.active.stages[this.stage];
    if (s.type === 'steal') {
      const v = this.missionVehicles.find((v) => v.mission && !v.wreck);
      return v ? { x: v.x, y: v.y } : null;
    }
    if (s.type === 'kill') {
      const r = this.rivals[0];
      return r && !r.dead ? { x: r.x, y: r.y } : null;
    }
    if (s.x !== undefined) return { x: s.x, y: s.y };
    return null;
  }

  objectiveText() {
    if (!this.active || this.stage < 0) return null;
    const s = this.active.stages[this.stage];
    let text = s.text;
    if (s.type === 'survive') text += ` — ${Math.max(0, Math.ceil(s.time - this.stageTimer))}s`;
    return text;
  }

  // Offer marker for the next mission (or none after the finale).
  offerMarker() {
    if (this.active || this.done || this.index >= MISSIONS.length) return null;
    const m = MISSIONS[this.index];
    // The first marker sits at the mission's first stage target.
    const s = m.stages[0];
    if (s.type === 'steal') return { x: s.vx, y: s.vy };
    if (s.x !== undefined) return { x: s.x, y: s.y };
    return null;
  }

  startMission() {
    if (this.active || this.index >= MISSIONS.length) return;
    const m = MISSIONS[this.index];
    this.active = m;
    this.stage = -1;
    this.advance();
    this.msg = { title: m.giver, body: m.intro, timer: 6 };
    audio.chime();
  }

  advance() {
    this.stage++;
    this.stageTimer = 0;
    const m = this.active;
    if (this.stage >= m.stages.length) {
      // Payout and cleanup.
      this.completedCount++;
      this.index++;
      this.active = null;
      this.stage = -1;
      this.rivals = [];
      this.missionVehicles = [];
      this.packageCarried = false;
      this.msg = { title: m.giver, body: `Nice work, Riley. $${m.reward} is yours.`, timer: 5 };
      this.rewardPending = m.reward;
      audio.chime();
      if (this.index >= MISSIONS.length) this.done = true;
      return;
    }
    const s = m.stages[this.stage];
    if (s.type === 'steal') {
      const v = createVehicle(s.vehicle, s.vx, s.vy, 0, s.vcolor);
      v.mission = true;
      v.driver = null;
      this.missionVehicles.push(v);
    }
    if (s.type === 'kill') {
      this.rivals = [{
        x: s.x, y: s.y, angle: 0, radius: 10,
        health: 130, maxHealth: 130, hurtFlash: 0, dead: false,
        fireTimer: 1.2, name: 'Vito',
      }];
    }
    if (s.type === 'survive') {
      // The heat is pinned while the stage runs; police.onMission pins wanted.
      this.surviveWanted = s.wanted;
    }
    if (s.type === 'collect') {
      // A package pickup appears at the marker.
      this.packageAt = { x: s.x, y: s.y };
    }
    this.msg = { title: m.giver, body: s.text, timer: 3.4 };
  }

  update(dt, player, game) {
    if (this.msg) {
      this.msg.timer -= dt;
      if (this.msg.timer <= 0) this.msg = null;
    }
    if (this.rewardPending) {
      player.money += this.rewardPending;
      game.combat.floatText(player.x, player.y - 30, `+$${this.rewardPending}`);
      this.rewardPending = 0;
    }
    if (!this.active) {
      // Starting a mission: walk into the offer marker.
      const om = this.offerMarker();
      if (om && dist(player.x, player.y, om.x, om.y) < 64) this.startMission();
      return;
    }

    const m = this.active;
    const s = m.stages[this.stage];
    this.stageTimer += dt;

    if (s.type === 'survive') {
      // Pin the wanted level while surviving.
      if (game.police.wanted < this.surviveWanted) game.police.wanted = this.surviveWanted;
      game.police.crimeTimer = 0;
      if (this.stageTimer >= s.time) this.advance();
      return;
    }

    if (s.type === 'steal') {
      const v = this.missionVehicles.find((v) => v.mission && !v.wreck);
      if (!v) { this.fail(); return; }
      if (player.inVehicle === v) this.advance();
      return;
    }

    if (s.type === 'deliver') {
      const v = this.missionVehicles.find((v) => v.mission && !v.wreck);
      if (!v) { this.fail(); return; }
      const t = { x: s.x, y: s.y };
      if (player.inVehicle === v && dist(player.x, player.y, t.x, t.y) < 90) {
        // Hand the keys over: the vehicle becomes a normal parked car.
        v.mission = false;
        this.advance();
      }
      return;
    }

    if (s.type === 'collect') {
      const t = { x: s.x, y: s.y };
      if (dist(player.x, player.y, t.x, t.y) < 60) {
        this.packageCarried = true;
        this.packageAt = null;
        game.combat.floatText(player.x, player.y - 26, 'PACKAGE', '#e8a040');
        audio.pickup();
        this.advance();
      }
      return;
    }

    if (s.type === 'deliverpkg') {
      const t = { x: s.x, y: s.y };
      if (this.packageCarried && dist(player.x, player.y, t.x, t.y) < 60) {
        this.packageCarried = false;
        game.combat.floatText(player.x, player.y - 26, 'DELIVERED', '#9ee86a');
        audio.chime();
        this.advance();
      }
      return;
    }

    if (s.type === 'goto') {
      const t = { x: s.x, y: s.y };
      if (dist(player.x, player.y, t.x, t.y) < 64) this.advance();
      return;
    }

    if (s.type === 'kill') {
      const rival = this.rivals[0];
      if (!rival || rival.dead) { this.advance(); return; }
      // Rival AI: close in and shoot.
      rival.hurtFlash = Math.max(0, rival.hurtFlash - dt);
      rival.fireTimer -= dt;
      const d = dist(rival.x, rival.y, player.x, player.y);
      const want = Math.atan2(player.y - rival.y, player.x - rival.x);
      rival.angle = want;
      if (d > 220) {
        const sp = 95 * dt;
        const nx = rival.x + Math.cos(want) * sp;
        const ny = rival.y + Math.sin(want) * sp;
        if (!game.world.isBlocked(nx, ny, rival.radius)) { rival.x = nx; rival.y = ny; }
      }
      if (d < 460 && rival.fireTimer <= 0 && game.state === 'playing') {
        rival.fireTimer = 0.9;
        game.combat.fire(rival, want + (Math.random() - 0.5) * 0.1, { enemy: true, owner: 'rival' });
      }
      if (rival.health <= 0) {
        rival.dead = true;
        game.combat.blood(rival.x, rival.y, rival.angle);
        game.combat.dropMoney(rival.x, rival.y, 120);
      }
      return;
    }
  }

  fail() {
    // The mission vehicle was destroyed: the job is off, try again from the marker.
    this.active = null;
    this.stage = -1;
    this.rivals = [];
    this.missionVehicles = [];
    this.packageCarried = false;
    this.msg = { title: 'Mara', body: 'You wrecked the ride, Riley. The job is off — come back when you can handle a car.', timer: 5 };
  }
}
