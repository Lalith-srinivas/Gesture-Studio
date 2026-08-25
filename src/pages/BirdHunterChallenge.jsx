import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- UTILS & CONSTANTS ---
const BIRD_TYPES = ['NORMAL', 'GOLDEN', 'FAST', 'TINY', 'GIANT', 'GHOST'];
const PROJECTILES = [
  { id: 'stone', name: 'Stone', color: '#9ca3af', bounce: 0.3, mass: 1 },
  { id: 'cookie', name: 'Cookie', color: '#d97706', bounce: 0.1, mass: 0.8 },
  { id: 'tennis', name: 'Tennis Ball', color: '#bef264', bounce: 0.8, mass: 0.5 },
  { id: 'energy', name: 'Energy Ball', color: '#06b6d4', bounce: 1.0, mass: 0.3 },
];

const POWERUP_TYPES = ['SLOW_MO', 'TRIPLE_SHOT', 'EXPLOSIVE', 'TRAJECTORY', 'DOUBLE_SCORE'];

// --- AUDIO SYNTHESIZER ---
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  stretch() { this.playTone(200, 'triangle', 0.1, 0.05); }
  launch() { this.playTone(150, 'sawtooth', 0.2, 0.1); }
  hit() { this.playTone(800, 'square', 0.1, 0.1); }
  headshot() { this.playTone(1200, 'square', 0.2, 0.2); this.playTone(1500, 'sine', 0.2, 0.2); }
  powerup() { this.playTone(600, 'sine', 0.3, 0.2); this.playTone(800, 'sine', 0.4, 0.2); }
}
const audio = new AudioEngine();

// --- GAME ENGINE ---
export default function BirdHunterChallenge() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, PAUSED
  const [orientation, setOrientation] = useState('landscape');
  
  // HUD States (using refs for rapid updates to avoid re-renders, sync to state for UI menus if needed)
  const stats = useRef({
    score: 0, highScore: 0, combo: 0, maxCombo: 0, birdsHit: 0, shotsFired: 0,
    showTrajectory: true, sound: true
  });
  const [hudUpdate, setHudUpdate] = useState(0); // Force rare UI updates
  
  const [selectedProjectile, setSelectedProjectile] = useState(PROJECTILES[0]);
  
  // Physics & Game Loop State
  const game = useRef({
    width: 800, height: 600,
    birds: [], projectiles: [], particles: [], floatingTexts: [], powerups: [],
    slingshot: { x: 400, y: 500, pullX: 400, pullY: 500, isPulling: false, radius: 20 },
    camera: { shakeX: 0, shakeY: 0, shakeTime: 0 },
    activePowerups: { slowMoTime: 0, doubleScoreTime: 0, tripleShotTime: 0, explosiveTime: 0 },
    lastTime: 0, difficulty: 1, frames: 0
  });

  // Load High Score
  useEffect(() => {
    const hs = localStorage.getItem('birdHunterHighScore');
    if (hs) stats.current.highScore = parseInt(hs, 10);
  }, []);

  // Handle Orientation
  useEffect(() => {
    const checkOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        game.current.width = canvas.width;
        game.current.height = canvas.height;
        game.current.slingshot.x = canvas.width / 2;
        game.current.slingshot.y = canvas.height - 80;
        if (!game.current.slingshot.isPulling) {
          game.current.slingshot.pullX = game.current.slingshot.x;
          game.current.slingshot.pullY = game.current.slingshot.y;
        }
      }
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId;

    const spawnBird = () => {
      const { width, height } = game.current;
      const type = Math.random() > 0.8 ? BIRD_TYPES[Math.floor(Math.random() * BIRD_TYPES.length)] : 'NORMAL';
      const dir = Math.random() > 0.5 ? 1 : -1;
      
      let speedBase = 100 * game.current.difficulty;
      let radius = 20;
      if (type === 'FAST') speedBase *= 2;
      if (type === 'TINY') radius = 10;
      if (type === 'GIANT') radius = 40;
      if (type === 'GHOST') speedBase *= 0.8;

      const patterns = [
        (t) => ({ x: t * 150 * dir, y: height/3 + Math.sin(t*2) * 100 }), // Wave
        (t) => ({ x: t * 200 * dir, y: height/4 + Math.sin(t*4) * 50 }), // Zigzagish
        (t) => ({ x: width/2 + Math.cos(t) * 200, y: height/3 + Math.sin(t) * 100 }), // Oval
        (t) => ({ x: width/2 + Math.sin(t)*300, y: height/3 + Math.sin(t*2)*100 }), // Figure 8
        (t) => ({ x: t * 180 * dir, y: height/2 - Math.abs(Math.sin(t*3))*150 }), // Bouncing curve
        (t) => ({ x: t * 250 * dir, y: height/5 }), // Fast horizontal
        (t) => ({ x: width/2 + t*100*dir, y: height/2 + Math.cos(t*3)*200 }), // Dive
      ];
      const patternFn = patterns[Math.floor(Math.random() * patterns.length)];

      game.current.birds.push({
        id: Math.random(),
        type,
        t: Math.random() * 10,
        speed: speedBase / 1000,
        dir,
        radius,
        pattern: patternFn,
        x: 0, y: 0,
        hp: type === 'GIANT' ? 3 : 1
      });
    };

    const spawnPowerup = (x, y) => {
      if (Math.random() > 0.2) return; // 20% chance
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      game.current.powerups.push({ x, y, type, vy: -2, radius: 15, t: 0 });
    };

    const spawnParticles = (x, y, color, count) => {
      for (let i = 0; i < count; i++) {
        game.current.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1,
          color,
          size: Math.random() * 4 + 2
        });
      }
    };

    const addFloatingText = (x, y, text, color = '#fff', size = 24) => {
      game.current.floatingTexts.push({ x, y, text, color, size, life: 1, vy: -2 });
    };

    const update = (dt) => {
      if (gameState !== 'PLAYING') return;
      const g = game.current;
      const timeScale = g.activePowerups.slowMoTime > 0 ? 0.3 : 1;
      const adjustedDt = dt * timeScale;
      g.frames++;

      // Powerups degradation
      if (g.activePowerups.slowMoTime > 0) g.activePowerups.slowMoTime -= dt;
      if (g.activePowerups.doubleScoreTime > 0) g.activePowerups.doubleScoreTime -= dt;
      if (g.activePowerups.tripleShotTime > 0) g.activePowerups.tripleShotTime -= dt;
      if (g.activePowerups.explosiveTime > 0) g.activePowerups.explosiveTime -= dt;

      // Camera Shake
      if (g.camera.shakeTime > 0) {
        g.camera.shakeX = (Math.random() - 0.5) * 10;
        g.camera.shakeY = (Math.random() - 0.5) * 10;
        g.camera.shakeTime -= dt;
      } else {
        g.camera.shakeX = 0; g.camera.shakeY = 0;
      }

      // Spawning
      if (Math.random() < 0.02 * g.difficulty * timeScale) spawnBird();

      // Update Birds
      g.birds.forEach(bird => {
        bird.t += bird.speed * timeScale;
        const pos = bird.pattern(bird.t);
        bird.x = pos.x;
        bird.y = pos.y;
      });
      // Remove off-screen birds
      g.birds = g.birds.filter(b => b.x > -200 && b.x < g.width + 200 && b.y > -200 && b.y < g.height + 200);

      // Update Projectiles
      g.projectiles.forEach(p => {
        p.vy += 400 * adjustedDt; // Gravity
        p.x += p.vx * adjustedDt;
        p.y += p.vy * adjustedDt;
        p.rotation += p.vx * 0.01;
        
        // Bounce off walls
        if (p.x < p.radius || p.x > g.width - p.radius) {
          p.vx *= -p.bounce;
          p.x = p.x < p.radius ? p.radius : g.width - p.radius;
        }
      });
      g.projectiles = g.projectiles.filter(p => p.y < g.height + 100);

      // Update Powerups
      g.powerups.forEach(p => {
        p.vy += 100 * adjustedDt; // Light gravity
        p.y += p.vy * adjustedDt;
        p.t += dt;
      });
      g.powerups = g.powerups.filter(p => p.y < g.height + 50);

      // Collisions
      g.projectiles.forEach(proj => {
        // vs Birds
        g.birds.forEach(bird => {
          if (bird.hp <= 0) return;
          const dx = proj.x - bird.x;
          const dy = proj.y - bird.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist < proj.radius + bird.radius) {
            // Collision!
            const headshot = dist < (bird.radius * 0.5); // simplified headshot logic
            bird.hp--;
            if (bird.hp <= 0) {
              audio.hit();
              spawnParticles(bird.x, bird.y, bird.type === 'GOLDEN' ? '#fbbf24' : '#ef4444', 20);
              spawnPowerup(bird.x, bird.y);
              
              let pts = 10;
              if (bird.type === 'GOLDEN') pts = 100;
              if (bird.type === 'GHOST') pts = 50;
              if (headshot) { pts += 15; audio.headshot(); g.camera.shakeTime = 0.2; }
              
              stats.current.combo++;
              if (stats.current.combo > stats.current.maxCombo) stats.current.maxCombo = stats.current.combo;
              
              let totalPts = pts + (stats.current.combo * 5);
              if (g.activePowerups.doubleScoreTime > 0) totalPts *= 2;
              
              stats.current.score += totalPts;
              stats.current.birdsHit++;
              if (stats.current.score > stats.current.highScore) {
                stats.current.highScore = stats.current.score;
                localStorage.setItem('birdHunterHighScore', stats.current.score);
              }
              
              addFloatingText(bird.x, bird.y, `+${totalPts}${headshot ? ' HEADSHOT!' : ''}`, headshot ? '#facc15' : '#fff', headshot ? 30 : 20);
              
              // Explosive projectile effect
              if (proj.isExplosive) {
                spawnParticles(proj.x, proj.y, '#f97316', 40);
                g.camera.shakeTime = 0.3;
                g.birds.forEach(b => {
                  if (Math.hypot(b.x - proj.x, b.y - proj.y) < 150) { b.hp = 0; }
                });
              }
              
              if(g.frames % 10 === 0) setHudUpdate(h => h + 1); // throttle ui updates
            }
          }
        });
        
        // vs Powerups
        g.powerups.forEach(pw => {
          const dx = proj.x - pw.x;
          const dy = proj.y - pw.y;
          if (Math.hypot(dx, dy) < proj.radius + pw.radius) {
            pw.y = g.height + 100; // remove
            audio.powerup();
            addFloatingText(pw.x, pw.y, pw.type.replace('_', ' '), '#06b6d4', 24);
            if (pw.type === 'SLOW_MO') g.activePowerups.slowMoTime = 5;
            if (pw.type === 'DOUBLE_SCORE') g.activePowerups.doubleScoreTime = 5;
            if (pw.type === 'TRIPLE_SHOT') g.activePowerups.tripleShotTime = 5;
            if (pw.type === 'EXPLOSIVE') g.activePowerups.explosiveTime = 5;
            if (pw.type === 'TRAJECTORY') stats.current.showTrajectory = true;
          }
        });
      });
      g.birds = g.birds.filter(b => b.hp > 0);

      // Misses reset combo
      const missedProjs = g.projectiles.filter(p => p.y >= g.height);
      if (missedProjs.length > 0) {
        // If a projectile falls without hitting anything, maybe reset combo? 
        // For fun arcade feel, we reset combo if it drops below screen.
        stats.current.combo = 0;
        setHudUpdate(h => h + 1);
      }

      // Update Particles
      g.particles.forEach(p => {
        p.x += p.vx * adjustedDt * 60;
        p.y += p.vy * adjustedDt * 60;
        p.life -= adjustedDt * 2;
      });
      g.particles = g.particles.filter(p => p.life > 0);

      // Update Floating Text
      g.floatingTexts.forEach(ft => {
        ft.y += ft.vy * adjustedDt * 60;
        ft.life -= adjustedDt;
      });
      g.floatingTexts = g.floatingTexts.filter(ft => ft.life > 0);

      // Increase Difficulty
      g.difficulty = 1 + (stats.current.score / 2000);
    };

    const drawBird = (ctx, bird) => {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      // Flip based on movement direction
      const vx = (bird.pattern(bird.t + 0.1).x - bird.x);
      if (vx < 0) ctx.scale(-1, 1);
      
      let mainColor = '#10b981'; // Greenish normal
      if (bird.type === 'GOLDEN') mainColor = '#fbbf24';
      if (bird.type === 'FAST') mainColor = '#3b82f6';
      if (bird.type === 'GIANT') mainColor = '#ef4444';
      if (bird.type === 'GHOST') { mainColor = '#a8a29e'; ctx.globalAlpha = 0.5; }
      if (bird.type === 'TINY') mainColor = '#d946ef';

      // Wing flap animation
      const flap = Math.sin(bird.t * 20) * 15;

      // Neo Brutalist style bird
      ctx.fillStyle = mainColor;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.radius, bird.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Wing
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-bird.radius*0.2, flap, bird.radius*0.6, bird.radius*0.3, flap * 0.05, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(bird.radius*0.5, -bird.radius*0.2, bird.radius*0.2, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(bird.radius*0.6, -bird.radius*0.2, bird.radius*0.08, 0, Math.PI*2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(bird.radius*0.8, -bird.radius*0.1);
      ctx.lineTo(bird.radius*1.4, 0);
      ctx.lineTo(bird.radius*0.8, bird.radius*0.2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.restore();
    };

    const drawProjectile = (ctx, proj) => {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(proj.rotation || 0);
      ctx.fillStyle = proj.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      
      // Detailing
      if (proj.id === 'tennis') {
        ctx.strokeStyle = '#fff';
        ctx.beginPath(); ctx.arc(-proj.radius*0.5, 0, proj.radius*0.7, -Math.PI/4, Math.PI/4); ctx.stroke();
        ctx.beginPath(); ctx.arc(proj.radius*0.5, 0, proj.radius*0.7, Math.PI - Math.PI/4, Math.PI + Math.PI/4); ctx.stroke();
      }
      if (proj.id === 'cookie') {
        ctx.fillStyle = '#451a03';
        ctx.beginPath(); ctx.arc(-5, -5, 3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -3, 2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(-2, 4, 3, 0, 7); ctx.fill();
      }

      ctx.restore();
    };

    const draw = () => {
      const g = game.current;
      ctx.clearRect(0, 0, g.width, g.height);
      
      ctx.save();
      ctx.translate(g.camera.shakeX, g.camera.shakeY);

      // Background (Neo Brutalist simple)
      ctx.fillStyle = '#fcd34d'; // Warm yellow bg
      ctx.fillRect(0, 0, g.width, g.height);
      // Grid pattern for flair
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 2;
      for (let i = 0; i < g.width; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, g.height); ctx.stroke(); }
      for (let i = 0; i < g.height; i += 50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(g.width, i); ctx.stroke(); }

      // Draw active powerups UI
      if (g.activePowerups.slowMoTime > 0) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fillRect(0, 0, g.width, g.height);
      }

      // Draw Flight Path Prediction
      if (stats.current.showTrajectory && gameState === 'PLAYING') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([5, 5]);
        g.birds.forEach(bird => {
          ctx.beginPath();
          let pos = bird.pattern(bird.t);
          ctx.moveTo(pos.x, pos.y);
          for (let i = 1; i <= 20; i++) {
            let nextPos = bird.pattern(bird.t + i * 0.1);
            ctx.lineTo(nextPos.x, nextPos.y);
          }
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // Draw Powerups Drops
      g.powerups.forEach(pw => {
        ctx.save();
        ctx.translate(pw.x, pw.y);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pw.radius, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 0);
        ctx.restore();
      });

      // Draw Birds
      g.birds.forEach(bird => drawBird(ctx, bird));

      // Draw Slingshot
      const { slingshot } = g;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#57534e'; // Stone color
      
      // Back band
      ctx.beginPath();
      ctx.moveTo(slingshot.x - 30, slingshot.y - 40);
      ctx.lineTo(slingshot.pullX, slingshot.pullY);
      ctx.stroke();

      // Slingshot base
      ctx.fillStyle = '#78716c';
      ctx.fillRect(slingshot.x - 10, slingshot.y - 20, 20, 100);
      ctx.beginPath(); ctx.moveTo(slingshot.x - 10, slingshot.y - 20); ctx.lineTo(slingshot.x - 35, slingshot.y - 50); ctx.lineTo(slingshot.x - 20, slingshot.y - 50); ctx.lineTo(slingshot.x, slingshot.y - 20); ctx.fill();
      ctx.beginPath(); ctx.moveTo(slingshot.x + 10, slingshot.y - 20); ctx.lineTo(slingshot.x + 35, slingshot.y - 50); ctx.lineTo(slingshot.x + 20, slingshot.y - 50); ctx.lineTo(slingshot.x, slingshot.y - 20); ctx.fill();
      
      // Projectile in pouch
      if (slingshot.isPulling || (gameState === 'PLAYING' && g.projectiles.length === 0)) {
        drawProjectile(ctx, { 
          x: slingshot.pullX, y: slingshot.pullY, 
          radius: 15, color: selectedProjectile.color, id: selectedProjectile.id 
        });
      }

      // Front band
      ctx.beginPath();
      ctx.moveTo(slingshot.x + 30, slingshot.y - 40);
      ctx.lineTo(slingshot.pullX, slingshot.pullY);
      ctx.stroke();

      // Aim Trajectory Assist Powerup
      if (slingshot.isPulling && g.activePowerups.tripleShotTime > 0) {
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 10]);
          ctx.beginPath();
          ctx.moveTo(slingshot.pullX, slingshot.pullY);
          const dx = slingshot.x - slingshot.pullX;
          const dy = slingshot.y - slingshot.pullY;
          ctx.lineTo(slingshot.pullX + dx * 5, slingshot.pullY + dy * 5);
          ctx.stroke();
          ctx.setLineDash([]);
      }

      // Draw Projectiles
      g.projectiles.forEach(p => drawProjectile(ctx, p));

      // Draw Particles
      g.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      });

      // Draw Floating Texts
      g.floatingTexts.forEach(ft => {
        ctx.font = `900 ${ft.size}px "Inter", sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.globalAlpha = ft.life;
        ctx.textAlign = 'center';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      });

      ctx.restore();
    };

    const loop = (time) => {
      if (!g.lastTime) g.lastTime = time;
      const dt = (time - g.lastTime) / 1000;
      g.lastTime = time;

      if (dt < 0.1) { // Prevent spiral of death
        update(dt);
        draw();
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, selectedProjectile]);

  // --- CONTROLS / GESTURE ARCHITECTURE ---
  
  // These represent the architecture requested for gesture controls
  const controls = useRef({
    grabProjectile: (x, y) => {
      if (gameState !== 'PLAYING') return;
      game.current.slingshot.isPulling = true;
      controls.current.aim(x, y);
      audio.stretch();
    },
    aim: (x, y) => {
      if (!game.current.slingshot.isPulling) return;
      const { slingshot } = game.current;
      const dx = x - slingshot.x;
      const dy = y - slingshot.y;
      const dist = Math.hypot(dx, dy);
      const maxPull = 150;
      
      if (dist > maxPull) {
        slingshot.pullX = slingshot.x + (dx / dist) * maxPull;
        slingshot.pullY = slingshot.y + (dy / dist) * maxPull;
      } else {
        slingshot.pullX = x;
        slingshot.pullY = Math.max(y, slingshot.y - 50); // don't pull forwards too much
      }
    },
    releaseShot: () => {
      if (!game.current.slingshot.isPulling) return;
      const { slingshot } = game.current;
      slingshot.isPulling = false;
      
      const dx = slingshot.x - slingshot.pullX;
      const dy = slingshot.y - slingshot.pullY;
      const power = 4; // Multiplier
      
      if (Math.hypot(dx, dy) > 20) {
        audio.launch();
        stats.current.shotsFired++;
        const baseProj = {
          x: slingshot.pullX, y: slingshot.pullY,
          vx: dx * power, vy: dy * power,
          radius: 15, color: selectedProjectile.color,
          bounce: selectedProjectile.bounce, id: selectedProjectile.id,
          isExplosive: game.current.activePowerups.explosiveTime > 0
        };
        
        game.current.projectiles.push({...baseProj});

        if (game.current.activePowerups.tripleShotTime > 0) {
          game.current.projectiles.push({...baseProj, vx: dx * power * 0.8, vy: (dy - 20) * power});
          game.current.projectiles.push({...baseProj, vx: dx * power * 1.2, vy: (dy + 20) * power});
        }
      }
      
      // Reset pouch
      slingshot.pullX = slingshot.x;
      slingshot.pullY = slingshot.y;
    }
  });

  // Attach controls to window for hypothetical MediaPipe integration
  useEffect(() => {
    window.gestureControls = controls.current;
    return () => delete window.gestureControls;
  }, []);

  // Mouse / Touch Events mapping to architecture
  const handlePointerDown = (e) => {
    if (gameState !== 'PLAYING') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX) - rect.left;
    const y = e.clientY || (e.touches && e.touches[0].clientY) - rect.top;
    
    // Check if clicking near slingshot pouch
    const { slingshot } = game.current;
    if (Math.hypot(x - slingshot.pullX, y - slingshot.pullY) < 60) {
      controls.current.grabProjectile(x, y);
    }
  };

  const handlePointerMove = (e) => {
    if (!game.current.slingshot.isPulling) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0].clientX) - rect.left;
    const y = e.clientY || (e.touches && e.touches[0].clientY) - rect.top;
    controls.current.aim(x, y);
  };

  const handlePointerUp = () => {
    controls.current.releaseShot();
  };

  // --- UI RENDERERS ---
  const BrutalButton = ({ children, onClick, color = 'bg-white', active = false }) => (
    <button 
      onClick={(e) => { audio.init(); onClick(e); }}
      className={`
        px-6 py-3 text-xl font-black uppercase tracking-wider
        border-4 border-black rounded-xl
        ${color} ${active ? 'shadow-none translate-y-[6px] translate-x-[6px]' : 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
        transition-all duration-75 active:shadow-none active:translate-y-[6px] active:translate-x-[6px]
      `}
    >
      {children}
    </button>
  );

  const BrutalCard = ({ children, className = '' }) => (
    <div className={`border-4 border-black bg-white rounded-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8 ${className}`}>
      {children}
    </div>
  );

  const startGame = () => {
    audio.init();
    stats.current.score = 0;
    stats.current.combo = 0;
    stats.current.birdsHit = 0;
    stats.current.shotsFired = 0;
    game.current.birds = [];
    game.current.projectiles = [];
    game.current.particles = [];
    game.current.powerups = [];
    game.current.difficulty = 1;
    game.current.activePowerups = { slowMoTime: 0, doubleScoreTime: 0, tripleShotTime: 0, explosiveTime: 0 };
    setGameState('PLAYING');
  };

  // Main Render
  return (
    <div ref={containerRef} className="relative w-full h-screen bg-sky-200 overflow-hidden font-sans select-none touch-none">
      
      {/* Portrait Overlay */}
      {orientation === 'portrait' && (
        <div className="absolute inset-0 z-50 bg-rose-500 flex flex-col items-center justify-center p-8 text-center">
          <BrutalCard className="bg-yellow-400">
            <h1 className="text-4xl font-black uppercase mb-4 text-black">Rotate Device</h1>
            <p className="text-xl font-bold">Please rotate your device to landscape for the best experience.</p>
            <div className="mt-8 text-6xl animate-spin-slow">🔄</div>
          </BrutalCard>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      />

      {/* HUD - Absolute Positioned */}
      {gameState === 'PLAYING' && (
        <>
          {/* Top HUD */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
            <div className="flex gap-4">
              <BrutalCard className="!p-3 !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-blue-400 text-black">
                <div className="text-xs font-black uppercase">Score</div>
                <div className="text-3xl font-black">{stats.current.score}</div>
              </BrutalCard>
              <BrutalCard className="!p-3 !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-pink-400 text-black">
                <div className="text-xs font-black uppercase">Combo</div>
                <div className="text-3xl font-black">x{stats.current.combo}</div>
              </BrutalCard>
            </div>
            <div className="flex gap-4">
              <BrutalCard className="!p-3 !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-black">
                <div className="text-xs font-black uppercase">High Score</div>
                <div className="text-xl font-black">{stats.current.highScore}</div>
              </BrutalCard>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
            <div className="flex gap-2">
              <BrutalButton onClick={() => setGameState('PAUSED')} color="bg-rose-400">⏸ Pause</BrutalButton>
              <BrutalButton onClick={() => { audio.enabled = !audio.enabled; setHudUpdate(h=>h+1); }} color={audio.enabled ? "bg-green-400" : "bg-gray-400"}>
                {audio.enabled ? '🔊' : '🔇'}
              </BrutalButton>
            </div>
            
            {/* Active Powerups Indicators */}
            <div className="flex gap-2 pointer-events-none">
                {game.current.activePowerups.slowMoTime > 0 && <span className="bg-cyan-400 text-black border-2 border-black font-bold px-2 py-1 rounded">SLOW-MO</span>}
                {game.current.activePowerups.tripleShotTime > 0 && <span className="bg-orange-400 text-black border-2 border-black font-bold px-2 py-1 rounded">TRIPLE</span>}
                {game.current.activePowerups.doubleScoreTime > 0 && <span className="bg-yellow-400 text-black border-2 border-black font-bold px-2 py-1 rounded">2X PTS</span>}
                {game.current.activePowerups.explosiveTime > 0 && <span className="bg-red-500 text-white border-2 border-black font-bold px-2 py-1 rounded">BOOM</span>}
            </div>

            <div className="flex gap-2">
               <BrutalCard className="!p-2 !rounded-xl !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white flex gap-2">
                  {PROJECTILES.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setSelectedProjectile(p)}
                      className={`w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center transition-all ${selectedProjectile.id === p.id ? 'bg-black text-white scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                      style={{ backgroundColor: selectedProjectile.id === p.id ? p.color : '' }}
                    >
                      <div className="w-6 h-6 rounded-full border-2 border-black" style={{ backgroundColor: p.color }}></div>
                    </button>
                  ))}
               </BrutalCard>
            </div>
          </div>
        </>
      )}

      {/* Main Menu */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-40">
          <BrutalCard className="bg-yellow-400 max-w-2xl w-full text-center flex flex-col items-center">
            <h1 className="text-6xl font-black uppercase text-black mb-2 drop-shadow-[4px_4px_0px_#fff]">Bird Hunter</h1>
            <h2 className="text-2xl font-bold uppercase text-black bg-white px-4 py-1 border-4 border-black inline-block -rotate-2 mb-8">Hit the Moving Bird</h2>
            
            <p className="text-lg font-bold mb-8 max-w-md">
              Aim with a slingshot and hit birds flying through unpredictable paths. Each successful hit increases difficulty.
            </p>

            <div className="mb-8 w-full">
              <h3 className="text-xl font-black mb-4 uppercase">Select Ammo</h3>
              <div className="flex justify-center gap-4 flex-wrap">
                {PROJECTILES.map(p => (
                  <BrutalButton 
                    key={p.id} 
                    color={selectedProjectile.id === p.id ? 'bg-black text-white' : 'bg-white'} 
                    onClick={() => setSelectedProjectile(p)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white bg-current" style={{ color: p.color }}></div>
                      {p.name}
                    </div>
                  </BrutalButton>
                ))}
              </div>
            </div>

            <BrutalButton onClick={startGame} color="bg-green-400">
              <span className="text-3xl px-8">START CHALLENGE</span>
            </BrutalButton>
            
            <div className="mt-6 font-bold uppercase text-sm flex gap-4">
               <span>Mouse</span> • <span>Touch</span> • <span>Gesture Ready</span>
            </div>
          </BrutalCard>
        </div>
      )}

      {/* Pause Menu */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-40">
          <BrutalCard className="bg-sky-300 text-center flex flex-col items-center gap-6">
            <h2 className="text-5xl font-black uppercase text-black">Paused</h2>
            
            <div className="flex flex-col gap-4 w-64">
              <BrutalButton onClick={() => setGameState('PLAYING')} color="bg-green-400">Resume</BrutalButton>
              <BrutalButton onClick={startGame} color="bg-yellow-400">Restart</BrutalButton>
              <BrutalButton onClick={() => setGameState('MENU')} color="bg-white">Main Menu</BrutalButton>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <label className="font-bold uppercase flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-6 h-6 border-4 border-black appearance-none checked:bg-black relative after:content-[''] checked:after:absolute checked:after:w-2 checked:after:h-4 checked:after:border-r-4 checked:after:border-b-4 checked:after:border-white checked:after:rotate-45 checked:after:left-[6px] checked:after:top-[2px]"
                  checked={stats.current.showTrajectory}
                  onChange={(e) => { stats.current.showTrajectory = e.target.checked; setHudUpdate(h=>h+1); }}
                />
                Show Trajectory Line
              </label>
            </div>
          </BrutalCard>
        </div>
      )}
      
      {/* Hidden update trigger for HUD */}
      <span className="hidden">{hudUpdate}</span>
    </div>
  );
}