// Keyboard and mouse input. Polls a key set each frame; mouse position is kept in
// canvas (screen) coordinates — the game converts it to world coordinates itself.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys that went down this frame (edge trigger)

  window.addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false, worldX: 0, worldY: 0 };
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    // True once for the frame the key went down.
    wasPressed(code) {
      const hit = pressed.has(code);
      pressed.delete(code);
      return hit;
    },
    // Keys held for movement reads.
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      const len = Math.hypot(x, y);
      if (len > 0) { x /= len; y /= len; }
      return { x, y };
    },
    clearEdges() { pressed.clear(); },
  };
}
