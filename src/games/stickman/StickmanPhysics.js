/**
 * StickmanPhysics — Physics simulation, collision detection, and particle engine
 * Handles realistic projectile ballistics, platform collisions, TNT blasts, and damage popups.
 */

export const GRAVITY = 0.42;
export const ARROW_BASE_SPEED = 21;

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.damageNumbers = [];
    this.coins = [];
  }

  addSpark(x, y, color = '#f97316', count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        color,
        size: 2 + Math.random() * 3,
        alpha: 1,
        life: 1,
        decay: 0.035 + Math.random() * 0.03,
      });
    }
  }

  addExplosion(x, y, radius = 70) {
    // Shockwave ring
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 5,
      maxRadius: radius,
      color: '#f97316',
      isRing: true,
      alpha: 1,
      life: 1,
      decay: 0.05,
    });

    // Fiery blast fragments
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      const colors = ['#ef4444', '#f97316', '#fbbf24', '#ffffff'];
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 5,
        alpha: 1,
        life: 1,
        decay: 0.03 + Math.random() * 0.03,
      });
    }
  }

  addDamageNumber(x, y, text, isCrit = false, color = null) {
    this.damageNumbers.push({
      x,
      y,
      text: String(text),
      isCrit,
      color: color || (isCrit ? '#facc15' : '#ffffff'),
      vy: -2.5,
      alpha: 1,
      life: 1,
      decay: 0.022,
    });
  }

  dropCoins(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.2 - Math.random() * Math.PI * 0.6;
      const speed = 3 + Math.random() * 5;
      this.coins.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 7,
        alpha: 1,
        collected: false,
        bounceCount: 0,
        life: 450, // frames before auto-collect
      });
    }
  }

  update(platforms, player, onCollectCoin) {
    // 1. Regular particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.isRing) {
        p.radius += (p.maxRadius - p.radius) * 0.2;
        p.alpha -= p.decay;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY * 0.35;
        p.alpha -= p.decay;
      }
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 2. Damage popups
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.y += d.vy;
      d.vy *= 0.92;
      d.alpha -= d.decay;
      if (d.alpha <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }

    // 3. Collectible Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += GRAVITY * 0.7;
      c.vx *= 0.98;

      // Platform collision
      for (const plat of platforms) {
        if (
          c.x >= plat.x &&
          c.x <= plat.x + plat.width &&
          c.y + c.radius >= plat.y &&
          c.y - c.radius <= plat.y + 12 &&
          c.vy > 0
        ) {
          c.y = plat.y - c.radius;
          c.vy = -c.vy * 0.55;
          c.bounceCount++;
          break;
        }
      }

      // Magnet toward player if nearby
      const dx = (player.x + 15) - c.x;
      const dy = (player.y + 25) - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 140) {
        c.vx += (dx / dist) * 1.2;
        c.vy += (dy / dist) * 1.2;
      }

      // Collect when touching player
      if (dist < 32 || c.life <= 0) {
        onCollectCoin?.(1);
        this.coins.splice(i, 1);
      } else {
        c.life--;
      }
    }
  }
}

// Check platform intersection for character feet
export function checkPlatformCollision(char, platforms) {
  let onGround = false;
  const feetY = char.y + char.height;
  const prevFeetY = feetY - char.vy;

  for (const plat of platforms) {
    // Check horizontal overlap with generous margins
    const isWithinX = (char.x + char.width * 0.85 > plat.x) &&
                      (char.x + char.width * 0.15 < plat.x + plat.width);

    if (isWithinX) {
      if (char.vy >= 0) {
        // Did feet cross from above the platform surface or land on it?
        const crossedSurface = prevFeetY <= plat.y + 8 && feetY >= plat.y;
        // Or are feet resting inside the top band of the platform?
        const insideTopBand = feetY >= plat.y && feetY <= plat.y + Math.max(20, char.vy + 6);

        if (crossedSurface || insideTopBand) {
          char.y = plat.y - char.height;
          char.vy = 0;
          onGround = true;
          char.currentPlatform = plat;
          break;
        }
      }
    }
  }

  return onGround;
}

// Ray-box intersection for line collision
export function lineIntersectsBox(x1, y1, x2, y2, box) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  if (maxX < box.x || minX > box.x + box.width || maxY < box.y || minY > box.y + box.height) {
    return false;
  }
  return true;
}

