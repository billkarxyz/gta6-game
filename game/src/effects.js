// Effects with no rules of their own: particles (smoke, fire, sparks, blood, cash), skid marks
// left by hard braking, and the camera's screen shake. Each effect is a small object in a pool;
// the renderer draws them, and update() ages them out.
const MAX_PARTICLES = 400;
const MAX_SKIDS = 600;

/** A puff of smoke and fire at an explosion, with sparks flying out. */
export function addExplosion(state, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 320;
    addParticle(state, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.5 + Math.random() * 0.7, 4 + Math.random() * 8, i % 3 === 0 ? '#ff9a3c' : i % 3 === 1 ? '#e5534b' : '#5a5a5a');
  }
  shake(state, 14);
}

/** A short burst of sparks where metal hits metal. */
export function addSparks(state, x, y) {
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 200;
    addParticle(state, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.2 + Math.random() * 0.25, 2 + Math.random() * 2, '#ffd94a');
  }
}

/** A red puff where a bullet lands on a person. */
export function addHitPuff(state, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 90;
    addParticle(state, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.3 + Math.random() * 0.3, 3 + Math.random() * 3, '#c0392b');
  }
}

/** Grey smoke from a damaged car's engine, and from burning wrecks. */
export function addSmoke(state, x, y) {
  addParticle(state, x, y, (Math.random() - 0.5) * 20, -30 - Math.random() * 30, 0.8 + Math.random() * 0.6, 5 + Math.random() * 6, '#8a8a8a');
}

/** A bright flash at the muzzle when the player fires. */
export function addMuzzle(state, x, y, angle) {
  addParticle(state, x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, Math.cos(angle) * 120, Math.sin(angle) * 120, 0.06, 6, '#ffe9a8');
}

/** Green notes flying up when cash is collected. */
export function addCashBurst(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    addParticle(state, x, y, (Math.random() - 0.5) * 160, -60 - Math.random() * 120, 0.6 + Math.random() * 0.4, 3 + Math.random() * 3, '#7ee081');
  }
}

export function addParticle(state, x, y, vx, vy, life, size, colour) {
  if (state.particles.length >= MAX_PARTICLES) state.particles.shift();
  state.particles.push({ x, y, vx, vy, life, maxLife: life, size, colour });
}

/** A skid mark segment at a wheel: the renderer draws the trail as fading dark strokes. */
export function addSkid(state, x, y, angle) {
  if (state.skids.length >= MAX_SKIDS) state.skids.shift();
  state.skids.push({ x, y, angle, life: 6 });
}

/** Jolt the camera; the shake decays on its own. */
export function shake(state, amount) {
  state.shake = Math.min(20, state.shake + amount);
}

/** Age every effect by dt; dead ones are dropped. */
export function updateEffects(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }
  state.shake = Math.max(0, state.shake - 30 * dt);
}
