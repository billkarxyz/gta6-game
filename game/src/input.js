// input.js — keyboard and mouse state. The game reads this every frame
// instead of reacting to events directly, so holding a key works the same
// as tapping it and the camera, the player and the menus all share one
// picture of what the player is doing.
export function createInput(canvas) {
  const input = {
    keys: {},
    pressed: {}, // keys pressed since the last frame, cleared by endFrame
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false, // a click since the last frame
  };
  window.addEventListener('keydown', (e) => {
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
    // Keep the page from scrolling while the game uses the arrows and space.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  return input;
}

// Call once at the end of each frame so pressed/clicked mean "this frame".
export function endFrame(input) {
  input.pressed = {};
  input.mouseClicked = false;
}

export function down(input, code) {
  return !!input.keys[code];
}
export function wasPressed(input, code) {
  return !!input.pressed[code];
}

// The movement axes, from WASD or the arrow keys. Each is -1, 0 or 1.
export function moveAxes(input) {
  let x = 0;
  let y = 0;
  if (down(input, 'KeyA') || down(input, 'ArrowLeft')) x -= 1;
  if (down(input, 'KeyD') || down(input, 'ArrowRight')) x += 1;
  if (down(input, 'KeyW') || down(input, 'ArrowUp')) y -= 1;
  if (down(input, 'KeyS') || down(input, 'ArrowDown')) y += 1;
  return { x, y };
}
