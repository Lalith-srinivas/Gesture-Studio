import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import { useMultiplayer } from '../context/MultiplayerContext';
import { stickmanAudio } from '../games/stickman/StickmanAudio';
import { KeyboardMouseInputProvider } from '../games/stickman/InputProviders';
import { DualHandDetector } from '../games/stickman/DualHandDetector';
import { StickmanRenderer } from '../games/stickman/StickmanRenderer';
import { ParticleSystem, checkPlatformCollision, GRAVITY, ARROW_BASE_SPEED } from '../games/stickman/StickmanPhysics';
import { MULTIPLAYER_ARENA, ARROW_TYPES } from '../games/stickman/StickmanLevels';
import MultiplayerLobbyModal from '../components/multiplayer/MultiplayerLobbyModal';
import MultiplayerResultModal from '../components/multiplayer/MultiplayerResultModal';

const MAX_HP = 150;
const MATCH_DURATION_SEC = 90;

export default function StickmanShowdown() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { playerData } = usePlayer();

  const {
    matchState,
    opponent,
    opponentExtra,
    opponentGraceTimer,
    sendScore,
    submitFinalScore,
    leaveRoom,
    resetState: resetMultiplayerState,
  } = useMultiplayer();

  // Screen, Mobile & Fullscreen States
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLobbyModal, setShowLobbyModal] = useState(true);

  // Match Hud States
  const [myHp, setMyHp] = useState(MAX_HP);
  const [oppHp, setOppHp] = useState(MAX_HP);
  const [matchTimeLeft, setMatchTimeLeft] = useState(MATCH_DURATION_SEC);
  const [countdownSec, setCountdownSec] = useState(null);

  // AI Webcam Gesture States
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [showPip, setShowPip] = useState(true);
  const [leftGestureStatus, setLeftGestureStatus] = useState('Neutral');
  const [rightGestureStatus, setRightGestureStatus] = useState('Idle');

  // Active arrow selection
  const [currentArrowIdx, setCurrentArrowIdx] = useState(0);

  // References
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(new ParticleSystem());
  const rafRef = useRef(null);
  const matchTimerRef = useRef(null);
  const matchFinishedRef = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const lastProcessedOpponentArrowIdRef = useRef(null);

  // Camera & MediaPipe Refs
  const videoRef = useRef(null);
  const pipCanvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const dualHandDetectorRef = useRef(new DualHandDetector());
  const cameraActiveRef = useRef(false);

  // Engine state (mutable for 60fps loop)
  const engineRef = useRef({
    running: false,
    tick: 0,
    screenShake: 0,
    isPlayer1: true,
    player: null,
    opponentChar: null,
    platforms: [],
    crates: [],
    myArrows: [],
    oppArrows: [],
    score: 0,
    myHp: MAX_HP,
    oppHp: MAX_HP,
    pendingArrowShot: null,
  });

  // ── 1. Orientation & Mobile Detection ──────────────────────────────────────
  const checkOrientation = useCallback(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 820;
    const isPortraitMode = window.innerHeight > window.innerWidth;
    setIsMobileDevice(isMobile);
    setIsPortrait(isMobile && isPortraitMode);
    setIsFullscreen(Boolean(document.fullscreenElement));
  }, []);

  useEffect(() => {
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    document.addEventListener('fullscreenchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      document.removeEventListener('fullscreenchange', checkOrientation);
    };
  }, [checkOrientation]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const elem = containerRef.current || document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch {}
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  // ── 2. Determine Player Roles & Spawns ──────────────────────────────────────
  const isPlayer1 = React.useMemo(() => {
    const myUid = currentUser?.uid || playerData?.uid || 'user_local';
    const oppUid = opponent?.uid || 'user_remote';
    return myUid <= oppUid;
  }, [currentUser?.uid, playerData?.uid, opponent?.uid]);

  // ── 3. Initialize Multiplayer Arena Match ─────────────────────────────────
  const initArenaMatch = useCallback(() => {
    stickmanAudio.init();
    matchFinishedRef.current = false;
    lastProcessedOpponentArrowIdRef.current = null;

    const arena = MULTIPLAYER_ARENA;
    const pSys = new ParticleSystem();
    particlesRef.current = pSys;

    const mySpawn = isPlayer1 ? arena.player1Start : arena.player2Start;
    const oppSpawn = isPlayer1 ? arena.player2Start : arena.player1Start;

    const localPlayer = {
      x: mySpawn.x,
      y: mySpawn.y,
      vx: 0,
      vy: 0,
      width: 28,
      height: 82,
      hp: MAX_HP,
      maxHp: MAX_HP,
      drawPower: 0,
      isDrawing: false,
      aimAngle: isPlayer1 ? 0 : Math.PI,
      facingRight: isPlayer1,
      onGround: true,
      color: isPlayer1 ? '#f97316' : '#06b6d4',
      hitFlash: 0,
      specialActive: 0,
    };

    const opponentChar = {
      x: oppSpawn.x,
      y: oppSpawn.y,
      vx: 0,
      vy: 0,
      width: 28,
      height: 82,
      hp: MAX_HP,
      maxHp: MAX_HP,
      drawPower: 0,
      isDrawing: false,
      aimAngle: isPlayer1 ? Math.PI : 0,
      facingRight: !isPlayer1,
      onGround: true,
      color: isPlayer1 ? '#06b6d4' : '#f97316',
      hitFlash: 0,
      specialActive: 0,
    };

    const crates = arena.crates.map((c) => ({ ...c, hp: c.hp, destroyed: false }));

    const snapToPlatform = (char) => {
      for (const plat of arena.platforms) {
        if (char.x + char.width * 0.8 > plat.x && char.x + char.width * 0.2 < plat.x + plat.width) {
          char.y = plat.y - char.height;
          char.vy = 0;
          char.onGround = true;
          char.currentPlatform = plat;
          return;
        }
      }
    };

    snapToPlatform(localPlayer);
    snapToPlatform(opponentChar);

    engineRef.current = {
      running: true,
      tick: 0,
      screenShake: 0,
      isPlayer1,
      player: localPlayer,
      opponentChar,
      platforms: arena.platforms,
      crates,
      myArrows: [],
      oppArrows: [],
      score: 0,
      myHp: MAX_HP,
      oppHp: MAX_HP,
      pendingArrowShot: null,
    };

    setMyHp(MAX_HP);
    setOppHp(MAX_HP);
    setMatchTimeLeft(MATCH_DURATION_SEC);
  }, [isPlayer1]);

  // ── 4. Trigger Explosions (TNT & Explosive Arrows) ─────────────────────────
  const triggerExplosionAt = useCallback((ex, ey, blastRadius = 75, damage = 55) => {
    const eng = engineRef.current;
    stickmanAudio.playExplosion();
    eng.screenShake = 16;
    particlesRef.current.addExplosion(ex, ey, blastRadius);

    // Damage local player
    const pDist = Math.hypot((eng.player.x + 14) - ex, (eng.player.y + 40) - ey);
    if (pDist < blastRadius) {
      const pDmg = Math.round(damage * (0.5 + (1 - pDist / blastRadius) * 0.5));
      eng.player.hp = Math.max(0, eng.player.hp - pDmg);
      eng.player.hitFlash = 8;
      eng.myHp = eng.player.hp;
      setMyHp(eng.player.hp);
      particlesRef.current.addDamageNumber(eng.player.x + 14, eng.player.y, pDmg, true, '#ef4444');
    }

    // Damage opponent
    const oppDist = Math.hypot((eng.opponentChar.x + 14) - ex, (eng.opponentChar.y + 40) - ey);
    if (oppDist < blastRadius) {
      const oppDmg = Math.round(damage * (0.5 + (1 - oppDist / blastRadius) * 0.5));
      eng.opponentChar.hp = Math.max(0, eng.opponentChar.hp - oppDmg);
      eng.opponentChar.hitFlash = 8;
      eng.oppHp = eng.opponentChar.hp;
      setOppHp(eng.opponentChar.hp);
      particlesRef.current.addDamageNumber(eng.opponentChar.x + 14, eng.opponentChar.y, oppDmg, true, '#facc15');
      eng.score += oppDmg * 10;
    }

    // Chain explosions for nearby TNT
    for (const crate of eng.crates) {
      if (crate.destroyed || crate.type !== 'tnt') continue;
      const cDist = Math.hypot((crate.x + crate.width / 2) - ex, (crate.y + crate.height / 2) - ey);
      if (cDist < blastRadius && cDist > 5) {
        crate.destroyed = true;
        setTimeout(() => {
          triggerExplosionAt(crate.x + crate.width / 2, crate.y + crate.height / 2, blastRadius, damage);
        }, 120);
      }
    }
  }, []);

  // ── 5. End Match / Submit Final Scores ─────────────────────────────────────
  const finishMatch = useCallback((reason = 'knocked_out') => {
    if (matchFinishedRef.current) return;
    matchFinishedRef.current = true;
    const eng = engineRef.current;
    eng.running = false;

    if (matchTimerRef.current) clearInterval(matchTimerRef.current);

    const isWinner = eng.myHp > eng.oppHp;
    if (isWinner) {
      stickmanAudio.playVictory();
    } else {
      stickmanAudio.playDefeat();
    }

    submitFinalScore(eng.score, reason);
  }, [submitFinalScore]);

  // ── 6. Handle Match State Transitions & Fix Stuck "GO!" ────────────────────
  useEffect(() => {
    if (matchState === 'COUNTDOWN') {
      setShowLobbyModal(false);
      setCountdownSec(3);
      initArenaMatch();

      const t1 = setTimeout(() => setCountdownSec(2), 1000);
      const t2 = setTimeout(() => setCountdownSec(1), 2000);
      const t3 = setTimeout(() => setCountdownSec('GO!'), 2900);
      const t4 = setTimeout(() => setCountdownSec(null), 3600);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    } else if (matchState === 'PLAYING') {
      // Immediately clear any leftover countdown overlay so "GO!" never stays stuck
      setCountdownSec(null);
      setShowLobbyModal(false);

      if (!engineRef.current.running) {
        initArenaMatch();
      }

      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      matchTimerRef.current = setInterval(() => {
        setMatchTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(matchTimerRef.current);
            finishMatch('time_expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      };
    } else if (matchState === 'FINISHED') {
      setCountdownSec(null);
      engineRef.current.running = false;
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    } else if (matchState === 'IDLE') {
      setCountdownSec(null);
      setShowLobbyModal(true);
      engineRef.current.running = false;
    }
  }, [matchState, initArenaMatch, finishMatch]);

  // ── 7. MediaPipe Dual-Hand Webcam Tracking Setup ───────────────────────────
  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) return;
    if (typeof window.Hands !== 'function' || typeof window.Camera !== 'function') {
      console.warn('[StickmanShowdown] MediaPipe not loaded yet.');
      return;
    }

    cameraActiveRef.current = true;

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2, // Dual-hand tracking!
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    hands.onResults((results) => {
      if (!cameraActiveRef.current) return;
      setCameraReady(true);

      const pipCanvas = pipCanvasRef.current;
      const video = videoRef.current;

      // Draw skeleton to PIP window
      if (pipCanvas && video) {
        if (pipCanvas.width !== video.videoWidth || pipCanvas.height !== video.videoHeight) {
          pipCanvas.width = video.videoWidth || 320;
          pipCanvas.height = video.videoHeight || 240;
        }
        const ctx = pipCanvas.getContext('2d');
        ctx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);

        // Draw camera frame with mirror
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -pipCanvas.width, 0, pipCanvas.width, pipCanvas.height);
        ctx.restore();

        // Draw landmarks
        if (results.multiHandLandmarks) {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-pipCanvas.width, 0);

          for (const lms of results.multiHandLandmarks) {
            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            for (let i = 0; i < lms.length; i++) {
              ctx.beginPath();
              ctx.arc(lms[i].x * pipCanvas.width, lms[i].y * pipCanvas.height, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }

      // Process Dual-Hand Gestures
      const playerFacing = engineRef.current.player?.facingRight ?? true;
      const gestures = dualHandDetectorRef.current.process(results.multiHandLandmarks, playerFacing);

      if (inputRef.current) {
        inputRef.current.setGestureState({
          moveX: gestures.moveX,
          jump: gestures.jump,
          aimAngle: gestures.aimAngle,
          isDrawing: gestures.isDrawing,
          attackRelease: gestures.attackRelease,
          meleeAttack: gestures.meleeAttack,
          specialAbility: gestures.specialAbility,
          switchArrow: gestures.switchArrow,
        });
      }

      // Update gesture badges for visual feedback
      if (gestures.leftHandDetected) {
        if (gestures.leftGesture === 'THUMBS_UP') setLeftGestureStatus('👍 Special Power!');
        else if (gestures.leftGesture === 'VICTORY') setLeftGestureStatus('✌️ Switch Arrow');
        else if (gestures.leftGesture === 'FIST') setLeftGestureStatus('✊ Melee Attack');
        else if (gestures.moveX < 0) setLeftGestureStatus('⬅️ Move Left');
        else if (gestures.moveX > 0) setLeftGestureStatus('➡️ Move Right');
        else setLeftGestureStatus('✋ Open Palm (Stop)');
      } else {
        setLeftGestureStatus('Left Hand: Searching...');
      }

      if (gestures.rightHandDetected) {
        if (gestures.isDrawing) setLeftGestureStatus((prev) => prev); // keep
        setRightGestureStatus(gestures.isDrawing ? '🤏 Drawing Bow!' : '📐 Aiming');
      } else {
        setRightGestureStatus('Right Hand: Searching...');
      }

      // Cycle arrow if victory sign detected
      if (gestures.switchArrow) {
        setCurrentArrowIdx((prev) => (prev + 1) % ARROW_TYPES.length);
        stickmanAudio.playCoin();
      }
    });

    handsRef.current = hands;

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (!cameraActiveRef.current || !videoRef.current || !handsRef.current) return;
        try {
          await handsRef.current.send({ image: videoRef.current });
        } catch (e) {}
      },
      width: 480,
      height: 360,
    });

    camera.start().catch((err) => {
      console.warn('[StickmanShowdown] Camera start failed:', err);
      setCameraReady(false);
    });

    cameraRef.current = camera;

    return () => {
      cameraActiveRef.current = false;
      try { cameraRef.current?.stop(); } catch (e) {}
      try { handsRef.current?.close(); } catch (e) {}
    };
  }, [cameraEnabled]);

  // ── 8. Handle Incoming Opponent Sync Payload ───────────────────────────────
  useEffect(() => {
    if (!opponentExtra || !engineRef.current.running) return;
    const eng = engineRef.current;
    const opp = eng.opponentChar;
    if (!opp) return;

    opp.x = opp.x + (opponentExtra.x - opp.x) * 0.65;
    opp.y = opp.y + (opponentExtra.y - opp.y) * 0.65;
    opp.vx = opponentExtra.vx || 0;
    opp.vy = opponentExtra.vy || 0;
    opp.facingRight = opponentExtra.facingRight;
    opp.aimAngle = opponentExtra.aimAngle;
    opp.isDrawing = opponentExtra.isDrawing;
    opp.drawPower = opponentExtra.drawPower;

    if (typeof opponentExtra.hp === 'number') {
      opp.hp = opponentExtra.hp;
      eng.oppHp = opponentExtra.hp;
      setOppHp(opponentExtra.hp);
    }

    if (opponentExtra.arrowShot && opponentExtra.arrowShot.id !== lastProcessedOpponentArrowIdRef.current) {
      lastProcessedOpponentArrowIdRef.current = opponentExtra.arrowShot.id;
      const shot = opponentExtra.arrowShot;
      stickmanAudio.playArrowRelease(shot.power || 0.8);

      eng.oppArrows.push({
        id: shot.id,
        x: shot.x,
        y: shot.y,
        vx: shot.vx,
        vy: shot.vy,
        rotation: shot.rotation,
        power: shot.power || 0.8,
        damage: shot.damage || 35,
        type: shot.type || 'standard',
        color: '#06b6d4',
        trailColor: '#38bdf8',
        active: true,
      });
    }
  }, [opponentExtra]);

  // ── 9. Main 60 FPS Arena Physics & Render Loop ─────────────────────────────
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;
    const ctx = canvas.getContext('2d');
    const eng = engineRef.current;

    if (!eng.running) return;

    const input = inputRef.current ? inputRef.current.getState() : { moveX: 0, jump: false, aimAngle: 0 };
    const p = eng.player;
    const opp = eng.opponentChar;
    const pSys = particlesRef.current;

    // Special Ability Trigger (e.g. from Thumbs Up 👍 or Q)
    if (input.specialAbility && p.specialActive <= 0) {
      p.specialActive = 180; // 3 seconds speed & shield boost
      stickmanAudio.playBowDraw(1.0);
      pSys.addSpark(p.x + 14, p.y + 40, '#facc15', 24);
    }
    if (p.specialActive > 0) p.specialActive--;

    // Melee Attack (from Closed Fist ✊)
    if (input.meleeAttack) {
      const distToOpp = Math.hypot((p.x + 14) - (opp.x + 14), (p.y + 40) - (opp.y + 40));
      stickmanAudio.playMeleeSlash();
      pSys.addSpark(p.x + (p.facingRight ? 35 : -15), p.y + 35, '#f97316', 12);
      if (distToOpp < 65) {
        opp.hp = Math.max(0, opp.hp - 25);
        opp.hitFlash = 8;
        eng.oppHp = opp.hp;
        setOppHp(opp.hp);
        pSys.addDamageNumber(opp.x + 14, opp.y, '-25', false, '#f97316');
        eng.score += 250;
        if (opp.hp <= 0) {
          finishMatch('opponent_eliminated');
          return;
        }
      }
    }

    // 1. Local Player Movement & Physics
    const speedMult = p.specialActive > 0 ? 1.35 : 1.0;
    p.vx = input.moveX * 4.2 * speedMult;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY;

    if (input.moveX !== 0) {
      p.facingRight = input.moveX > 0;
    }

    p.onGround = checkPlatformCollision(p, eng.platforms);

    if (input.jump && p.onGround) {
      p.vy = -10.5;
      p.onGround = false;
    }

    // Aim & Bow Draw Mechanics
    if (input.isDrawing) {
      p.isDrawing = true;
      p.aimAngle = input.aimAngle;
      p.drawPower = Math.min(1.0, p.drawPower + 0.04);
      stickmanAudio.playBowDraw(p.drawPower);
    } else if (input.attackRelease && p.drawPower > 0.15) {
      const power = p.drawPower;
      const angle = p.aimAngle;
      const speed = ARROW_BASE_SPEED * (0.5 + power * 0.7);
      stickmanAudio.playArrowRelease(power);

      const arrowId = `arr_${currentUser?.uid || 'p1'}_${Date.now()}_${Math.random()}`;
      const spawnX = p.x + (p.facingRight ? 26 : -10);
      const spawnY = p.y + 24;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const activeArrowDef = ARROW_TYPES[currentArrowIdx] || ARROW_TYPES[0];

      const newArrow = {
        id: arrowId,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        rotation: angle,
        power,
        damage: Math.round(35 * power * activeArrowDef.damageMult),
        type: activeArrowDef.id,
        color: activeArrowDef.color,
        trailColor: activeArrowDef.trailColor,
        active: true,
      };

      eng.myArrows.push(newArrow);
      eng.pendingArrowShot = {
        id: arrowId,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        rotation: angle,
        power,
        damage: newArrow.damage,
        type: activeArrowDef.id,
      };

      p.drawPower = 0;
      p.isDrawing = false;
    } else {
      p.isDrawing = false;
      p.drawPower = 0;
    }

    if (inputRef.current) {
      inputRef.current.setPlayerScreenPos(p.x + 14, p.y + 24);
    }

    p.x = Math.max(15, Math.min(canvas.width - p.width - 15, p.x));
    if (p.y > canvas.height + 60) {
      p.hp = 0;
      eng.myHp = 0;
      setMyHp(0);
      finishMatch('fell_off_arena');
      return;
    }

    if (p.hitFlash > 0) p.hitFlash--;
    if (opp.hitFlash > 0) opp.hitFlash--;

    // 2. Update My Arrows -> Check Collision with Opponent & Crates
    for (let i = eng.myArrows.length - 1; i >= 0; i--) {
      const a = eng.myArrows[i];
      if (!a.active) continue;

      a.x += a.vx;
      a.y += a.vy;
      a.vy += GRAVITY * 0.65;
      a.rotation = Math.atan2(a.vy, a.vx);

      let arrowConsumed = false;

      // Hit Opponent?
      const oppHitbox = { x: opp.x, y: opp.y, width: opp.width, height: opp.height };
      if (a.x >= oppHitbox.x && a.x <= oppHitbox.x + oppHitbox.width &&
          a.y >= oppHitbox.y && a.y <= oppHitbox.y + oppHitbox.height) {
        
        const isHeadshot = a.y <= opp.y + 24;
        const damageDealt = isHeadshot ? Math.round(a.damage * 2.2) : a.damage;

        opp.hp = Math.max(0, opp.hp - damageDealt);
        opp.hitFlash = 8;
        eng.oppHp = opp.hp;
        setOppHp(opp.hp);
        eng.score += isHeadshot ? damageDealt * 15 : damageDealt * 10;

        stickmanAudio.playHit(isHeadshot);
        pSys.addSpark(a.x, a.y, '#facc15', isHeadshot ? 18 : 10);
        pSys.addDamageNumber(opp.x + 14, opp.y, `-${damageDealt}`, isHeadshot, isHeadshot ? '#facc15' : '#ffffff');

        if (a.type === 'explosive') {
          triggerExplosionAt(a.x, a.y, 75, 45);
        }

        arrowConsumed = true;

        if (opp.hp <= 0) {
          finishMatch('opponent_eliminated');
          return;
        }
      }

      // Hit Destructible Crates / TNT?
      if (!arrowConsumed) {
        for (const crate of eng.crates) {
          if (crate.destroyed) continue;
          if (a.x >= crate.x && a.x <= crate.x + crate.width &&
              a.y >= crate.y && a.y <= crate.y + crate.height) {
            crate.hp -= a.damage;
            pSys.addSpark(a.x, a.y, '#d97706', 8);
            if (crate.hp <= 0) {
              crate.destroyed = true;
              if (crate.type === 'tnt') {
                triggerExplosionAt(crate.x + crate.width / 2, crate.y + crate.height / 2, 85, 60);
              }
            }
            arrowConsumed = true;
            break;
          }
        }
      }

      // Hit Platform surface?
      if (!arrowConsumed) {
        for (const plat of eng.platforms) {
          if (a.x >= plat.x && a.x <= plat.x + plat.width && a.y >= plat.y && a.y <= plat.y + 16) {
            a.active = false;
            break;
          }
        }
      }

      if (arrowConsumed || a.y > canvas.height + 40 || a.x < -40 || a.x > canvas.width + 40) {
        eng.myArrows.splice(i, 1);
      }
    }

    // 3. Update Opponent Arrows -> Check Collision with Local Player & Crates
    for (let i = eng.oppArrows.length - 1; i >= 0; i--) {
      const a = eng.oppArrows[i];
      if (!a.active) continue;

      a.x += a.vx;
      a.y += a.vy;
      a.vy += GRAVITY * 0.65;
      a.rotation = Math.atan2(a.vy, a.vx);

      let arrowConsumed = false;

      // Hit Local Player?
      const pHitbox = { x: p.x, y: p.y, width: p.width, height: p.height };
      if (a.x >= pHitbox.x && a.x <= pHitbox.x + pHitbox.width &&
          a.y >= pHitbox.y && a.y <= pHitbox.y + pHitbox.height) {
        
        const isHeadshot = a.y <= p.y + 24;
        let damageTaken = isHeadshot ? Math.round(a.damage * 2.2) : a.damage;
        if (p.specialActive > 0) damageTaken = Math.round(damageTaken * 0.5); // 50% shield

        p.hp = Math.max(0, p.hp - damageTaken);
        p.hitFlash = 8;
        eng.myHp = p.hp;
        setMyHp(p.hp);
        eng.screenShake = isHeadshot ? 12 : 6;

        stickmanAudio.playHit(isHeadshot);
        pSys.addSpark(a.x, a.y, '#ef4444', isHeadshot ? 18 : 10);
        pSys.addDamageNumber(p.x + 14, p.y, `-${damageTaken}`, isHeadshot, '#ef4444');

        if (a.type === 'explosive') {
          triggerExplosionAt(a.x, a.y, 75, 45);
        }

        arrowConsumed = true;

        if (p.hp <= 0) {
          finishMatch('knocked_out');
          return;
        }
      }

      // Hit Destructible Crates / TNT?
      if (!arrowConsumed) {
        for (const crate of eng.crates) {
          if (crate.destroyed) continue;
          if (a.x >= crate.x && a.x <= crate.x + crate.width &&
              a.y >= crate.y && a.y <= crate.y + crate.height) {
            crate.hp -= a.damage;
            pSys.addSpark(a.x, a.y, '#d97706', 8);
            if (crate.hp <= 0) {
              crate.destroyed = true;
              if (crate.type === 'tnt') {
                triggerExplosionAt(crate.x + crate.width / 2, crate.y + crate.height / 2, 85, 60);
              }
            }
            arrowConsumed = true;
            break;
          }
        }
      }

      // Hit Platform surface?
      if (!arrowConsumed) {
        for (const plat of eng.platforms) {
          if (a.x >= plat.x && a.x <= plat.x + plat.width && a.y >= plat.y && a.y <= plat.y + 16) {
            a.active = false;
            break;
          }
        }
      }

      if (arrowConsumed || a.y > canvas.height + 40 || a.x < -40 || a.x > canvas.width + 40) {
        eng.oppArrows.splice(i, 1);
      }
    }

    // 4. Send Real-Time Network State via WebSocket (~20 Hz)
    const now = Date.now();
    if (now - lastSyncTimeRef.current >= 50) {
      lastSyncTimeRef.current = now;
      const payload = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Number(p.vx.toFixed(2)),
        vy: Number(p.vy.toFixed(2)),
        facingRight: p.facingRight,
        aimAngle: Number(p.aimAngle.toFixed(3)),
        isDrawing: p.isDrawing,
        drawPower: Number(p.drawPower.toFixed(2)),
        hp: p.hp,
        arrowShot: eng.pendingArrowShot,
      };
      eng.pendingArrowShot = null;
      sendScore(eng.score, payload);
    }

    // 5. Update Particles
    pSys.update(eng.platforms, p);

    // 6. RENDER SCENE
    ctx.save();

    if (eng.screenShake > 0) {
      const sx = (Math.random() - 0.5) * eng.screenShake;
      const sy = (Math.random() - 0.5) * eng.screenShake;
      ctx.translate(sx, sy);
      eng.screenShake *= 0.88;
      if (eng.screenShake < 0.5) eng.screenShake = 0;
    }

    const renderer = rendererRef.current;
    renderer.renderBackdrop(canvas.width, canvas.height, eng.tick);
    renderer.renderPlatforms(eng.platforms);
    renderer.renderCrates(eng.crates);

    // Aim trajectory line while drawing bow
    if (p.isDrawing && p.drawPower > 0.1) {
      renderer.renderAimTrajectory(p.x + (p.facingRight ? 26 : -10), p.y + 24, p.aimAngle, p.drawPower);
    }

    // Render Both Players
    renderer.renderStickman(opp, false, eng.tick);
    renderer.renderStickman(p, true, eng.tick);

    // Render Projectiles
    renderer.renderArrows([...eng.myArrows, ...eng.oppArrows]);
    renderer.renderParticles(pSys);

    ctx.restore();

    eng.tick++;
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [currentUser?.uid, currentArrowIdx, sendScore, triggerExplosionAt, finishMatch]);

  // Canvas Resize Handler
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 960;
    canvas.height = 540;
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Start Loop
  useEffect(() => {
    if (matchState === 'PLAYING') {
      const canvas = canvasRef.current;
      if (canvas) {
        rendererRef.current = new StickmanRenderer(canvas);
        inputRef.current = new KeyboardMouseInputProvider(canvas);
      }
      rafRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (inputRef.current) {
        inputRef.current.destroy();
        inputRef.current = null;
      }
    };
  }, [matchState, gameLoop]);

  // Mobile Virtual Button Handlers
  const handleTouchMoveStart = (dir) => {
    if (inputRef.current) inputRef.current.setVirtualInput({ moveX: dir, jump: false });
  };
  const handleTouchMoveEnd = () => {
    if (inputRef.current) inputRef.current.setVirtualInput({ moveX: 0, jump: false });
  };
  const handleTouchJump = () => {
    if (inputRef.current) inputRef.current.setVirtualInput({ moveX: 0, jump: true });
    setTimeout(() => {
      if (inputRef.current) inputRef.current.setVirtualInput({ moveX: 0, jump: false });
    }, 150);
  };

  return (
    <div className="min-h-screen bg-[#040914] text-white flex flex-col items-center justify-center p-1 sm:p-2 select-none font-sans relative overflow-hidden">

      {/* Hidden Webcam Video for MediaPipe Hand Tracking */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* ── Mobile Orientation Rotate Screen Blocker ───────────────────── */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-[#040914] flex flex-col items-center justify-center p-6 text-center select-none text-white animate-in fade-in">
          <div className="w-20 h-20 mb-4 animate-bounce text-6xl flex items-center justify-center">
            📱🔄
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-wider text-neo-yellow mb-2">
            ROTATE YOUR PHONE
          </h2>
          <p className="font-mono text-xs sm:text-sm text-zinc-300 max-w-xs mb-6">
            Stickman Showdown 1v1 Arena is designed for widescreen landscape combat. Please turn your phone horizontally.
          </p>
          <button
            onClick={toggleFullscreen}
            className="px-6 py-3 bg-neo-lime hover:bg-lime-400 text-black border-3 border-black font-display font-black text-sm uppercase shadow-neo active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            ⛶ ENTER FULLSCREEN & PLAY
          </button>
        </div>
      )}

      {/* ── Multiplayer Matchmaking & Lobby Modal ───────────────────────── */}
      <MultiplayerLobbyModal
        isOpen={showLobbyModal && matchState !== 'PLAYING' && matchState !== 'COUNTDOWN'}
        onClose={() => navigate('/')}
        gameId="stickman-showdown"
        gameTitle="Stickman Showdown"
      />

      {/* ── Multiplayer Result Modal ────────────────────────────────────── */}
      <MultiplayerResultModal
        isOpen={matchState === 'FINISHED'}
        onReturnToLobby={() => {
          resetMultiplayerState();
          setShowLobbyModal(true);
        }}
      />

      {/* ── Active Game Arena (Landscape Canvas) ────────────────────────── */}
      <div
        ref={containerRef}
        className={`relative border-2 sm:border-4 border-[#1e293b] shadow-[0_0_35px_rgba(0,0,0,0.85)] bg-[#040914] rounded-lg overflow-hidden flex items-center justify-center w-full max-w-[960px] aspect-[16/9] ${
          isFullscreen ? 'w-screen h-screen max-w-none max-h-none rounded-none border-none' : ''
        }`}
      >
        {/* Canvas */}
        <canvas ref={canvasRef} width={960} height={540} className="block w-full h-full cursor-crosshair touch-none" />

        {/* ── Top Match VS HUD ─────────────────────────────────────────── */}
        {matchState === 'PLAYING' && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-30 px-2 pt-1">
            
            {/* Player 1 Health */}
            <div className="flex items-center gap-2 bg-black/75 border-2 border-black p-1.5 shadow-neo-sm">
              <span className="text-xl">🏹</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-xs uppercase text-amber-400">
                    {isPlayer1 ? (playerData?.username || 'You') : (opponent?.username || 'Opponent')}
                  </span>
                  {isPlayer1 && <span className="bg-neo-lime border border-black text-[9px] font-mono font-black px-1 text-black">YOU</span>}
                </div>
                <div className="w-24 sm:w-36 h-2.5 bg-zinc-800 border border-black rounded-xs overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, ((isPlayer1 ? myHp : oppHp) / MAX_HP) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Center Timer & Match Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="bg-neo-yellow border-2 sm:border-3 border-black px-3 py-1 text-black font-display font-black text-sm sm:text-base shadow-neo-sm">
                ⏱️ {matchTimeLeft}s
              </div>
              
              {/* Webcam Gestures Toggle */}
              <button
                onClick={() => setCameraEnabled((prev) => !prev)}
                className={`px-2 py-1 border-2 border-black font-mono font-black text-[10px] sm:text-xs uppercase shadow-neo-sm cursor-pointer transition-transform active:scale-95 ${
                  cameraEnabled ? 'bg-[#86EFAC] text-black' : 'bg-zinc-700 text-zinc-300'
                }`}
                title={cameraEnabled ? 'AI Gestures Active' : 'Camera Disabled'}
              >
                {cameraEnabled ? '📷 GESTURES ON' : '📷 GESTURES OFF'}
              </button>

              <button
                onClick={toggleFullscreen}
                className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 border-2 border-black flex items-center justify-center text-xs font-mono font-black shadow-neo-sm cursor-pointer text-white"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? '🗗' : '⛶'}
              </button>

              <button
                onClick={() => {
                  leaveRoom();
                  resetMultiplayerState();
                  setShowLobbyModal(true);
                }}
                className="w-8 h-8 bg-red-600 hover:bg-red-500 border-2 border-black flex items-center justify-center text-xs font-mono font-black shadow-neo-sm cursor-pointer text-white"
                title="Leave Match"
              >
                ✕
              </button>
            </div>

            {/* Player 2 Health */}
            <div className="flex items-center gap-2 bg-black/75 border-2 border-black p-1.5 shadow-neo-sm text-right">
              <div>
                <div className="flex items-center justify-end gap-1.5">
                  {!isPlayer1 && <span className="bg-neo-lime border border-black text-[9px] font-mono font-black px-1 text-black">YOU</span>}
                  <span className="font-mono font-black text-xs uppercase text-cyan-400">
                    {!isPlayer1 ? (playerData?.username || 'You') : (opponent?.username || 'Opponent')}
                  </span>
                </div>
                <div className="w-24 sm:w-36 h-2.5 bg-zinc-800 border border-black rounded-xs overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, ((!isPlayer1 ? myHp : oppHp) / MAX_HP) * 100))}%` }}
                  />
                </div>
              </div>
              <span className="text-xl">🎯</span>
            </div>

          </div>
        )}

        {/* ── 3-2-1-GO Countdown Overlay (ONLY visible during COUNTDOWN state) ─ */}
        {matchState === 'COUNTDOWN' && countdownSec !== null && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none">
            <div className="font-display font-black text-7xl sm:text-9xl text-neo-yellow drop-shadow-[5px_5px_0px_#000000] animate-pulse">
              {countdownSec}
            </div>
          </div>
        )}

        {/* ── Opponent Disconnect Grace Timer Banner ─────────────────────── */}
        {opponentGraceTimer?.active && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white border-2 border-black px-4 py-2 font-mono font-black text-xs uppercase shadow-neo animate-bounce">
            ⚠️ {opponentGraceTimer.message} ({opponentGraceTimer.secondsRemaining}s)
          </div>
        )}

        {/* ── Webcam PIP & Live Gesture HUD ──────────────────────────────── */}
        {cameraEnabled && matchState === 'PLAYING' && showPip && (
          <div className="absolute top-14 right-2 z-30 pointer-events-auto bg-black/80 border-2 border-black p-1 rounded shadow-neo-sm flex flex-col items-center">
            <canvas ref={pipCanvasRef} width={140} height={105} className="w-28 sm:w-32 h-auto border border-white/20 rounded-xs block bg-zinc-950" />
            <div className="w-full flex justify-between items-center text-[9px] font-mono font-black text-zinc-300 mt-1 px-1">
              <span>{cameraReady ? '🟢 DUAL-HAND' : '🟡 CAMERA'}</span>
              <button onClick={() => setShowPip(false)} className="text-zinc-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="w-full text-[8px] font-mono text-amber-300 px-1 truncate">
              L: {leftGestureStatus}
            </div>
            <div className="w-full text-[8px] font-mono text-cyan-300 px-1 truncate">
              R: {rightGestureStatus}
            </div>
          </div>
        )}

        {/* ── Mobile Virtual On-Screen Touch Controls ─────────────────────── */}
        {matchState === 'PLAYING' && (
          <div className="absolute inset-x-2 bottom-2 z-30 pointer-events-none flex justify-between items-end">
            
            {/* Left Touch Pad (Move Left, Move Right, Jump) */}
            <div className="flex items-center gap-1.5 pointer-events-auto select-none">
              <button
                onTouchStart={() => handleTouchMoveStart(-1)}
                onTouchEnd={handleTouchMoveEnd}
                onMouseDown={() => handleTouchMoveStart(-1)}
                onMouseUp={handleTouchMoveEnd}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-black/75 hover:bg-black text-white border-2 border-black font-display font-black text-xl flex items-center justify-center rounded shadow-neo active:scale-95 cursor-pointer touch-none"
              >
                ◀
              </button>
              <button
                onTouchStart={() => handleTouchMoveStart(1)}
                onTouchEnd={handleTouchMoveEnd}
                onMouseDown={() => handleTouchMoveStart(1)}
                onMouseUp={handleTouchMoveEnd}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-black/75 hover:bg-black text-white border-2 border-black font-display font-black text-xl flex items-center justify-center rounded shadow-neo active:scale-95 cursor-pointer touch-none"
              >
                ▶
              </button>
              <button
                onTouchStart={handleTouchJump}
                onMouseDown={handleTouchJump}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-500 hover:bg-amber-400 text-black border-2 border-black font-display font-black text-xl flex items-center justify-center rounded shadow-neo active:scale-95 cursor-pointer touch-none ml-1"
                title="Jump"
              >
                ▲
              </button>
            </div>

            {/* Right Touch Pad (Quick Arrow Selector & Hint) */}
            <div className="flex flex-col items-end gap-1 pointer-events-auto select-none">
              <div className="flex items-center gap-1 bg-black/70 border border-white/20 p-1 rounded text-[9px] font-mono text-zinc-300">
                <span className="text-zinc-400">TOUCH CANVAS TO AIM & SHOOT</span>
                <span className="text-amber-400 font-black">🏹 {ARROW_TYPES[currentArrowIdx]?.name}</span>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
