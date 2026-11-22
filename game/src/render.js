// Rendering: everything drawn to the canvas. World space (ground, roads,
// buildings, entities, effects) under a camera transform; screen space (warm sun
// tint, hurt flash, HUD, menus) on top. Draw order matters: ground first, HUD last.

import { WORLD, BLOCK, ROAD, WATER_X, BEACH_X, COLORS, VEHICLE_TYPES } from './config.js';
import { clamp, TAU } from './util.js';
import { roundRect, drawHUD, drawStartScreen, drawPauseMenu, drawWasted, drawBusted } from './hud.js';

export function render(ctx, game) {
  const canvas = game.canvas;
  const cam = game.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;

  // --- world space ---
  ctx.save();
  ctx.translate(canvas.width / 2 + cam.shakeX, canvas.height / 2 + cam.shakeY);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  const view = viewRect(game);
  drawGround(ctx, game, view);
  drawRoads(ctx, view);
  drawParks(ctx, game, view);
  drawBuildings(ctx, game, view);
  drawTrees(ctx, game, view);
  drawPickups(ctx, game, view);
  drawPeds(ctx, game, view);
  drawVehicles(ctx, game, view);
  drawRivals(ctx, game, view);
  if (!game.player.inVehicle) drawPlayer(ctx, game);
  drawBullets(ctx, game, view);
  drawParticles(ctx, game, view);
  drawMarkers(ctx, game);

  ctx.restore();

  // --- screen space ---
  drawSunTint(ctx, game);
  drawVignette(ctx, game);
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(200,30,20,${game.flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (game.state === 'start') drawStartScreen(ctx, game);
  else if (game.state === 'playing' || game.state === 'wasted' || game.state === 'busted') {
    drawHUD(ctx, game);
    if (game.state === 'wasted') drawWasted(ctx, game);
    if (game.state === 'busted') drawBusted(ctx, game);
  } else if (game.state === 'paused') {
    drawHUD(ctx, game);
    drawPauseMenu(ctx, game);
  }
}

function viewRect(game) {
  const cam = game.camera, c = game.canvas;
  const hw = (c.width / 2) / cam.scale + 80;
  const hh = (c.height / 2) / cam.scale + 80;
  return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
}

const inView = (view, x, y, pad = 40) => x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad;

function drawGround(ctx, game, view) {
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Beach strip then ocean on the east edge.
  ctx.fillStyle = COLORS.beach;
  ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, WORLD);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(WATER_X, 0, WORLD - WATER_X, WORLD);
  // A darker deep-water band and gentle wave lines.
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(WATER_X + 160, 0, WORLD - WATER_X - 160, WORLD);
  ctx.strokeStyle = COLORS.wave;
  ctx.lineWidth = 2;
  for (let k = 0; k < 9; k++) {
    const y = 260 + k * 440;
    if (y < view.y0 - 60 || y > view.y1 + 60) continue;
    ctx.beginPath();
    for (let x = WATER_X + 30; x < WORLD - 40; x += 90) {
      const off = Math.sin(game.time * 1.4 + x * 0.02 + k) * 7;
      if (x === WATER_X + 30) ctx.moveTo(x, y + off);
      else ctx.lineTo(x, y + off);
    }
    ctx.stroke();
  }
  // The pier at the docks.
  ctx.fillStyle = COLORS.pierDark;
  ctx.fillRect(3500, 2330, 230, 140);
  ctx.fillStyle = COLORS.pier;
  for (let i = 0; i < 6; i++) ctx.fillRect(3500, 2340 + i * 22, 230, 12);
}

function drawRoads(ctx, view) {
  ctx.fillStyle = COLORS.road;
  // Vertical roads.
  for (let i = 0; i <= 10; i++) {
    const x = i * BLOCK - ROAD / 2;
    if (x > view.x1 || x + ROAD < view.x0) continue;
    ctx.fillRect(x, Math.max(0, view.y0), ROAD, Math.min(WORLD, view.y1) - Math.max(0, view.y0));
  }
  // Horizontal roads.
  for (let j = 0; j <= 10; j++) {
    const y = j * BLOCK - ROAD / 2;
    if (y > view.y1 || y + ROAD < view.y0) continue;
    ctx.fillRect(Math.max(0, view.x0), y, Math.min(WORLD, view.x1) - Math.max(0, view.x0), ROAD);
  }
  // Sidewalk slabs: a light band around every block interior.
  ctx.fillStyle = COLORS.sidewalk;
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const x = i * BLOCK + ROAD / 2 + 4, y = j * BLOCK + ROAD / 2 + 4;
      if (x > view.x1 || y > view.y1 || x + BLOCK - ROAD - 8 < view.x0 || y + BLOCK - ROAD - 8 < view.y0) continue;
      if (i >= 9) continue;
      ctx.fillRect(x, y, BLOCK - ROAD - 8, BLOCK - ROAD - 8);
    }
  }
  // Lane dashes between intersections.
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const x = i * BLOCK;
    if (x < view.x0 - 40 || x > view.x1 + 40) continue;
    for (let j = 0; j < 10; j++) {
      ctx.moveTo(x, j * BLOCK + ROAD / 2 + 6);
      ctx.lineTo(x, (j + 1) * BLOCK - ROAD / 2 - 6);
    }
  }
  for (let j = 0; j <= 10; j++) {
    const y = j * BLOCK;
    if (y < view.y0 - 40 || y > view.y1 + 40) continue;
    for (let i = 0; i < 9; i++) {
      ctx.moveTo(i * BLOCK + ROAD / 2 + 6, y);
      ctx.lineTo((i + 1) * BLOCK - ROAD / 2 - 6, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawParks(ctx, game, view) {
  for (const p of game.world.parks) {
    if (p.x > view.x1 || p.y > view.y1 || p.x + p.w < view.x0 || p.y + p.h < view.y0) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = COLORS.parkDark;
    ctx.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
    // A cross path through the park.
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(p.x + p.w / 2 - 10, p.y, 20, p.h);
    ctx.fillRect(p.x, p.y + p.h / 2 - 10, p.w, 20);
  }
}

function drawBuildings(ctx, game, view) {
  for (const b of game.world.buildings) {
    if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;
    // Fake height: a shadow slab offset toward the sun's back-azimuth.
    ctx.fillStyle = COLORS.buildingShadow;
    ctx.fillRect(b.x + b.hh * 0.32, b.y + b.hh * 0.32, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof slab, lighter, inset like a parapet.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.downtown) {
      // Rooftop AC units and a glass crown on towers.
      ctx.fillStyle = 'rgba(120,140,160,0.7)';
      const n = Math.min(4, Math.floor(b.w / 46));
      for (let k = 0; k < n; k++) {
        ctx.fillRect(b.x + 12 + k * 40, b.y + 12, 22, 16);
        ctx.fillRect(b.x + 12 + k * 40, b.y + b.h - 28, 22, 16);
      }
      ctx.fillStyle = 'rgba(200,220,235,0.5)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    } else {
      // Houses get a rooftop edge and a small stair hut.
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 5);
      ctx.fillStyle = 'rgba(150,130,100,0.8)';
      ctx.fillRect(b.x + b.w * 0.4, b.y + b.h * 0.4, 18, 14);
    }
  }
}

function drawTrees(ctx, game, view) {
  for (const t of game.world.trees) {
    if (!inView(view, t.x, t.y)) continue;
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.trunk;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.treeLight;
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, TAU);
    ctx.fill();
  }
}

function drawPickups(ctx, game, view) {
  for (const p of game.combat.pickups) {
    if (!inView(view, p.x, p.y)) continue;
    const bob = Math.sin(p.bob) * 2.5;
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 10, 5, 0, 0, TAU);
    ctx.fill();
    if (p.kind === 'money') {
      ctx.fillStyle = '#3fae5a';
      roundRect(ctx, p.x - 9, p.y - 6 + bob, 18, 13, 2);
      ctx.fill();
      ctx.fillStyle = '#d8f0c0';
      ctx.font = 'bold 10px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 4 + bob);
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#f0f0f0';
      roundRect(ctx, p.x - 10, p.y - 10 + bob, 20, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#d03030';
      ctx.fillRect(p.x - 7, p.y - 2 + bob, 14, 4);
      ctx.fillRect(p.x - 2, p.y - 7 + bob, 4, 14);
    } else if (p.kind === 'ammo') {
      ctx.fillStyle = '#b8a050';
      ctx.fillRect(p.x - 9, p.y - 6 + bob, 18, 12);
      ctx.fillStyle = '#e8d090';
      ctx.fillRect(p.x - 6, p.y - 3 + bob, 4, 6);
      ctx.fillRect(p.x + 1, p.y - 3 + bob, 4, 6);
    } else if (p.kind === 'package') {
      ctx.fillStyle = '#8a5a30';
      ctx.fillRect(p.x - 10, p.y - 8 + bob, 20, 16);
      ctx.strokeStyle = '#5a3a20';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 10, p.y - 8 + bob, 20, 16);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 8 + bob);
      ctx.lineTo(p.x, p.y + 8 + bob);
      ctx.stroke();
    }
  }
}

function drawPeds(ctx, game, view) {
  for (const ped of game.peds.peds) {
    if (!inView(view, ped.x, ped.y)) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.pants, ped.walkCycle, ped.state === 'dead' ? clamp(1 - ped.deadTimer / 10, 0, 1) : 1, ped.hurtFlash, ped.state === 'flee');
  }
}

function drawPerson(ctx, x, y, angle, shirt, skin, pants, walkCycle, alpha, hurtFlash, running) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Shadow.
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 4, 10, 7, 0, 0, TAU);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bob = Math.sin(walkCycle) * (running ? 2.4 : 1.3);
  // Legs.
  ctx.fillStyle = pants;
  ctx.fillRect(-4, -6, 8, 5);
  ctx.fillRect(-4, 1, 8, 5);
  // Torso.
  ctx.fillStyle = hurtFlash > 0 ? '#ffffff' : shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, TAU);
  ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1.5 + bob * 0.2, 0, 4.4, 0, TAU);
  ctx.fill();
  // Arms when running.
  if (running) {
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(8 + Math.sin(walkCycle) * 3, -9);
    ctx.moveTo(0, 5);
    ctx.lineTo(8 - Math.sin(walkCycle) * 3, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVehicles(ctx, game, view) {
  const all = [...game.traffic.cars, ...game.police.cars, ...game.missions.missionVehicles];
  for (const v of all) {
    if (!inView(view, v.x, v.y, 90)) continue;
    drawVehicle(ctx, v, game);
  }
}

export function drawVehicle(ctx, v, game) {
  ctx.save();
  // Shadow (world-aligned, slightly offset).
  ctx.fillStyle = COLORS.shadow;
  ctx.translate(v.x + 5, v.y + 6);
  ctx.rotate(v.angle);
  roundRect(ctx, -v.l / 2, -v.w / 2, v.l, v.w, 7);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  const flash = v.flash > 0;
  // Body.
  ctx.fillStyle = v.wreck ? '#3a3a3e' : flash ? '#ffffff' : v.color;
  roundRect(ctx, -v.l / 2, -v.w / 2, v.l, v.w, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!v.wreck) {
    // Roof / cabin.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, -v.l * 0.28, -v.w / 2 + 3.5, v.l * 0.5, v.w - 7, 4);
    ctx.fill();
    // Windshield and rear glass.
    ctx.fillStyle = 'rgba(150,200,225,0.85)';
    ctx.fillRect(v.l * 0.14, -v.w / 2 + 5.5, v.l * 0.09, v.w - 11);
    ctx.fillStyle = 'rgba(120,160,185,0.7)';
    ctx.fillRect(-v.l * 0.26, -v.w / 2 + 5.5, v.l * 0.08, v.w - 11);
    if (v.type === 'police') {
      // Lightbar: red over blue.
      ctx.fillStyle = '#d03030';
      ctx.fillRect(-4, -v.w / 2 + 4, 8, (v.w - 8) / 2);
      ctx.fillStyle = '#3060d0';
      ctx.fillRect(-4, 0, 8, (v.w - 8) / 2);
      if (Math.sin(game.time * 10) > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-5, -v.w / 2 + 3.5, 10, v.w - 7);
      }
    }
    if (v.mission) {
      // Mission vehicles glow so the player can find them.
      ctx.strokeStyle = `rgba(244,208,64,${0.5 + 0.4 * Math.sin(game.time * 4)})`;
      ctx.lineWidth = 2.5;
      roundRect(ctx, -v.l / 2 - 4, -v.w / 2 - 4, v.l + 8, v.w + 8, 9);
      ctx.stroke();
    }
    // Health bar when damaged.
    if (v.health < v.maxHealth && v.driver === 'player') {
      const f = clamp(v.health / v.maxHealth, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-v.l / 2, -v.w / 2 - 9, v.l, 4);
      ctx.fillStyle = f > 0.4 ? '#4fbf4f' : '#d04030';
      ctx.fillRect(-v.l / 2, -v.w / 2 - 9, v.l * f, 4);
    }
  } else {
    // Wreck: scorch marks.
    ctx.fillStyle = 'rgba(20,20,20,0.5)';
    ctx.fillRect(-v.l / 2 + 4, -v.w / 2 + 4, v.l * 0.4, v.w - 8);
  }
  ctx.restore();
}

function drawRivals(ctx, game, view) {
  for (const r of game.missions.rivals) {
    if (r.dead) continue;
    if (!inView(view, r.x, r.y)) continue;
    drawPerson(ctx, r.x, r.y, r.angle, '#a02020', '#d8a878', '#2a2a2a', game.time * 3, 1, r.hurtFlash, true);
    // Health bar.
    const f = clamp(r.health / r.maxHealth, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.x - 16, r.y - 22, 32, 4);
    ctx.fillStyle = f > 0.4 ? '#d04030' : '#a02020';
    ctx.fillRect(r.x - 16, r.y - 22, 32 * f, 4);
  }
}

export function drawPlayer(ctx, game) {
  const p = game.player;
  drawPerson(ctx, p.x, p.y, p.angle, '#f0f0f0', '#e8b890', '#2f3f5f', p.walkCycle, 1, p.hurtFlash > 0, false);
  // Pistol pointing at the aim direction.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(6, -2.5, 13, 5);
  ctx.fillStyle = '#44444c';
  ctx.fillRect(4, 1.5, 5, 4);
  ctx.restore();
}

function drawBullets(ctx, game, view) {
  for (const b of game.combat.bullets) {
    if (!inView(view, b.x, b.y)) continue;
    ctx.strokeStyle = b.enemy ? '#ff9a5a' : '#fff0b0';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, game, view) {
  for (const p of game.combat.particles) {
    if (p.kind === 'text') {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.font = 'bold 15px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
      continue;
    }
    if (!inView(view, p.x, p.y, 30)) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = p.kind === 'smoke' ? a * 0.6 : a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    const pr = Math.max(0.5, p.r * (p.kind === 'ring' ? 1 : a * 0.7 + 0.3));
    ctx.arc(p.x, p.y, pr, 0, TAU);
    if (p.kind === 'ring') ctx.stroke();
    else ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawMarkers(ctx, game) {
  const draw = (m) => {
    if (!m) return;
    const pulse = 1 + Math.sin(game.time * 4) * 0.18;
    ctx.strokeStyle = `rgba(244,208,64,${0.55 + 0.3 * Math.sin(game.time * 4)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 30 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(244,208,64,0.16)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 30 * pulse, 0, TAU);
    ctx.fill();
    // A beam of light so the marker is visible over buildings.
    ctx.fillStyle = 'rgba(244,208,64,0.10)';
    ctx.beginPath();
    ctx.moveTo(m.x - 9, m.y);
    ctx.lineTo(m.x + 9, m.y);
    ctx.lineTo(m.x, m.y - 74);
    ctx.closePath();
    ctx.fill();
  };
  draw(game.missions.marker());
  draw(game.missions.offerMarker());
  // Package pickup marker.
  const pkg = game.missions.packageAt;
  if (pkg) {
    ctx.fillStyle = '#e8a040';
    ctx.beginPath();
    ctx.arc(pkg.x, pkg.y, 8 + Math.sin(game.time * 5) * 2, 0, TAU);
    ctx.fill();
  }
}

// --- screen-space post effects ---

function drawSunTint(ctx, game) {
  ctx.fillStyle = 'rgba(255,190,105,0.07)';
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
}

function drawVignette(ctx, game) {
  const w = game.canvas.width, h = game.canvas.height;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(30,16,8,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

