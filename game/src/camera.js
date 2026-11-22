// Smooth follow camera with look-ahead and speed-based zoom, plus screen shake.

import { clamp, lerp } from './util.js';

export function createCamera() {
  return {
    x: 2000, y: 2000, scale: 1.1, shake: 0, shakeX: 0, shakeY: 0,
    // Slow cinematic drift used on the start screen.
    orbit(t) {
      const a = t * 0.09;
      this.x = 2000 + Math.cos(a) * 620;
      this.y = 2000 + Math.sin(a) * 520;
      this.scale = 0.62;
    },
    update(target, dt, mode) {
      // mode: 'foot' | 'drive' | 'drivefast'
      const look = mode === 'foot' ? 26 : 110;
      const tx = target.x + (target.vx || 0) * (mode === 'foot' ? 0.12 : 0.32) + (target.ax || 0) * 0;
      const ty = target.y + (target.vy || 0) * (mode === 'foot' ? 0.12 : 0.32);
      const follow = mode === 'foot' ? 5.5 : 3.4;
      this.x = lerp(this.x, tx + (tx - this.x) * 0, 1 - Math.exp(-follow * dt));
      this.y = lerp(this.y, ty, 1 - Math.exp(-follow * dt));
      // Look-ahead pulls the camera toward where the target is heading.
      const leadX = clamp((target.vx || 0) * look * 0.016, -look, look);
      const leadY = clamp((target.vy || 0) * look * 0.016, -look, look);
      this.x = lerp(this.x, target.x + leadX, 1 - Math.exp(-2.2 * dt));
      this.y = lerp(this.y, target.y + leadY, 1 - Math.exp(-2.2 * dt));

      const want = mode === 'foot' ? 1.12 : mode === 'drivefast' ? 0.82 : 0.98;
      this.scale = lerp(this.scale, want, 1 - Math.exp(-2.6 * dt));

      this.shake = Math.max(0, this.shake - dt * 26);
      const s = this.shake;
      this.shakeX = (Math.random() - 0.5) * s;
      this.shakeY = (Math.random() - 0.5) * s;
    },
    kick(amount) { this.shake = Math.min(26, this.shake + amount); },
  };
}
