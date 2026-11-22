// Screenshot mode: ?shot=N sets up a composed scene so headless Chrome can capture
// specific game states without playing. 1 = start screen, 2 = driving with HUD,
// 3 = on-foot police chase, 4 = a mission in progress.

import { createVehicle } from './vehicles.js';
import { audio } from './audio.js';

export function setupShot(game, n) {
  const { player, traffic, peds, police, missions, combat, world, camera } = game;
  audio.init();

  if (n === 1) {
    // Start screen over a scenic downtown view (the start state pans anyway).
    game.state = 'start';
    camera.x = 1600; camera.y = 1600; camera.scale = 0.75;
    return;
  }

  if (n === 2) {
    // Driving through traffic on a main road, HUD and minimap visible.
    game.state = 'playing';
    const car = createVehicle('sports', 1400, 2018, 0, '#d94f2f');
    car.driver = 'player';
    car.speed = 210;
    player.inVehicle = car;
    player.x = car.x; player.y = car.y;
    traffic.cars.push(car);
    // Traffic ahead in the same lane, all heading east.
    for (let i = 0; i < 5; i++) {
      const c = traffic.spawn();
      c.x = 1780 + i * 150; c.y = 2018;
      c.angle = 0; c.speed = 130 + i * 18;
      c.ai.dir = 'E';
      c.ai.target = traffic.nextTarget(c, 'E');
    }
    peds.spawnExtra(6);
    camera.x = car.x; camera.y = car.y;
    return;
  }

  if (n === 3) {
    // On foot, three-star heat, shooting, cops closing in.
    game.state = 'playing';
    police.wanted = 3.4;
    police.crimeTimer = 0;
    player.x = 1600; player.y = 2200;
    player.ammo = 99;
    player.health = 160;
    // Force the player to shoot toward the right for the capture.
    game.input.mouse.worldX = player.x + 300;
    game.input.mouse.worldY = player.y;
    game.input.mouse.x = game.canvas.width / 2 + 260;
    game.input.mouse.y = game.canvas.height / 2;
    game.input.mouse.down = true;
    for (let i = 0; i < 3; i++) police.spawnCar(player);
    for (let i = 0; i < 2; i++) police.spawnCop(player);
    // Put the cops in view, some on foot close by.
    police.cops[0].x = player.x + 190; police.cops[0].y = player.y - 60;
    police.cops[1].x = player.x + 150; police.cops[1].y = player.y + 90;
    police.cars[0].x = player.x + 330; police.cars[0].y = player.y + 120;
    police.cars[1].x = player.x - 280; police.cars[1].y = player.y - 140;
    police.cars[2].x = player.x + 60; police.cars[2].y = player.y - 300;
    peds.spawnExtra(8);
    // A couple of burning wrecks for drama.
    combat.explosion(player.x - 380, player.y + 60);
    camera.x = player.x; camera.y = player.y;
    return;
  }

  if (n === 4) {
    // Mid-mission: package run, objective text and marker visible.
    game.state = 'playing';
    missions.index = 1;
    missions.startMission();
    missions.stage = 1; // first delivery, package already in hand
    missions.packageCarried = true;
    missions.packageAt = null;
    const car = createVehicle('sedan', 1000, 1300, -0.6, '#4f7fc9');
    car.driver = 'player';
    car.speed = 140;
    player.inVehicle = car;
    player.x = car.x; player.y = car.y;
    traffic.cars.push(car);
    for (let i = 0; i < 4; i++) traffic.spawn();
    peds.spawnExtra(5);
    camera.x = car.x; camera.y = car.y;
    return;
  }
}
