import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';
import { mapHandToScreen } from '../utils/resolution';

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
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    try {
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
    } catch (e) {}
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
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const handOverlayRef = useRef(null);

  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, PAUSED
  const [orientation, setOrientation] = useState('landscape');
  const [activeGesture, setActiveGesture] = useState(GESTURES.NONE);
  const [handTracked, setHandTracked] = useState(false);

  // Gesture tracking refs
  const lastGestureRef = useRef(GESTURES.NONE);
  const pauseCooldownRef = useRef(0);
  const handPosRef = useRef({ x: 400, y: 500 });
  const gameStateRef = useRef('MENU');

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // HUD States
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

      // Aim Trajectory Predictive Line
      if (slingshot.isPulling && stats.current.showTrajectory) {
        ctx.save();
        ctx.strokeStyle = g.activePowerups.explosiveTime > 0 ? '#EF4444' : '#F97316';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        const dx = slingshot.x - slingshot.pullX;
        const dy = slingshot.y - slingshot.pullY;
        const power = 4.2;
        let px = slingshot.pullX;
        let py = slingshot.pullY;
        let pvx = dx * power;
        let pvy = dy * power;
        ctx.moveTo(px, py);
        for (let i = 0; i < 28; i++) {
          px += pvx * 0.035;
          py += pvy * 0.035;
          pvy += 400 * 0.035; // gravity
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
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
  const controls = useRef({
    grabProjectile: (x, y) => {
      if (gameStateRef.current !== 'PLAYING') return;
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
      const maxPull = 160;
      
      if (dist > maxPull) {
        slingshot.pullX = slingshot.x + (dx / dist) * maxPull;
        slingshot.pullY = slingshot.y + (dy / dist) * maxPull;
      } else {
        slingshot.pullX = x;
        slingshot.pullY = Math.max(y, slingshot.y - 40); // don't pull forwards too much
      }
    },
    releaseShot: () => {
      if (!game.current.slingshot.isPulling) return;
      const { slingshot } = game.current;
      slingshot.isPulling = false;
      
      const dx = slingshot.x - slingshot.pullX;
      const dy = slingshot.y - slingshot.pullY;
      const power = 4.2; // Multiplier
      
      if (Math.hypot(dx, dy) > 15) {
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

  // --- HAND TRACKING INTEGRATION ---
  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: (gesture, indexTip, dims, landmarks) => {
      const c = canvasRef.current;
      const v = videoRef.current;
      const currentGameState = gameStateRef.current;

      if (!landmarks && !indexTip) {
        setHandTracked(false);
        setActiveGesture(GESTURES.NONE);
        if (game.current.slingshot.isPulling && lastGestureRef.current === GESTURES.PINCH) {
          controls.current.releaseShot();
        }
        lastGestureRef.current = GESTURES.NONE;
        return;
      }

      setHandTracked(true);
      setActiveGesture(gesture);

      if (c && v) {
        const thumbLm = landmarks ? landmarks[4] : indexTip;
        const indexLm = landmarks ? landmarks[8] : indexTip;
        const pinchLm = landmarks
          ? { x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2 }
          : indexTip;

        const pos = mapHandToScreen(
          gesture === GESTURES.PINCH ? pinchLm : indexLm,
          c.width, c.height, v.videoWidth, v.videoHeight, true
        );
        handPosRef.current = pos;

        // 🤏 PINCH: Grab Slingshot & Aim
        if (gesture === GESTURES.PINCH) {
          if (currentGameState === 'PLAYING') {
            if (!game.current.slingshot.isPulling) {
              controls.current.grabProjectile(pos.x, pos.y);
            } else {
              controls.current.aim(pos.x, pos.y);
            }
          }
        }
        // RELEASE PINCH: Release Shot!
        else if (lastGestureRef.current === GESTURES.PINCH && gesture !== GESTURES.PAN) {
          if (game.current.slingshot.isPulling && currentGameState === 'PLAYING') {
            controls.current.releaseShot();
          }
        }
        // ✊ FIST: Cancel Shot / Reset Aim
        else if (gesture === GESTURES.PAN) {
          game.current.slingshot.isPulling = false;
          game.current.slingshot.pullX = game.current.slingshot.x;
          game.current.slingshot.pullY = game.current.slingshot.y;
        }
        // 🤟 ROCK: Pause / Resume Game
        else if (gesture === GESTURES.ROCK) {
          if (Date.now() - pauseCooldownRef.current > 1200) {
            pauseCooldownRef.current = Date.now();
            if (currentGameState === 'PLAYING') {
              setGameState('PAUSED');
            } else if (currentGameState === 'PAUSED') {
              setGameState('PLAYING');
            }
          }
        }
      }

      lastGestureRef.current = gesture;
    }
  });

  // Mouse / Touch Events mapping
  const handlePointerDown = (e) => {
    if (gameState !== 'PLAYING') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX !== undefined ? e.clientX : e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY !== undefined ? e.clientY : e.touches?.[0]?.clientY) - rect.top;
    
    controls.current.grabProjectile(x, y);
  };

  const handlePointerMove = (e) => {
    if (!game.current.slingshot.isPulling) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX !== undefined ? e.clientX : e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY !== undefined ? e.clientY : e.touches?.[0]?.clientY) - rect.top;
    controls.current.aim(x, y);
  };

  const handlePointerUp = () => {
    controls.current.releaseShot();
  };

  // --- UI RENDERERS ---
  const BrutalButton = ({ children, onClick, color = 'bg-white', active = false, className = '' }) => (
    <button 
      onClick={(e) => { audio.init(); onClick(e); }}
      className={`
        px-5 py-2.5 text-sm sm:text-base font-black uppercase tracking-wider
        border-4 border-black rounded-xl
        ${color} ${active ? 'shadow-none translate-y-[4px] translate-x-[4px]' : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}
        transition-all duration-75 active:shadow-none active:translate-y-[4px] active:translate-x-[4px] ${className}
      `}
    >
      {children}
    </button>
  );

  const BrutalCard = ({ children, className = '' }) => (
    <div className={`border-4 border-black bg-white rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 sm:p-6 ${className}`}>
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
      
      {/* Tracking Camera & Landmark Overlays */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          opacity: 0.05,
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={handOverlayRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1)',
          pointerEvents: 'none',
        }}
      />

      {/* Portrait Notice Overlay */}
      {orientation === 'portrait' && (
        <div className="absolute inset-0 z-50 bg-rose-500 flex flex-col items-center justify-center p-8 text-center">
          <BrutalCard className="bg-yellow-400">
            <h1 className="text-3xl font-black uppercase mb-3 text-black">Rotate Device</h1>
            <p className="text-base font-bold">Please rotate your device to landscape for the best slingshot hunting experience.</p>
            <div className="mt-4 text-5xl animate-spin-slow">🔄</div>
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

      {/* Top Neo-Brutalist HUD */}
      <header className="absolute top-4 left-4 right-4 z-10 flex flex-wrap justify-between items-center gap-3 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Back to Home Button */}
          <button
            onClick={() => navigate('/')}
            className="bg-white hover:bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none px-3.5 py-2 rounded-xl text-xs font-mono font-black uppercase transition-all flex items-center gap-1.5"
            title="Back to Home"
          >
            <span>←</span> HOME
          </button>

          {/* Score Card */}
          <div className="bg-yellow-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl">
            <span className="text-xs font-black uppercase tracking-wider block text-black">Score</span>
            <span className="text-2xl sm:text-3xl font-black text-black">{stats.current.score}</span>
          </div>

          {/* Combo Multiplier */}
          <div className="bg-pink-500 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl text-white">
            <span className="text-xs font-black uppercase tracking-wider block">Combo</span>
            <span className="text-2xl sm:text-3xl font-black">x{stats.current.combo}</span>
          </div>
        </div>

        {/* Live Gesture Detection Chip */}
        <div className="flex items-center gap-2 bg-white/95 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3.5 py-1.5 rounded-xl pointer-events-auto">
          <span className={`w-2.5 h-2.5 rounded-full border border-black ${handTracked ? 'bg-neo-lime animate-pulse' : 'bg-zinc-400'}`} />
          <span className="text-xs font-mono font-bold text-zinc-600">GESTURE:</span>
          <span className="text-xs font-mono font-black uppercase text-black">
            {activeGesture === GESTURES.PINCH ? '🤏 Aim Slingshot' :
             activeGesture === GESTURES.PAN ? '✊ Cancel Shot' :
             activeGesture === GESTURES.ROCK ? '🤟 Pause' :
             handTracked ? '✋ Hand Ready' : '🔍 Detect Hand'}
          </span>
        </div>

        {/* High Score Card */}
        <div className="bg-cyan-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl pointer-events-auto">
          <span className="text-xs font-black uppercase tracking-wider block text-black">High Score</span>
          <span className="text-2xl sm:text-3xl font-black text-black">{stats.current.highScore}</span>
        </div>
      </header>

      {/* Bottom Controls */}
      {gameState === 'PLAYING' && (
        <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-between items-end pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <BrutalButton onClick={() => setGameState('PAUSED')} color="bg-rose-400">⏸ Pause</BrutalButton>
            <BrutalButton onClick={() => { audio.enabled = !audio.enabled; setHudUpdate(h=>h+1); }} color={audio.enabled ? "bg-green-400" : "bg-gray-400"}>
              {audio.enabled ? '🔊' : '🔇'}
            </BrutalButton>
          </div>
          
          {/* Active Powerups Indicators */}
          <div className="flex gap-2 pointer-events-none">
            {game.current.activePowerups.slowMoTime > 0 && <span className="bg-cyan-400 text-black border-2 border-black font-black px-2.5 py-1 rounded shadow-neo-sm">SLOW-MO</span>}
            {game.current.activePowerups.tripleShotTime > 0 && <span className="bg-orange-400 text-black border-2 border-black font-black px-2.5 py-1 rounded shadow-neo-sm">TRIPLE</span>}
            {game.current.activePowerups.doubleScoreTime > 0 && <span className="bg-yellow-400 text-black border-2 border-black font-black px-2.5 py-1 rounded shadow-neo-sm">2X PTS</span>}
            {game.current.activePowerups.explosiveTime > 0 && <span className="bg-red-500 text-white border-2 border-black font-black px-2.5 py-1 rounded shadow-neo-sm">BOOM</span>}
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <BrutalCard className="!p-2 !rounded-xl !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white flex gap-2">
              {PROJECTILES.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setSelectedProjectile(p)}
                  className={`w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center transition-all ${selectedProjectile.id === p.id ? 'scale-110 shadow-neo-sm' : 'bg-gray-100 hover:bg-gray-200'}`}
                  style={{ backgroundColor: selectedProjectile.id === p.id ? p.color : '' }}
                >
                  <div className="w-5 h-5 rounded-full border-2 border-black" style={{ backgroundColor: p.color }}></div>
                </button>
              ))}
            </BrutalCard>
          </div>
        </div>
      )}

      {/* Main Menu Modal */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-40 p-4">
          <BrutalCard className="bg-yellow-400 max-w-xl w-full text-center flex flex-col items-center gap-4">
            <h1 className="text-4xl sm:text-5xl font-black uppercase text-black drop-shadow-[3px_3px_0px_#fff]">
              BIRD HUNTER
            </h1>
            <h2 className="text-lg font-black uppercase text-black bg-white px-3 py-1 border-3 border-black inline-block -rotate-1">
              Slingshot Precision Challenge
            </h2>
            
            <p className="text-sm font-bold max-w-md text-zinc-900">
              Aim your slingshot with hand gestures or mouse. Strike birds along chaotic flight paths and rack up combo multipliers!
            </p>

            {/* Gesture Guide Table */}
            <div className="w-full text-left bg-white border-3 border-black p-3.5 rounded-xl text-xs">
              <p className="font-display font-black text-sm mb-2 uppercase text-black">🎯 Hand Gesture Controls:</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 font-mono text-[11px] font-bold">
                <div className="flex items-center gap-1.5"><span className="text-sm">🤏</span> <span>Pinch:</span></div>
                <div className="text-zinc-800">Grab pouch & stretch band</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">✋</span> <span>Move Hand:</span></div>
                <div className="text-zinc-800">Aim trajectory & power</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">🏹</span> <span>Release:</span></div>
                <div className="text-emerald-700">Fire projectile!</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">✊</span> <span>Fist:</span></div>
                <div className="text-rose-700">Cancel shot</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">🤟</span> <span>Rock Sign:</span></div>
                <div className="text-amber-700">Pause / Resume</div>
              </div>
            </div>

            {/* Ammo Selector */}
            <div className="w-full">
              <h3 className="text-xs font-black mb-2 uppercase tracking-wider">Select Ammo Type:</h3>
              <div className="flex justify-center gap-2 flex-wrap">
                {PROJECTILES.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => setSelectedProjectile(p)}
                    className={`px-3 py-1.5 rounded-lg border-2 border-black font-bold text-xs flex items-center gap-1.5 transition-all ${selectedProjectile.id === p.id ? 'bg-black text-white shadow-neo-sm scale-105' : 'bg-white text-black'}`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full border border-black" style={{ backgroundColor: p.color }}></div>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <BrutalButton onClick={startGame} color="bg-green-400" className="w-full py-3.5 text-xl">
              START CHALLENGE
            </BrutalButton>
          </BrutalCard>
        </div>
      )}

      {/* Pause Menu Modal */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-40 p-4">
          <BrutalCard className="bg-sky-300 text-center flex flex-col items-center gap-5 max-w-sm w-full">
            <h2 className="text-4xl font-black uppercase text-black">Game Paused</h2>
            
            <div className="flex flex-col gap-3 w-full">
              <BrutalButton onClick={() => setGameState('PLAYING')} color="bg-green-400">▶ Resume</BrutalButton>
              <BrutalButton onClick={startGame} color="bg-yellow-400">↺ Restart</BrutalButton>
              <BrutalButton onClick={() => setGameState('MENU')} color="bg-white">☰ Main Menu</BrutalButton>
            </div>

            <div className="w-full flex items-center justify-center gap-2 bg-white p-3 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl">
              <label className="font-bold text-xs uppercase flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 border-2 border-black"
                  checked={stats.current.showTrajectory}
                  onChange={(e) => { stats.current.showTrajectory = e.target.checked; setHudUpdate(h=>h+1); }}
                />
                Show Trajectory Arc
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