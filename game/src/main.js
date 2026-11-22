// Sunset City — main entry. Builds the world, systems and player, runs the
// game loop and the state machine (start → playing → paused/wasted/busted),
// saves progress to localStorage, and wires the systems together.

import { WORLD, PLACES, SAVE_KEY, VEHICLE_TYPES } from './config.js';
import { createWorld } from './world.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayer, hurtPlayer, crashInVehicle, exitVehicle } from './player.js';
import { TrafficSystem } from './vehicles.js';
import { PedSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { CombatSystem } from './combat.js';
import { audio, initAudio, resumeAudio } from './audio.js';
import { render } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const world = createWorld();
const game = {
  state: 'start',
  // Exposed for live debugging and automated play-tests (harmless in play).
  get debug() { return true; },
  canvas, ctx, world,
  camera: createCamera(),
  input: createInput(canvas),
  player: createPlayer(world),
  traffic: new TrafficSystem(world),
  peds: new PedSystem(world),
  police: new PoliceSystem(world),
  missions: new MissionSystem(world),
  combat: new CombatSystem(),
  time: 0,
  flash: 0,
  hasSave: !!localStorage.getItem(SAVE_KEY),
  respawnTimer: 0,
  saveTimer: 0,
  shotMode: null,
};

// --- callbacks the systems need (avoid circular imports) ---
game.player.vehicleCrash = (amt) => crashInVehicle(game.player, amt, game);
game.player.hurt = (amt) => hurtPlayer(game.player, amt, game);
game.onShotFired = () => {
  // Gunfire near peds makes them flee (handled in peds via combat.lastShot).
  game.police.crimeTimer = 0;
};
game.onPedHit = () => game.police.addWanted(0.6, game);
game.onPedKilled = () => game.police.addWanted(1, game);
game.onCarjack = () => {};
game.onCrime = () => {};

game.wastePlayer = () => {
  game.state = 'wasted';
  game.respawnTimer = 2.6;
  audio.stopEngine();
  audio.hurt();
};
game.bustPlayer = () => {
  game.state = 'busted';
  game.respawnTimer = 2.6;
  audio.stopEngine();
};
game.respawn = (place, moneyFactor) => {
  const p = game.player;
  if (p.inVehicle) exitVehicle(p, world, game);
  p.x = place.x; p.y = place.y;
  p.health = p.maxHealth;
  p.money = Math.floor(p.money * moneyFactor);
  p.inVehicle = null;
  p.hasPackage = false;
  game.police.clear();
  game.missions.packageCarried = false;
  game.state = 'playing';
  game.camera.x = p.x; game.camera.y = p.y;
};

function saveGame() {
  const p = game.player;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: p.money, missionIdx: game.missions.index,
      x: p.x, y: p.y, health: p.health, ammo: p.ammo,
      completed: game.missions.completedCount,
    }));
    game.hasSave = true;
    game.combat.floatText(p.x, p.y - 30, 'GAME SAVED', '#a0c0f0');
  } catch (err) { /* storage unavailable — ignore */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const p = game.player;
    p.money = s.money || 0;
    p.x = s.x; p.y = s.y;
    p.health = s.health || p.maxHealth;
    p.ammo = s.ammo ?? 30;
    game.missions.index = s.missionIdx || 0;
    game.missions.completedCount = s.completed || 0;
    game.camera.x = p.x; game.camera.y = p.y;
    return true;
  } catch (err) { return false; }
}

// --- screenshot mode ---
const shotParam = new URLSearchParams(window.location.search).get('shot');
if (shotParam) {
  game.shotMode = Number(shotParam);
  setupShot(game, game.shotMode);
}

let last = performance.now();

function step(dt) {
  game.time += dt;
  game.flash = Math.max(0, game.flash - dt * 1.6);
  const input = game.input;
  const player = game.player;

  if (game.state === 'start') {
    if (input.wasPressed('Enter')) {
      initAudio();
      resumeAudio();
      game.state = 'playing';
    } else if (input.wasPressed('KeyC') && game.hasSave) {
      initAudio();
      resumeAudio();
      if (loadGame()) game.state = 'playing';
    }
    if (!game.shotMode) game.camera.orbit(game.time);
    return;
  }

  if (game.state === 'paused') {
    if (input.wasPressed('Escape')) game.state = 'playing';
    if (input.wasPressed('KeyM')) saveGame();
    if (input.wasPressed('KeyT')) {
      game.state = 'start';
      game.police.clear();
    }
    return;
  }

  if (game.state === 'wasted' || game.state === 'busted') {
    game.respawnTimer -= dt;
    if (game.respawnTimer <= 0) {
      if (game.state === 'wasted') game.respawn(PLACES.hospital, 0.9);
      else game.respawn(PLACES.policeStation, 0.85);
    }
    return;
  }

  // --- playing ---
  if (input.wasPressed('Escape')) { game.state = 'paused'; audio.stopEngine(); return; }
  if (input.wasPressed('KeyM')) saveGame();

  updatePlayer(player, dt, input, world, game);

  // Keep the mouse world position in sync with the camera.
  const cam = game.camera;
  input.mouse.worldX = cam.x + (input.mouse.x - canvas.width / 2) / cam.scale;
  input.mouse.worldY = cam.y + (input.mouse.y - canvas.height / 2) / cam.scale;

  game.traffic.update(dt, world, player, game.combat, game.police);
  game.peds.update(dt, world, player, game.combat, game);
  game.police.update(dt, world, player, game);
  game.missions.update(dt, player, game);
  game.combat.update(dt, world, {
    player, peds: game.peds.peds, cops: game.police.cops,
    rivals: game.missions.rivals,
    vehicles: [...game.traffic.cars, ...game.police.cars, ...game.missions.missionVehicles],
  });

  // Siren while the heat is on.
  audio.siren(game.police.stars() >= 2);
  audio.update(dt);

  // Camera mode from the player's situation.
  let mode = 'foot';
  if (player.inVehicle) {
    const sp = Math.abs(player.inVehicle.speed);
    mode = sp > 150 ? 'drivefast' : 'drive';
  }
  cam.update(player, dt, mode);

  // Autosave every 45 seconds.
  game.saveTimer += dt;
  if (game.saveTimer > 45) { game.saveTimer = 0; saveGame(); }
}

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp big stalls (tab switches)
  if (dt < 0) dt = 0; // headless Chrome's first rAF timestamp can predate module load
  step(dt);
  render(ctx, game);
  game.input.clearEdges();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for automated play-tests and debugging; not used by the game itself.
window.__game = game;
