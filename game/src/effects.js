// effects.js — particles, skid marks and screen shake: the feedback that
// makes a crash feel like a crash and a shot feel like a shot. Particles
// are plain objects in one list, updated and drawn by render.js.
export function createEffects() {
  return { particles: [], skids: [], shake: 0, flashes: [] };
}

export function addShake(fx, amount) {
  fx.shake = Math.min(18, fx.shake + amount);
}

export function updateEffects(fx, dt) {
  fx.shake = Math.max(0, fx.shake - dt * 40);
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
    if (p.grow) p.r += p.grow * dt;
  }
  for (let i = fx.skids.length - 1; i >= 0; i--) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }
  for (let i = fx.flashes.length - 1; i >= 0; i--) {
    fx.flashes[i].life -= dt;
    if (fx.flashes[i].life <= 0) fx.flashes.splice(i, 1);
  }
}

function burst(fx, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: size * (0.5 + Math.random()),
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      color,
    });
  }
}

export function explosion(fx, x, y) {
  burst(fx, x, y, 26, '#ff9a2e', 260, 0.7, 7);
  burst(fx, x, y, 16, '#ffdd55', 180, 0.45, 5);
  burst(fx, x, y, 12, '#5a5a5a', 90, 1.6, 9);
  fx.flashes.push({ x, y, r: 90, life: 0.12, maxLife: 0.12 });
  addShake(fx, 14);
}

export function sparks(fx, x, y) {
  burst(fx, x, y, 8, '#ffd94a', 200, 0.35, 3);
}

export function smoke(fx, x, y) {
  fx.particles.push({
    x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 20,
    r: 6, life: 1.1, maxLife: 1.1, color: 'rgba(90,90,90,0.5)', grow: 6,
  });
}

export function muzzle(fx, x, y) {
  fx.flashes.push({ x, y, r: 16, life: 0.05, maxLife: 0.05 });
  burst(fx, x, y, 3, '#ffe08a', 160, 0.12, 2);
}

export function pickupBurst(fx, x, y, color) {
  burst(fx, x, y, 10, color || '#7ee787', 120, 0.5, 4);
}

// A skid mark segment between two points, left by a hard turn or a handbrake.
export function addSkid(fx, x1, y1, x2, y2) {
  if (fx.skids.length > 400) fx.skids.shift();
  fx.skids.push({ x1, y1, x2, y2, life: 6 });
}
