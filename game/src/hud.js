// HUD: health bar, money, wanted stars, minimap, objective text, weapon readout,
// plus the start screen, pause menu, wasted/busted overlays and the phone banner.

import { WORLD, BLOCK, ROAD, WATER_X, COLORS } from './config.js';
import { clamp } from './util.js';

const MM_SIZE = 208;
const MM_MARGIN = 16;

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawHUD(ctx, game) {
  const { player, police, missions, canvas } = game;
  const W = canvas.width, H = canvas.height;
  const stars = police.stars();

  // Health bar (top-left).
  const hbX = 20, hbY = 20, hbW = 190, hbH = 15;
  ctx.fillStyle = 'rgba(20,16,10,0.65)';
  roundRect(ctx, hbX - 4, hbY - 4, hbW + 8, hbH + 8, 5);
  ctx.fill();
  ctx.fillStyle = '#5a2020';
  roundRect(ctx, hbX, hbY, hbW, hbH, 4);
  ctx.fill();
  const frac = clamp(player.health / player.maxHealth, 0, 1);
  ctx.fillStyle = frac > 0.5 ? '#4fbf4f' : frac > 0.25 ? '#d0a030' : '#d04030';
  roundRect(ctx, hbX, hbY, hbW * frac, hbH, 4);
  ctx.fill();

  // Money.
  ctx.font = 'bold 24px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(`$${player.money}`, 22, 66);
  ctx.fillStyle = '#f0dc9c';
  ctx.fillText(`$${player.money}`, 20, 64);

  // Weapon readout.
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const wtext = player.weapon === 'pistol' ? `PISTOL  ${player.ammo}` : 'FISTS';
  ctx.fillText(wtext, 22, 88);
  ctx.fillStyle = '#d8d4c4';
  ctx.fillText(wtext, 20, 86);

  // Wanted stars (below the minimap).
  if (stars > 0) {
    for (let i = 0; i < 5; i++) {
      const sx = W - MM_MARGIN - 190 + i * 36;
      const sy = MM_MARGIN + MM_SIZE + 22;
      starPath(ctx, sx + 13, sy + 13, 12);
      ctx.fillStyle = i < stars ? '#f0c040' : 'rgba(240,240,240,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,24,10,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  drawMinimap(ctx, game);

  // Mission objective text (bottom-center).
  const obj = missions.objectiveText();
  if (obj) {
    ctx.font = 'bold 15px Verdana, sans-serif';
    const tw = ctx.measureText(obj).width + 36;
    const bx = (W - tw) / 2, by = H - 58;
    ctx.fillStyle = 'rgba(20,16,10,0.62)';
    roundRect(ctx, bx, by, tw, 34, 7);
    ctx.fill();
    ctx.fillStyle = '#f4e2a0';
    ctx.textAlign = 'center';
    ctx.fillText(obj, W / 2, by + 22);
  }

  // Phone banner (mission messages).
  if (missions.msg) {
    drawPhone(ctx, game);
  }

  // Package carried indicator.
  if (missions.packageCarried) {
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillStyle = '#e8a040';
    ctx.textAlign = 'left';
    ctx.fillText('◆ PACKAGE', 20, 110);
  }
}

function drawMinimap(ctx, game) {
  const { player, world, missions, police, canvas } = game;
  const W = canvas.width;
  const mm = MM_SIZE / WORLD;
  const x0 = W - MM_MARGIN - MM_SIZE, y0 = MM_MARGIN;

  ctx.save();
  ctx.fillStyle = 'rgba(20,16,10,0.55)';
  roundRect(ctx, x0 - 5, y0 - 5, MM_SIZE + 10, MM_SIZE + 10, 8);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x0, y0, MM_SIZE, MM_SIZE, 5);
  ctx.clip();

  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(x0, y0, MM_SIZE, MM_SIZE);
  // Ocean.
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0 + WATER_X * mm, y0, MM_SIZE, MM_SIZE);
  // Parks.
  ctx.fillStyle = COLORS.park;
  for (const p of world.parks) ctx.fillRect(x0 + p.x * mm, y0 + p.y * mm, p.w * mm, p.h * mm);
  // Roads.
  ctx.strokeStyle = COLORS.road;
  ctx.lineWidth = ROAD * mm;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    ctx.moveTo(x0 + i * BLOCK * mm, y0);
    ctx.lineTo(x0 + i * BLOCK * mm, y0 + MM_SIZE);
    ctx.moveTo(x0, y0 + i * BLOCK * mm);
    ctx.lineTo(x0 + MM_SIZE, y0 + i * BLOCK * mm);
  }
  ctx.stroke();

  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * mm, y0 + wy * mm, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Mission markers.
  const mark = (m, color, ring) => {
    if (!m) return;
    const mx = x0 + m.x * mm, my = y0 + m.y * mm;
    if (ring) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 5 + Math.sin(game.time * 5) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    dot(m.x, m.y, color, 3.4);
  };
  mark(missions.marker(), '#f4d040', true);
  mark(missions.offerMarker(), '#f4d040', true);

  // Police blips.
  ctx.fillStyle = '#5aa0ff';
  for (const c of police.cars) dot(c.x, c.y, '#5aa0ff', 3);
  for (const c of police.cops) dot(c.x, c.y, '#5aa0ff', 2.6);

  // The player as a heading arrow.
  const px = x0 + player.x * mm, py = y0 + player.y * mm;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.inVehicle ? player.inVehicle.angle : player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawPhone(ctx, game) {
  const msg = game.missions.msg;
  const W = game.canvas.width, H = game.canvas.height;
  const fade = clamp(msg.timer, 0, 0.5) * 2;
  const bw = 380, bh = 92;
  const x = 24, y = H - bh - 76 - (1 - fade) * 30;
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(18,20,26,0.92)';
  roundRect(ctx, x, y, bw, bh, 10);
  ctx.fill();
  ctx.strokeStyle = '#3a5a8a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#7aa0e0';
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(msg.title.toUpperCase(), x + 14, y + 22);
  ctx.fillStyle = '#d8dce4';
  ctx.font = '12px Verdana, sans-serif';
  wrapText(ctx, msg.body, x + 14, y + 42, bw - 28, 16, 3);
  ctx.globalAlpha = 1;
}

export function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      line = w;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

export function drawStartScreen(ctx, game) {
  const W = game.canvas.width, H = game.canvas.height;
  ctx.fillStyle = 'rgba(20,14,8,0.45)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;

  // Title with a warm gradient.
  const grad = ctx.createLinearGradient(0, H * 0.22, 0, H * 0.42);
  grad.addColorStop(0, '#ffe6a8');
  grad.addColorStop(0.5, '#f4a04a');
  grad.addColorStop(1, '#d0501e');
  ctx.font = 'bold 78px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText('SUNSET CITY', cx + 4, H * 0.34 + 4);
  ctx.fillStyle = grad;
  ctx.fillText('SUNSET CITY', cx, H * 0.34);

  ctx.font = 'italic 20px Verdana, sans-serif';
  ctx.fillStyle = '#f8e4b8';
  ctx.fillText('A tale of crime and sunshine', cx, H * 0.42);

  const pulse = 0.7 + 0.3 * Math.sin(game.time * 3.4);
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 22px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PRESS ENTER TO START', cx, H * 0.56);
  ctx.globalAlpha = 1;

  if (game.hasSave) {
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.fillStyle = '#c8d8f0';
    ctx.fillText('C — continue your career', cx, H * 0.62);
  }

  ctx.font = '13px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,240,210,0.75)';
  ctx.fillText('WASD move · mouse aim · click shoot · F punch · E enter/exit car · ESC pause', cx, H - 40);
}

export function drawPauseMenu(ctx, game) {
  const W = game.canvas.width, H = game.canvas.height;
  ctx.fillStyle = 'rgba(14,12,20,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px Verdana, sans-serif';
  ctx.fillStyle = '#f4e2b0';
  ctx.fillText('PAUSED', W / 2, H * 0.38);
  ctx.font = 'bold 17px Verdana, sans-serif';
  ctx.fillStyle = '#d8d4c4';
  ctx.fillText('ESC — resume    M — save game    T — quit to title', W / 2, H * 0.5);
}

export function drawWasted(ctx, game) {
  const W = game.canvas.width, H = game.canvas.height;
  ctx.fillStyle = 'rgba(60,10,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Verdana, sans-serif';
  ctx.fillStyle = '#e84030';
  ctx.fillText('WASTED', W / 2, H * 0.42);
  ctx.font = 'bold 18px Verdana, sans-serif';
  ctx.fillStyle = '#e8c0b0';
  ctx.fillText('Respawning at the hospital...', W / 2, H * 0.52);
}

export function drawBusted(ctx, game) {
  const W = game.canvas.width, H = game.canvas.height;
  ctx.fillStyle = 'rgba(10,20,50,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Verdana, sans-serif';
  ctx.fillStyle = '#5aa0ff';
  ctx.fillText('BUSTED', W / 2, H * 0.42);
  ctx.font = 'bold 18px Verdana, sans-serif';
  ctx.fillStyle = '#c0d0e8';
  ctx.fillText('The cops took you downtown...', W / 2, H * 0.52);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
