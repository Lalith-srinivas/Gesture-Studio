import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandTracking } from '../hooks/useHandTracking';
import { GESTURES } from '../utils/gestureDetector';
import { mapHandToScreen } from '../utils/resolution';

/**
 * ArcheryChallenge.jsx
 *
 * Neo-Brutalist Archery Game built with React, Canvas, and Tailwind CSS.
 * Powered by MediaPipe hand tracking with intuitive gesture controls:
 * 🤏 Pinch = Grab & Aim | ↩️ Pull = Power | Release = Shoot | ✊ Fist = Cancel | ✋ Palm = Pause
 */

// --- AUDIO SYNTHESIZER (Web Audio API - No external assets required) ---
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBowTension(factor = 1) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80 + factor * 120, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }

  playRelease() {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }

  playHit(isBullseye = false) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isBullseye ? 'sine' : 'square';
      const freq = isBullseye ? 880 : 220;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (isBullseye) {
        osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.2);
      }
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (isBullseye ? 0.3 : 0.15));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (isBullseye ? 0.3 : 0.15));
    } catch (e) {}
  }
}

const soundManager = new SoundEffects();

export default function ArcheryChallenge() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const handOverlayRef = useRef(null);

  // Game UI State
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, PAUSED, GAMEOVER
  const [isMuted, setIsMuted] = useState(false);
  const [activePowerup, setActivePowerup] = useState(null);
  const [powerupTimeLeft, setPowerupTimeLeft] = useState(0);
  const [activeGesture, setActiveGesture] = useState(GESTURES.NONE);
  const [handTracked, setHandTracked] = useState(false);

  // Gesture tracking refs
  const lastGestureRef = useRef(GESTURES.NONE);
  const pauseCooldownRef = useRef(0);
  const handPosRef = useRef({ x: 100, y: 300 });
  const gameStateRef = useRef('MENU'); // mirror of gameState to avoid stale closure

  // Keep gameStateRef in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // References for Animation Loop and Logic State
  const stateRef = useRef({
    score: 0,
    combo: 0,
    consecutiveMisses: 0,
    difficultyMultiplier: 1,
    lastTime: 0,
    cameraShake: 0,
    slowMoTimer: 0,
    powerup: null, // 'SLOW', 'DOUBLE', 'MULTI', 'PIERCE'
    powerupTimer: 0,
    bow: { x: 300, y: 300, tension: 0, isAiming: false, aimAngle: 0 },
    arrows: [],
    targets: [],
    particles: [],
    floatingTexts: [],
    powerupItems: []
  });

  // --- LOCAL STORAGE HIGH SCORE ---
  useEffect(() => {
    const savedScore = localStorage.getItem('archery_high_score');
    if (savedScore) setHighScore(parseInt(savedScore, 10));
  }, []);

  const updateHighScore = (newScore) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('archery_high_score', newScore.toString());
    }
  };

  // --- ARROW RELEASE / SHOOT LOGIC ---
  const releaseArrow = useCallback(() => {
    const s = stateRef.current;
    if (!s.bow.isAiming) return;
    s.bow.isAiming = false;
    
    if (s.bow.tension < 0.15) {
      s.bow.tension = 0;
      return;
    }

    soundManager.playRelease();
    const speed = s.bow.tension * 34;
    const spawnArrow = (angleOffset = 0) => ({
      x: s.bow.x,
      y: s.bow.y,
      vx: Math.cos(s.bow.aimAngle + angleOffset) * speed,
      vy: Math.sin(s.bow.aimAngle + angleOffset) * speed,
      angle: s.bow.aimAngle + angleOffset,
      length: 45,
      isPierce: s.powerup === 'PIERCE',
      trail: [],
      stuck: false
    });

    if (s.powerup === 'MULTI') {
      s.arrows.push(spawnArrow(-0.15), spawnArrow(0), spawnArrow(0.15));
    } else {
      s.arrows.push(spawnArrow(0));
    }

    s.bow.tension = 0;
  }, []);

  // --- AIM ARROW LOGIC (MOUSE / TOUCH / GESTURE) ---
  // Hand position (pos) is where the pinched hand is.
  // The bow is anchored at bow.x, bow.y.
  // Aim angle = direction FROM bow TO the hand position (toward targets on the right).
  const aimArrow = useCallback((handX, handY) => {
    const s = stateRef.current;
    if (!s.bow.isAiming) return;
    const bowX = s.bow.x;
    const bowY = s.bow.y;
    // Vector from bow to hand
    const dx = handX - bowX;
    const dy = handY - bowY;
    const dist = Math.hypot(dx, dy);
    // Clamp angle to a reasonable firing arc (-75° to +75°)
    const rawAngle = Math.atan2(dy, dx);
    s.bow.aimAngle = Math.max(-Math.PI * 0.42, Math.min(Math.PI * 0.42, rawAngle));
    // Tension grows the further the hand is from the bow (min 0.2, max 1.25)
    s.bow.tension = Math.min(Math.max(0.2, dist / 120), 1.25);
    soundManager.playBowTension(s.bow.tension);
  }, []);

  const grabBow = useCallback((x, y) => {
    const s = stateRef.current;
    s.bow.isAiming = true;
    aimArrow(x, y);
  }, [aimArrow]);

  // --- HAND TRACKING INTEGRATION ---
  useHandTracking({
    videoRef,
    overlayCanvasRef: handOverlayRef,
    onGesture: (gesture, indexTip, dims, landmarks) => {
      const s = stateRef.current;
      const c = canvasRef.current;
      const v = videoRef.current;
      const currentGameState = gameStateRef.current; // always fresh

      if (!landmarks && !indexTip) {
        setHandTracked(false);
        setActiveGesture(GESTURES.NONE);
        // If hand disappears while aiming, shoot
        if (s.bow.isAiming && lastGestureRef.current === GESTURES.PINCH) {
          releaseArrow();
        }
        lastGestureRef.current = GESTURES.NONE;
        return;
      }

      setHandTracked(true);
      setActiveGesture(gesture);

      // Use thumb tip (lm[4]) for pinch position — more intuitive for aiming
      if (c && v) {
        const thumbLm = landmarks ? landmarks[4] : indexTip;
        const indexLm = landmarks ? landmarks[8] : indexTip;
        // Average of thumb + index tip = pinch midpoint
        const pinchLm = landmarks
          ? { x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2 }
          : indexTip;

        const pos = mapHandToScreen(
          gesture === GESTURES.PINCH ? pinchLm : indexLm,
          c.width, c.height, v.videoWidth, v.videoHeight, true
        );
        handPosRef.current = pos;

        // 🤏 PINCH: Grab bowstring & aim
        if (gesture === GESTURES.PINCH) {
          if (currentGameState === 'PLAYING') {
            s.bow.isAiming = true;
            aimArrow(pos.x, pos.y);
          }
        }
        // Release pinch → Shoot!
        else if (lastGestureRef.current === GESTURES.PINCH) {
          if (s.bow.isAiming && currentGameState === 'PLAYING') {
            releaseArrow();
          }
        }
        // ✊ FIST: Cancel
        else if (gesture === GESTURES.PAN) {
          s.bow.isAiming = false;
          s.bow.tension = 0;
        }
        // 🤟 ROCK: Pause/Resume (with 1.2s debounce)
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

  // --- SPAWN LOGIC ---
  const spawnTarget = useCallback((canvasWidth, canvasHeight) => {
    const diff = stateRef.current.difficultyMultiplier;
    const currentScore = stateRef.current.score;
    const radius = Math.max(18, 45 - diff * 2);

    // Spawn targets in the right portion of the canvas (55%–90% of width)
    const minX = canvasWidth * 0.55;
    const maxX = canvasWidth * 0.9;
    const x = minX + Math.random() * (maxX - minX);
    const y = Math.random() * (canvasHeight - 160) + 80;

    // Targets start moving once score crosses 500
    let movementType = 'STATIC';
    let speed = 0;
    if (currentScore >= 500) {
      const roll = Math.random();
      if (roll < 0.4) { movementType = 'VERTICAL'; speed = 1.2 + Math.random() * 1.2; }
      else if (roll < 0.7) { movementType = 'HORIZONTAL'; speed = 1.0 + Math.random() * 1.0; }
      else { movementType = 'ZIGZAG'; speed = 1.0 + Math.random() * 0.8; }
      // Above 1000 move faster
      if (currentScore >= 1000) speed *= 1.5;
    }

    stateRef.current.targets.push({
      id: Math.random(),
      x,
      y,
      baseY: y,
      baseX: x,
      radius,
      speed,
      movementType,
      timer: Math.max(5, 10 - diff * 0.4),
      maxTimer: Math.max(5, 10 - diff * 0.4),
      phase: Math.random() * Math.PI * 2
    });
  }, []);

  const spawnPowerup = useCallback((x, y) => {
    const types = ['SLOW', 'DOUBLE', 'PIERCE', 'MULTI'];
    const type = types[Math.floor(Math.random() * types.length)];
    stateRef.current.powerupItems.push({ x, y, type, radius: 18, vy: -1.5, opacity: 1 });
  }, []);

  // --- GAME START & RESET ---
  const startGame = () => {
    soundManager.init();
    const canvas = canvasRef.current;
    const bowX = canvas ? Math.floor(canvas.width * 0.35) : 300;
    stateRef.current = {
      score: 0,
      combo: 0,
      consecutiveMisses: 0,
      difficultyMultiplier: 1,
      lastTime: performance.now(),
      cameraShake: 0,
      slowMoTimer: 0,
      powerup: null,
      powerupTimer: 0,
      bow: { x: bowX, y: canvas ? canvas.height / 2 : 300, tension: 0, isAiming: false, aimAngle: 0 },
      arrows: [],
      targets: [],
      particles: [],
      floatingTexts: [],
      powerupItems: []
    };
    setScore(0);
    setCombo(0);
    setConsecutiveMisses(0);
    setActivePowerup(null);
    setGameState('PLAYING');
  };

  // --- CANVAS & GAME LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;

    const handleResize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      if (stateRef.current.bow) {
        stateRef.current.bow.x = Math.floor(canvas.width * 0.35);
        stateRef.current.bow.y = canvas.height / 2;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const addFloatingText = (text, x, y, color = '#FACC15') => {
      stateRef.current.floatingTexts.push({ text, x, y, vy: -1.5, alpha: 1, color });
    };

    const addParticles = (x, y, color, count = 12) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        stateRef.current.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          size: Math.random() * 6 + 3,
          color
        });
      }
    };

    // Main Engine Render Loop
    const render = (time) => {
      const s = stateRef.current;
      let dt = (time - s.lastTime) / 1000;
      s.lastTime = time;

      if (dt > 0.1) dt = 0.1;

      // Handle Slow Motion FX
      if (s.slowMoTimer > 0) {
        s.slowMoTimer -= dt;
        dt *= 0.35;
      }

      // Handle Active Power-up Timer
      if (s.powerup) {
        s.powerupTimer -= dt;
        setPowerupTimeLeft(Math.ceil(s.powerupTimer));
        if (s.powerupTimer <= 0) {
          s.powerup = null;
          setActivePowerup(null);
        }
      }

      if (gameState === 'PLAYING') {
        // Dynamic Difficulty Scaling
        s.difficultyMultiplier += dt * 0.03;

        // Ensure Target Count
        if (s.targets.length < Math.min(5, Math.floor(2 + s.difficultyMultiplier * 0.5))) {
          spawnTarget(canvas.width, canvas.height);
        }

        // --- UPDATE TARGETS ---
        s.targets.forEach((t) => {
          t.timer -= dt;
          // Move only if score >= 500 and target has movement assigned
          if (t.movementType !== 'STATIC' && t.speed > 0) {
            t.phase += dt * t.speed;
            if (t.movementType === 'VERTICAL') {
              t.y = t.baseY + Math.sin(t.phase) * 65;
            } else if (t.movementType === 'HORIZONTAL') {
              t.x = t.baseX + Math.cos(t.phase) * 70;
            } else if (t.movementType === 'ZIGZAG') {
              t.x = t.baseX + Math.cos(t.phase) * 55;
              t.y = t.baseY + Math.sin(t.phase * 2) * 45;
            }
          }
        });

        // Filter expired targets (missed targets)
        s.targets = s.targets.filter((t) => {
          if (t.timer <= 0) {
            s.combo = 0;
            setCombo(0);
            s.consecutiveMisses = (s.consecutiveMisses || 0) + 1;
            setConsecutiveMisses(s.consecutiveMisses);
            s.cameraShake = 12;
            addFloatingText(`MISS! (${s.consecutiveMisses}/3)`, t.x, t.y, '#EF4444');
            if (s.consecutiveMisses >= 3) {
              setGameState('GAMEOVER');
            }
            return false;
          }
          return true;
        });

        // --- UPDATE ARROWS & COLLISIONS ---
        const gravity = 12;
        s.arrows.forEach((arrow) => {
          if (arrow.stuck) return;

          arrow.vy += gravity * dt;
          arrow.x += arrow.vx;
          arrow.y += arrow.vy;
          arrow.angle = Math.atan2(arrow.vy, arrow.vx);

          arrow.trail.push({ x: arrow.x, y: arrow.y });
          if (arrow.trail.length > 8) arrow.trail.shift();

          // Check Target Hits
          s.targets.forEach((target) => {
            const dist = Math.hypot(arrow.x - target.x, arrow.y - target.y);

            if (dist < target.radius + 8) {
              // Reset consecutive misses on hit!
              s.consecutiveMisses = 0;
              setConsecutiveMisses(0);

              // Hit Scored
              const isBullseye = dist < target.radius * 0.25;
              const isPerfect = !isBullseye && dist < target.radius * 0.5;
              const isGreat = !isBullseye && !isPerfect && dist < target.radius * 0.75;

              let points = 50;
              let label = 'GOOD!';
              let color = '#3B82F6';

              if (isBullseye) {
                points = 250;
                label = 'BULLSEYE!';
                color = '#EF4444';
                s.slowMoTimer = 0.6;
                s.cameraShake = 12;
              } else if (isPerfect) {
                points = 150;
                label = 'PERFECT!';
                color = '#F59E0B';
              } else if (isGreat) {
                points = 100;
                label = 'GREAT!';
                color = '#10B981';
              }

              if (s.powerup === 'DOUBLE') points *= 2;

              s.combo += 1;
              const finalScore = points * s.combo;
              s.score += finalScore;
              const prevScore = s.score - finalScore;

              setScore(s.score);
              setCombo(s.combo);
              updateHighScore(s.score);

              // 🎯 Milestone: score crosses 500 — targets start moving!
              if (prevScore < 500 && s.score >= 500) {
                addFloatingText('⚡ TARGETS NOW MOVING!', canvas.width / 2, canvas.height / 2, '#EF4444');
                s.cameraShake = 18;
                // Upgrade all existing stationary targets to move
                s.targets.forEach((t) => {
                  if (t.movementType === 'STATIC') {
                    const roll = Math.random();
                    if (roll < 0.4) { t.movementType = 'VERTICAL'; t.speed = 1.2; }
                    else if (roll < 0.7) { t.movementType = 'HORIZONTAL'; t.speed = 1.0; }
                    else { t.movementType = 'ZIGZAG'; t.speed = 1.0; }
                    t.baseX = t.x;
                    t.baseY = t.y;
                    t.phase = Math.random() * Math.PI * 2;
                  }
                });
              }
              // Milestone: score crosses 1000 — targets move faster
              if (prevScore < 1000 && s.score >= 1000) {
                addFloatingText('🔥 SPEED UP!', canvas.width / 2, canvas.height / 2, '#F97316');
                s.cameraShake = 14;
                s.targets.forEach((t) => { t.speed = Math.max(t.speed, 1.5) * 1.4; });
              }

              soundManager.playHit(isBullseye);
              addFloatingText(`${label} +${finalScore}`, target.x, target.y - 20, color);
              addParticles(target.x, target.y, color, isBullseye ? 25 : 12);

              // Powerup Spawn Chance
              if (Math.random() < 0.25) {
                spawnPowerup(target.x, target.y);
              }

              if (!arrow.isPierce) arrow.stuck = true;

              // Remove Target
              target.dead = true;
            }
          });

          // Check Powerup Item Pickups
          s.powerupItems.forEach((p) => {
            if (Math.hypot(arrow.x - p.x, arrow.y - p.y) < p.radius + 15) {
              s.powerup = p.type;
              s.powerupTimer = 10;
              setActivePowerup(p.type);
              addFloatingText(`POWERUP: ${p.type}!`, p.x, p.y, '#A855F7');
              p.dead = true;
            }
          });
        });

        // Clean up dead entities
        s.targets = s.targets.filter((t) => !t.dead);
        s.powerupItems = s.powerupItems.filter((p) => !p.dead);
        s.arrows = s.arrows.filter(
          (a) => a.x > -50 && a.x < canvas.width + 50 && a.y > -50 && a.y < canvas.height + 50
        );
      }

      // --- RENDERING PHASE ---
      ctx.save();

      // Screen Shake FX
      if (s.cameraShake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * s.cameraShake,
          (Math.random() - 0.5) * s.cameraShake
        );
        s.cameraShake *= 0.85;
      }

      // Clear Canvas Background
      ctx.fillStyle = '#FDF6E3'; // Neo Brutalist Parchment Light Background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Archery Range Grid Lines (Neo Brutalist aesthetic)
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      ctx.stroke();

      // Draw Targets
      s.targets.forEach((t) => {
        ctx.save();
        ctx.translate(t.x, t.y);

        // Timer Arc Ring
        ctx.beginPath();
        ctx.arc(0, 0, t.radius + 8, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (t.timer / t.maxTimer)));
        ctx.strokeStyle = t.timer < 2 ? '#EF4444' : '#000000';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Target Rings (Bold Neo-Brutalist Colors)
        const rings = [
          { r: t.radius, color: '#000000' },
          { r: t.radius * 0.75, color: '#3B82F6' },
          { r: t.radius * 0.5, color: '#F59E0B' },
          { r: t.radius * 0.25, color: '#EF4444' }
        ];

        rings.forEach((ring) => {
          ctx.beginPath();
          ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
          ctx.fillStyle = ring.color;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#000000';
          ctx.stroke();
        });

        ctx.restore();
      });

      // Draw Floating Powerup Items
      s.powerupItems.forEach((p) => {
        p.y += p.vy * 0.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type[0], 0, 0);
        ctx.restore();
      });

      // ─── Draw Bow & Aim Line ──────────────────────────────────────────────
      if (s.bow) {
        ctx.save();
        ctx.translate(s.bow.x, s.bow.y);

        // ── Always-visible direction indicator (even when not aiming) ──
        // Dashed line showing current aim angle
        const aimLen = 120 + s.bow.tension * 80;
        ctx.save();
        ctx.rotate(s.bow.aimAngle);
        // Bold background line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(aimLen, 0);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 8;
        ctx.setLineDash([]);
        ctx.stroke();
        // Bright dashed direction line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(aimLen, 0);
        ctx.strokeStyle = s.bow.isAiming ? '#EF4444' : '#F97316';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Arrowhead at end
        ctx.beginPath();
        ctx.moveTo(aimLen, 0);
        ctx.lineTo(aimLen - 14, -7);
        ctx.lineTo(aimLen - 14, 7);
        ctx.closePath();
        ctx.fillStyle = s.bow.isAiming ? '#EF4444' : '#F97316';
        ctx.fill();
        ctx.restore();

        // ── Trajectory arc (only when aiming with tension) ──
        if (s.bow.isAiming && s.bow.tension > 0.15) {
          ctx.save();
          const speed = s.bow.tension * 34;
          let px = 0, py = 0;
          let pvx = Math.cos(s.bow.aimAngle) * speed;
          let pvy = Math.sin(s.bow.aimAngle) * speed;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          for (let i = 0; i < 30; i++) {
            px += pvx * 0.09;
            py += pvy * 0.09;
            pvy += 12 * 0.09; // gravity
            ctx.lineTo(px, py);
          }
          ctx.strokeStyle = 'rgba(239,68,68,0.45)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // ── Bow body (arc opens to the RIGHT along the aim angle) ──
        ctx.save();
        ctx.rotate(s.bow.aimAngle);
        // Bow limb arc — centered at origin, opens forward (+x direction)
        ctx.beginPath();
        ctx.arc(0, 0, 40, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#78350F';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bow string with pull-back
        const pullBack = s.bow.tension * 28;
        const topX = Math.cos(-Math.PI / 2.5) * 40;
        const topY = Math.sin(-Math.PI / 2.5) * 40;
        const botX = Math.cos(Math.PI / 2.5) * 40;
        const botY = Math.sin(Math.PI / 2.5) * 40;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(-pullBack, 0); // pull-back point
        ctx.lineTo(botX, botY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#1C1917';
        ctx.stroke();

        // Nock point (little circle where arrow rests)
        ctx.beginPath();
        ctx.arc(-pullBack, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#EF4444';
        ctx.fill();

        ctx.restore();

        // Bow center dot
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#292524';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FCD34D';
        ctx.fill();

        ctx.restore();
      }

      // Draw Arrows
      s.arrows.forEach((a) => {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);

        // Arrow Trail
        if (a.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.strokeStyle = a.isPierce ? '#A855F7' : 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        // Shaft
        ctx.beginPath();
        ctx.moveTo(-a.length, 0);
        ctx.lineTo(0, 0);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Arrow Head
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fillStyle = a.isPierce ? '#A855F7' : '#EF4444';
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      });

      // Draw Particle Effects
      s.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 2;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
      });
      s.particles = s.particles.filter((p) => p.life > 0);

      // Draw Floating Score Texts
      s.floatingTexts.forEach((ft) => {
        ft.y += ft.vy;
        ft.alpha -= dt;
        ctx.save();
        ctx.font = '900 20px sans-serif';
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });
      s.floatingTexts = s.floatingTexts.filter((ft) => ft.alpha > 0);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, spawnTarget, spawnPowerup]);

  // --- MOUSE & TOUCH EVENT HANDLERS ---
  const handlePointerDown = (e) => {
    if (gameState !== 'PLAYING') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    grabBow(x, y);
  };

  const handlePointerMove = (e) => {
    if (gameState !== 'PLAYING' || !stateRef.current.bow.isAiming) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    aimArrow(x, y);
  };

  const handlePointerUp = () => {
    if (gameState !== 'PLAYING') return;
    releaseArrow();
  };

  return (
    <div className="relative w-full h-screen bg-amber-50 font-sans select-none overflow-hidden flex flex-col">
      {/* --- TOP HUD OVERLAY --- */}
      <header className="absolute top-4 left-4 right-4 z-10 flex flex-wrap justify-between items-center gap-4 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Back to Home Button */}
          <button
            onClick={() => navigate('/')}
            className="bg-white hover:bg-yellow-300 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none px-3.5 py-2 rounded-xl text-xs font-mono font-black uppercase transition-all flex items-center gap-1.5"
            title="Back to Home"
          >
            <span>←</span> HOME
          </button>

          {/* Score Display */}
          <div className="bg-yellow-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl">
            <span className="text-xs font-black uppercase tracking-wider block text-black">Score</span>
            <span className="text-3xl font-black text-black">{score}</span>
          </div>

          {/* Combo Multiplier */}
          <div className="bg-pink-500 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl text-white">
            <span className="text-xs font-black uppercase tracking-wider block">Combo</span>
            <span className="text-3xl font-black">{combo}x</span>
          </div>

          {/* 3 Strikes / Misses counter */}
          <div className={`border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl text-white transition-all ${consecutiveMisses >= 2 ? 'bg-red-600 animate-pulse' : consecutiveMisses === 1 ? 'bg-amber-500' : 'bg-zinc-800'}`}>
            <span className="text-[10px] font-black uppercase tracking-wider block">Strikes (3=Over)</span>
            <span className="text-base font-black tracking-widest font-mono">
              {consecutiveMisses === 0 ? '⚪ ⚪ ⚪' :
               consecutiveMisses === 1 ? '❌ ⚪ ⚪' :
               consecutiveMisses === 2 ? '❌ ❌ ⚪' : '❌ ❌ ❌'}
            </span>
          </div>
        </div>

        {/* Live Gesture Detection Chip */}
        <div className="flex items-center gap-2 bg-white/95 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] px-3.5 py-1.5 rounded-xl pointer-events-auto">
          <span className={`w-2.5 h-2.5 rounded-full border border-black ${handTracked ? 'bg-neo-lime animate-pulse' : 'bg-zinc-400'}`} />
          <span className="text-xs font-mono font-bold text-zinc-600">GESTURE:</span>
          <span className="text-xs font-mono font-black uppercase text-black">
            {activeGesture === GESTURES.PINCH ? '🤏 Aiming Bow' :
             activeGesture === GESTURES.PAN ? '✊ Cancel Shot' :
             activeGesture === GESTURES.ROCK ? '🤟 Pause' :
             handTracked ? '✋ Hand Ready' : '🔍 Detect Hand'}
          </span>
        </div>

        {/* Active Powerup Banner */}
        {activePowerup && (
          <div className="bg-purple-500 text-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-6 py-2 rounded-xl font-black text-lg animate-bounce">
            ⚡ {activePowerup}: {powerupTimeLeft}s
          </div>
        )}

        {/* High Score */}
        <div className="bg-cyan-400 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-4 py-2 rounded-xl pointer-events-auto">
          <span className="text-xs font-black uppercase tracking-wider block text-black">High Score</span>
          <span className="text-3xl font-black text-black">{highScore}</span>
        </div>
      </header>

      {/* Hidden/Subtle Tracking Camera & Landmark Feeds */}
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

      {/* --- MAIN GAME CANVAS --- */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* --- BOTTOM CONTROLS & UI --- */}
      <footer className="absolute bottom-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => {
              const muted = !isMuted;
              setIsMuted(muted);
              soundManager.muted = muted;
            }}
            className="bg-white hover:bg-gray-100 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none p-3 rounded-xl font-black text-xl"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          {gameState === 'PLAYING' && (
            <button
              onClick={() => setGameState('PAUSED')}
              className="bg-orange-400 hover:bg-orange-500 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none px-6 py-3 rounded-xl font-black text-lg"
            >
              PAUSE
            </button>
          )}
          <button
            onClick={startGame}
            className="bg-green-400 hover:bg-green-500 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none px-6 py-3 rounded-xl font-black text-lg"
          >
            RESTART
          </button>
        </div>
      </footer>

      {/* --- START / OVERLAY MENU (NEO-BRUTALISM) --- */}
      {gameState !== 'PLAYING' && (
        <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center flex flex-col gap-5">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-black italic transform -rotate-2">
              ARCHERY<br />CHALLENGE
            </h1>

            {gameState === 'PAUSED' && (
              <p className="text-xl font-bold bg-yellow-300 border-2 border-black p-2 rounded-lg">
                GAME PAUSED
              </p>
            )}

            {gameState === 'GAMEOVER' && (
              <div className="bg-red-400 border-4 border-black p-4 rounded-xl text-white">
                <span className="block font-black text-xs uppercase tracking-widest text-red-100 mb-1">
                  {consecutiveMisses >= 3 ? '❌ 3 CONSECUTIVE MISSES!' : 'GAME OVER'}
                </span>
                <span className="block font-black text-sm uppercase tracking-wide">FINAL SCORE</span>
                <span className="text-4xl font-black">{score}</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (gameState === 'PAUSED') setGameState('PLAYING');
                  else startGame();
                }}
                className="w-full bg-green-400 hover:bg-green-500 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none py-4 rounded-2xl font-black text-2xl tracking-wide uppercase transition-all"
              >
                {gameState === 'PAUSED' ? 'RESUME' : 'PLAY NOW'}
              </button>
            </div>

            {/* Gesture Guide Table */}
            <div className="text-left bg-gray-100 border-3 border-black p-4 rounded-xl text-xs">
              <p className="font-display font-black text-sm mb-2 uppercase text-black">🎯 Hand Gesture Controls:</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 font-mono text-[11px] font-bold">
                <div className="flex items-center gap-1.5"><span className="text-sm">🤏</span> <span>Pinch:</span></div>
                <div className="text-zinc-800">Grab bowstring</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">✋</span> <span>Move Pinch:</span></div>
                <div className="text-zinc-800">Aim the bow</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">↩️</span> <span>Pull Back:</span></div>
                <div className="text-zinc-800">Increase power</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">🏹</span> <span>Release Pinch:</span></div>
                <div className="text-emerald-700">Shoot arrow!</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">✊</span> <span>Fist:</span></div>
                <div className="text-rose-700">Cancel shot</div>

                <div className="flex items-center gap-1.5"><span className="text-sm">🤟</span> <span>Rock Sign:</span></div>
                <div className="text-amber-700">Pause game</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}