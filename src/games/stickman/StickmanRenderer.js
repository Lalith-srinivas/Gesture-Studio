/**
 * StickmanRenderer — Canvas rendering engine for Stickman Showdown
 * Draws dark fantasy landscape, floating islands, destructible TNT crates,
 * animated stickmen characters, ballistic projectile trails, and visual effects.
 */

export class StickmanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = this.generateStars(50);
  }

  generateStars(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: Math.random(),
        y: Math.random() * 0.65,
        radius: 0.8 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.7,
        blinkSpeed: 0.01 + Math.random() * 0.02,
      });
    }
    return list;
  }

  renderBackdrop(width, height, tick) {
    const ctx = this.ctx;

    // 1. Dark fantasy sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#040914');
    skyGrad.addColorStop(0.4, '#09152b');
    skyGrad.addColorStop(0.75, '#0e2445');
    skyGrad.addColorStop(1, '#112f5a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      const alpha = s.alpha + Math.sin(tick * s.blinkSpeed) * 0.25;
      ctx.globalAlpha = Math.max(0.15, Math.min(1, alpha));
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Luminous Fantasy Moon
    const moonX = width * 0.82;
    const moonY = height * 0.18;
    const moonR = Math.min(width, height) * 0.075;

    // Outer moon glow
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 2.8);
    moonGlow.addColorStop(0, 'rgba(186, 230, 253, 0.35)');
    moonGlow.addColorStop(0.5, 'rgba(125, 211, 252, 0.12)');
    moonGlow.addColorStop(1, 'rgba(14, 36, 69, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Moon body
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle moon craters
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.2, moonR * 0.22, 0, Math.PI * 2);
    ctx.arc(moonX + moonR * 0.25, moonY + moonR * 0.35, moonR * 0.18, 0, Math.PI * 2);
    ctx.arc(moonX - moonR * 0.15, moonY + moonR * 0.4, moonR * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // 4. Distant Mountain Silhouettes (Dark Blue)
    ctx.fillStyle = '#061326';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width * 0.18, height * 0.52);
    ctx.lineTo(width * 0.38, height * 0.68);
    ctx.lineTo(width * 0.62, height * 0.46);
    ctx.lineTo(width * 0.84, height * 0.64);
    ctx.lineTo(width, height * 0.54);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Mid-ground Forest Silhouettes
    ctx.fillStyle = '#030a17';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.82);
    for (let x = 0; x <= width; x += 32) {
      const treeH = Math.sin(x * 0.04) * 22 + Math.cos(x * 0.08) * 14 + 40;
      ctx.lineTo(x + 16, height * 0.85 - treeH);
      ctx.lineTo(x + 32, height * 0.85);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }

  // Draw floating craggy island platforms with lush grass tops
  renderPlatforms(platforms) {
    const ctx = this.ctx;

    for (const plat of platforms) {
      const { x, y, width, height } = plat;

      // Island Craggy Underside (Stalactites)
      ctx.fillStyle = '#0d1d33';
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x + width, y + 10);

      // Craggy bottom tooth profile
      const segments = Math.max(3, Math.floor(width / 35));
      const step = width / segments;
      for (let i = segments; i >= 0; i--) {
        const segX = x + i * step;
        const depth = height + (Math.sin(i * 1.5 + x) * 14 + 10);
        ctx.lineTo(segX, y + depth);
      }
      ctx.closePath();
      ctx.fill();

      // Stone Platform Core
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.roundRect(x, y, width, 18, [6, 6, 2, 2]);
      ctx.fill();

      // Top Lush Grass Layer
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(x, y, width, 6, [4, 4, 0, 0]);
      ctx.fill();

      // Grass tufts / blade fringe
      ctx.fillStyle = '#34d399';
      for (let tx = x + 4; tx < x + width - 4; tx += 12) {
        ctx.fillRect(tx, y - 2, 3, 3);
      }

      // Border outline
      ctx.strokeStyle = '#050c18';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, 12);
    }
  }

  // Draw crates and explosive TNT barrels
  renderCrates(crates) {
    const ctx = this.ctx;

    for (const c of crates) {
      if (c.destroyed) continue;

      if (c.type === 'tnt') {
        // Red TNT Explosive Barrel / Box (Matches Screenshot!)
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(c.x, c.y, c.width, c.height);

        // Yellow danger stripes
        ctx.fillStyle = '#facc15';
        ctx.fillRect(c.x, c.y + 4, c.width, 5);
        ctx.fillRect(c.x, c.y + c.height - 9, c.width, 5);

        // Black border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(c.x, c.y, c.width, c.height);

        // TNT Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TNT', c.x + c.width / 2, c.y + c.height / 2);
      } else {
        // Wooden Crate
        ctx.fillStyle = '#d97706';
        ctx.fillRect(c.x, c.y, c.width, c.height);

        // Planks & cross bracing
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c.x, c.y, c.width, c.height);

        // Diagonal beam
        ctx.beginPath();
        ctx.moveTo(c.x + 2, c.y + 2);
        ctx.lineTo(c.x + c.width - 2, c.y + c.height - 2);
        ctx.moveTo(c.x + c.width - 2, c.y + 2);
        ctx.lineTo(c.x + 2, c.y + c.height - 2);
        ctx.stroke();
      }
    }
  }

  // Render Stickman Character with weapons and animations
  renderStickman(char, isPlayer = false, tick = 0) {
    const ctx = this.ctx;
    const { x, y, width, height, color, isBoss } = char;
    const scale = isBoss ? 1.6 : 1.0;

    ctx.save();
    ctx.translate(x + width / 2, y + height);

    // Facing direction
    const facing = char.facingRight ? 1 : -1;
    ctx.scale(facing, 1);

    // Hit flash
    if (char.hitFlash > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.fillStyle = color || '#f97316';
      ctx.strokeStyle = color || '#f97316';
    }
    ctx.lineWidth = Math.max(2.5, 3.5 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const hipY = -28 * scale;
    const neckY = -62 * scale;
    const headY = -76 * scale;
    const headR = 11 * scale;

    // Running leg stride animation
    const isMoving = Math.abs(char.vx) > 0.5;
    const legSwing = isMoving ? Math.sin(tick * 0.25) * 14 * scale : 0;

    // 1. Legs
    // Left leg
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(-7 * scale - legSwing * 0.7, hipY * 0.5);
    ctx.lineTo(-10 * scale - legSwing, 0);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(7 * scale + legSwing * 0.7, hipY * 0.5);
    ctx.lineTo(10 * scale + legSwing, 0);
    ctx.stroke();

    // 2. Spine / Torso
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(0, neckY);
    ctx.stroke();

    // 3. Head
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Warrior Helmet / Horns for Boss & Elite
    if (char.hasHelmet || isBoss || char.type === 'elite_archer') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, headY - 2 * scale, headR * 1.1, Math.PI, Math.PI * 2);
      ctx.lineTo(headR * 1.1, headY + 3 * scale);
      ctx.lineTo(-headR * 1.1, headY + 3 * scale);
      ctx.closePath();
      ctx.fill();

      // Glowing horned crest
      ctx.strokeStyle = isBoss ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.8, headY - 5 * scale);
      ctx.lineTo(-headR * 1.6, headY - 18 * scale);
      ctx.moveTo(headR * 0.8, headY - 5 * scale);
      ctx.lineTo(headR * 1.6, headY - 18 * scale);
      ctx.stroke();
    }

    // Glowing Eyes
    ctx.fillStyle = isPlayer ? '#ffffff' : (isBoss ? '#ef4444' : '#fbbf24');
    ctx.beginPath();
    ctx.arc(headR * 0.45, headY - 1, 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 4. Arms & Weapons
    const shoulderY = neckY + 4 * scale;
    const aimAngle = (char.aimAngle || 0) * facing; // Local relative aim angle

    if (char.weapon === 'sword' || char.type === 'warrior') {
      // Melee Sword Swing Pose
      const swingProgress = char.meleeTimer ? Math.sin((char.meleeTimer / 20) * Math.PI) : 0;
      const armAngle = -0.3 + swingProgress * 1.8;

      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      const handX = Math.cos(armAngle) * 26 * scale;
      const handY = shoulderY + Math.sin(armAngle) * 26 * scale;
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Sword Blade
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(armAngle);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3.5 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(32 * scale, 0);
      ctx.stroke();

      // Sword Guard & Hilt
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(0, -6 * scale, 3 * scale, 12 * scale);
      ctx.restore();

    } else {
      // Archery Bow Pose (Matches Screenshot!)
      const drawRatio = Math.min(1, Math.max(0, char.drawPower || 0));

      // Left extended arm holding bow
      const bowArmX = Math.cos(aimAngle) * 26 * scale;
      const bowArmY = shoulderY + Math.sin(aimAngle) * 26 * scale;

      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(bowArmX, bowArmY);
      ctx.stroke();

      // Right arm pulling bowstring
      const pullDist = 12 * scale + drawRatio * 14 * scale;
      const pullArmX = Math.cos(aimAngle + Math.PI) * pullDist * 0.6;
      const pullArmY = shoulderY + Math.sin(aimAngle + Math.PI) * pullDist * 0.6;

      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(pullArmX, pullArmY);
      ctx.stroke();

      // Draw the Golden Recurve Bow
      ctx.save();
      ctx.translate(bowArmX, bowArmY);
      ctx.rotate(aimAngle);

      // Bow Stave (curved arc)
      ctx.strokeStyle = isPlayer ? '#fbbf24' : '#22c55e';
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, 20 * scale, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      // Bowstring
      const topTipX = Math.cos(-Math.PI * 0.45) * 20 * scale;
      const topTipY = Math.sin(-Math.PI * 0.45) * 20 * scale;
      const botTipX = Math.cos(Math.PI * 0.45) * 20 * scale;
      const botTipY = Math.sin(Math.PI * 0.45) * 20 * scale;
      const stringPullX = -pullDist;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(topTipX, topTipY);
      ctx.lineTo(stringPullX, 0);
      ctx.lineTo(botTipX, botTipY);
      ctx.stroke();

      // Arrow on string while drawing
      if (char.isDrawing || drawRatio > 0) {
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(stringPullX, 0);
        ctx.lineTo(16 * scale, 0);
        ctx.stroke();

        // Glowing arrowhead energy particle (like in screenshot)
        ctx.fillStyle = isPlayer ? '#60a5fa' : '#4ade80';
        ctx.beginPath();
        ctx.arc(16 * scale, 0, (3 + drawRatio * 3) * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();

    // Health Bar above enemies
    if (!isPlayer && char.hp > 0 && !isBoss) {
      const barW = 38 * scale;
      const barH = 5;
      const barX = x + width / 2 - barW / 2;
      const barY = y - 16;
      const pct = Math.max(0, Math.min(1, char.hp / char.maxHp));

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#eab308' : '#ef4444');
      ctx.fillRect(barX, barY, barW * pct, barH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }
  }

  // Draw ballistic arrows in flight with glowing trails
  renderArrows(arrows) {
    const ctx = this.ctx;

    for (const a of arrows) {
      if (!a.active) continue;

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);

      // Glowing Motion Trail
      ctx.strokeStyle = a.trailColor || '#94a3b8';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-4, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrow Shaft
      ctx.strokeStyle = a.color || '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();

      // Arrowhead Tip
      ctx.fillStyle = a.color || '#ffffff';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(8, -4);
      ctx.lineTo(10, 0);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();

      // Fletching Feathers
      ctx.strokeStyle = a.trailColor || '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-17, -4);
      ctx.moveTo(-14, 0);
      ctx.lineTo(-17, 4);
      ctx.stroke();

      // Special Arrow Particle Flare (Fire / Ice / Lightning)
      if (a.type === 'fire' || a.type === 'explosive') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(12, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (a.type === 'ice') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(12, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Draw aiming trajectory line with glowing dots
  renderAimTrajectory(startX, startY, angle, power = 1) {
    const ctx = this.ctx;
    const speed = (14 + power * 18);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    let currX = startX;
    let currY = startY;

    ctx.save();
    for (let step = 0; step < 22; step++) {
      currX += vx;
      currY += vy;
      vy += 0.42; // Gravity step

      const alpha = Math.max(0.08, 1 - (step / 22));
      const radius = Math.max(1.5, 3.5 - step * 0.12);

      ctx.fillStyle = `rgba(186, 230, 253, ${alpha})`;
      ctx.beginPath();
      ctx.arc(currX, currY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Render particles, floating damage numbers & coins
  renderParticles(particleSystem) {
    const ctx = this.ctx;

    // 1. Particles
    for (const p of particleSystem.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (p.isRing) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Collectible Gold Coins
    for (const c of particleSystem.coins) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
      ctx.restore();
    }

    // 3. Floating Damage Popups
    for (const d of particleSystem.damageNumbers) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.font = d.isCrit ? '900 16px sans-serif' : 'bold 12px sans-serif';
      ctx.textAlign = 'center';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(d.text, d.x, d.y);

      // Inner fill
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, d.x, d.y);
      ctx.restore();
    }
  }
}

