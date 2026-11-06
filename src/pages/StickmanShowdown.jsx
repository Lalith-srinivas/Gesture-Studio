import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { useTrackSoloGame } from '../hooks/useTrackSoloGame';
import { stickmanAudio } from '../games/stickman/StickmanAudio';
import { KeyboardMouseInputProvider } from '../games/stickman/InputProviders';
import { StickmanRenderer } from '../games/stickman/StickmanRenderer';
import { ParticleSystem, checkPlatformCollision, lineIntersectsBox, GRAVITY, ARROW_BASE_SPEED } from '../games/stickman/StickmanPhysics';
import { CAMPAIGN_LEVELS, WEAPONS, ARROW_TYPES } from '../games/stickman/StickmanLevels';
import PostGameProgression from '../components/PostGameProgression';
import AdSlot from '../components/ads/AdSlot';

const SAVE_KEY = 'stickman_showdown_save_v1';
const HIGH_SCORE_KEY = 'stickman_showdown_highscore';

function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    coins: 600,
    maxLevelUnlocked: 1,
    levelStars: {},
    upgrades: {
      healthTier: 0,
      damageTier: 0,
      powerRegenTier: 0,
      armorTier: 0,
    },
    unlockedWeapons: ['bow'],
    unlockedArrows: ['standard'],
    activeWeapon: 'bow',
    activeArrow: 'standard',
  };
}

function saveUserData(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {}
}

export default function StickmanShowdown() {
  const navigate = useNavigate();
  const { recordGameResult, allGameStats } = usePlayer();

  const [gameState, setGameState] = useState('menu'); // 'menu' | 'level_select' | 'shop' | 'playing' | 'paused' | 'victory' | 'defeat'
  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [saveData, setSaveData] = useState(loadSaveData);

  // Player Stats for HUD
  const [playerHp, setPlayerHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [armPower, setArmPower] = useState(100);
  const [coinsDisplay, setCoinsDisplay] = useState(saveData.coins);
  const [killsDisplay, setKillsDisplay] = useState(0);
  const [headshotsDisplay, setHeadshotsDisplay] = useState(0);
  const [activeArrowId, setActiveArrowId] = useState(saveData.activeArrow);
  const [activeWeaponId, setActiveWeaponId] = useState(saveData.activeWeapon);

  // Boss state
  const [bossHp, setBossHp] = useState(null);
  const [bossMaxHp, setBossMaxHp] = useState(null);
  const [bossName, setBossName] = useState('');

  // End of level result
  const [levelStats, setLevelStats] = useState({ score: 0, coins: 0, kills: 0, headshots: 0 });
  const [lastProgressionResult, setLastProgressionResult] = useState(null);
  const sessionRecordedRef = useRef(false);

  useTrackSoloGame('Stickman Showdown', gameState === 'playing');

  // DOM Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(new ParticleSystem());
  const rafRef = useRef(null);

  // Internal Engine Game State (Mutable for 60fps loop)
  const engineRef = useRef({
    running: false,
    tick: 0,
    screenShake: 0,
    player: null,
    enemies: [],
    platforms: [],
    crates: [],
    arrows: [],
    enemyArrows: [],
    levelConfig: null,
    score: 0,
    coinsEarned: 0,
    kills: 0,
    headshots: 0,
  });

  // Calculate actual player stats based on upgrades
  const calculatePlayerStats = useCallback(() => {
    const healthBonus = (saveData.upgrades.healthTier || 0) * 25;
    const damageMult = 1 + (saveData.upgrades.damageTier || 0) * 0.2;
    const powerRegenMult = 1 + (saveData.upgrades.powerRegenTier || 0) * 0.25;
    const armorReduction = Math.min(0.5, (saveData.upgrades.armorTier || 0) * 0.1);
    return {
      maxHealth: 100 + healthBonus,
      damageMult,
      powerRegenMult,
      armorReduction,
    };
  }, [saveData.upgrades]);

  // ── Spawn Level Entities ──────────────────────────────────────────────────
  const setupLevel = useCallback((levelId) => {
    const config = CAMPAIGN_LEVELS.find((l) => l.id === levelId) || CAMPAIGN_LEVELS[0];
    const stats = calculatePlayerStats();
    const pSys = new ParticleSystem();
    particlesRef.current = pSys;

    const player = {
      x: config.playerStart.x,
      y: config.playerStart.y,
      vx: 0,
      vy: 0,
      width: 28,
      height: 82,
      hp: stats.maxHealth,
      maxHp: stats.maxHealth,
      armPower: 100,
      drawPower: 0,
      isDrawing: false,
      aimAngle: 0,
      facingRight: true,
      onGround: false,
      weapon: saveData.activeWeapon,
      arrowType: saveData.activeArrow,
      hitFlash: 0,
      color: '#f97316', // Orange warrior
      hasHelmet: saveData.upgrades.armorTier > 0,
    };

    const enemies = config.enemies.map((e) => ({
      ...e,
      vx: 0,
      vy: 0,
      width: (e.isBoss ? 42 : 28),
      height: (e.isBoss ? 120 : 82),
      hp: e.maxHp,
      drawPower: 0,
      isDrawing: false,
      aimAngle: Math.PI,
      facingRight: false,
      onGround: false,
      hitFlash: 0,
      aiCooldown: 30 + Math.floor(Math.random() * 45),
      patrolTimer: 0,
      dead: false,
    }));

    const crates = (config.crates || []).map((c) => ({
      ...c,
      hp: c.hp,
      destroyed: false,
    }));

    const allPlatforms = [
      ...config.platforms,
      ...(config.tntPlatforms || []),
    ];

    engineRef.current = {
      running: true,
      tick: 0,
      screenShake: 0,
      player,
      enemies,
      platforms: allPlatforms,
      crates,
      arrows: [],
      enemyArrows: [],
      levelConfig: config,
      score: 0,
      coinsEarned: 0,
      kills: 0,
      headshots: 0,
      damageMult: stats.damageMult,
      armorReduction: stats.armorReduction,
      powerRegenMult: stats.powerRegenMult,
    };

    setMaxHp(stats.maxHealth);
    setPlayerHp(stats.maxHealth);
    setArmPower(100);
    setKillsDisplay(0);
    setHeadshotsDisplay(0);

    const boss = enemies.find((e) => e.isBoss);
    if (boss) {
      setBossHp(boss.hp);
      setBossMaxHp(boss.maxHp);
      setBossName(boss.name);
    } else {
      setBossHp(null);
      setBossMaxHp(null);
      setBossName('');
    }
  }, [calculatePlayerStats, saveData.activeWeapon, saveData.activeArrow, saveData.upgrades.armorTier]);

  // ── Start Campaign Level ──────────────────────────────────────────────────
  const startLevel = useCallback((levelId) => {
    stickmanAudio.init();
    sessionRecordedRef.current = false;
    setCurrentLevelId(levelId);
    setupLevel(levelId);
    setGameState('playing');
  }, [setupLevel]);

  // ── Complete Level ────────────────────────────────────────────────────────
  const handleVictory = useCallback(() => {
    const eng = engineRef.current;
    eng.running = false;
    stickmanAudio.playVictory();

    const levelCoins = (eng.levelConfig?.coinReward || 500) + eng.coinsEarned;
    const finalScore = eng.score + eng.kills * 100 + eng.headshots * 150;

    setLevelStats({
      score: finalScore,
      coins: levelCoins,
      kills: eng.kills,
      headshots: eng.headshots,
    });

    // Update saved progression
    setSaveData((prev) => {
      const nextLevel = Math.max(prev.maxLevelUnlocked, currentLevelId + 1);
      const updatedStars = { ...prev.levelStars, [currentLevelId]: 3 };
      const updatedCoins = prev.coins + levelCoins;
      const nextSave = {
        ...prev,
        coins: updatedCoins,
        maxLevelUnlocked: nextLevel,
        levelStars: updatedStars,
      };
      saveUserData(nextSave);
      setCoinsDisplay(updatedCoins);
      return nextSave;
    });

    if (!sessionRecordedRef.current) {
      sessionRecordedRef.current = true;
      recordGameResult({
        gameId: 'stickman-showdown',
        score: finalScore,
        sessionId: `ss_${Date.now()}_${Math.random()}`,
      }).then((res) => {
        if (res) setLastProgressionResult(res);
      });
    }

    setGameState('victory');
  }, [currentLevelId, recordGameResult]);

  // ── Game Over / Defeat ────────────────────────────────────────────────────
  const handleDefeat = useCallback(() => {
    const eng = engineRef.current;
    eng.running = false;
    stickmanAudio.playDefeat();

    const finalScore = eng.score + eng.kills * 75;
    setLevelStats({
      score: finalScore,
      coins: eng.coinsEarned,
      kills: eng.kills,
      headshots: eng.headshots,
    });

    setSaveData((prev) => {
      const updatedCoins = prev.coins + eng.coinsEarned;
      const nextSave = { ...prev, coins: updatedCoins };
      saveUserData(nextSave);
      setCoinsDisplay(updatedCoins);
      return nextSave;
    });

    if (!sessionRecordedRef.current) {
      sessionRecordedRef.current = true;
      recordGameResult({
        gameId: 'stickman-showdown',
        score: finalScore,
        sessionId: `ss_${Date.now()}_${Math.random()}`,
      }).then((res) => {
        if (res) setLastProgressionResult(res);
      });
    }

    setGameState('defeat');
  }, [recordGameResult]);

  // ── Trigger Explosions (TNT Barrels & Explosive Arrows) ───────────────────
  const triggerExplosionAt = useCallback((ex, ey, blastRadius = 75, damage = 65) => {
    const eng = engineRef.current;
    stickmanAudio.playExplosion();
    eng.screenShake = 16;
    particlesRef.current.addExplosion(ex, ey, blastRadius);

    // Damage enemies in blast radius
    for (const enemy of eng.enemies) {
      if (enemy.dead) continue;
      const dist = Math.hypot((enemy.x + enemy.width / 2) - ex, (enemy.y + enemy.height / 2) - ey);
      if (dist < blastRadius) {
        const falloff = 1 - dist / blastRadius;
        const blastDmg = Math.round(damage * (0.5 + falloff * 0.5));
        enemy.hp -= blastDmg;
        enemy.hitFlash = 6;
        particlesRef.current.addDamageNumber(enemy.x + enemy.width / 2, enemy.y, blastDmg, true, '#ef4444');
      }
    }

    // Damage player if caught in blast
    const pDist = Math.hypot((eng.player.x + 14) - ex, (eng.player.y + 40) - ey);
    if (pDist < blastRadius) {
      const pDmg = Math.round(damage * (0.4 + (1 - pDist / blastRadius) * 0.4) * (1 - eng.armorReduction));
      eng.player.hp = Math.max(0, eng.player.hp - pDmg);
      eng.player.hitFlash = 6;
      particlesRef.current.addDamageNumber(eng.player.x + 14, eng.player.y, pDmg, false, '#ef4444');
      setPlayerHp(eng.player.hp);
      if (eng.player.hp <= 0) {
        handleDefeat();
      }
    }

    // Trigger chain explosions for nearby TNT crates
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
  }, [handleDefeat]);

  // ── Main Game Loop (60 FPS Canvas Physics & AI) ───────────────────────────
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;
    const ctx = canvas.getContext('2d');
    const eng = engineRef.current;

    if (!eng.running) return;

    const input = inputRef.current ? inputRef.current.getState() : { moveX: 0, jump: false, aimAngle: 0 };
    const p = eng.player;
    const pSys = particlesRef.current;

    // Handle Weapon & Arrow Switching from Keyboard / Buttons
    if (input.weaponIndex !== null && input.weaponIndex !== undefined) {
      const wp = WEAPONS[input.weaponIndex];
      if (wp && saveData.unlockedWeapons.includes(wp.id)) {
        p.weapon = wp.id;
        setActiveWeaponId(wp.id);
      }
    }

    if (input.arrowTypeIndex !== null && input.arrowTypeIndex !== undefined) {
      const arr = ARROW_TYPES[input.arrowTypeIndex];
      if (arr && saveData.unlockedArrows.includes(arr.id)) {
        p.arrowType = arr.id;
        setActiveArrowId(arr.id);
      }
    }

    // 1. Player Physics & Movement
    p.vx = input.moveX * 4.2;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY;

    if (input.moveX !== 0) {
      p.facingRight = input.moveX > 0;
    }

    // Platform collision
    p.onGround = checkPlatformCollision(p, eng.platforms);

    // Jump
    if (input.jump && p.onGround) {
      p.vy = -10.5;
      p.onGround = false;
    }

    // Arm Power Charging & Bowstring Drawing
    if (input.isDrawing) {
      p.isDrawing = true;
      p.aimAngle = input.aimAngle;
      p.drawPower = Math.min(1.0, p.drawPower + 0.038 * eng.powerRegenMult);
      stickmanAudio.playBowDraw(p.drawPower);
      setArmPower(Math.round(p.drawPower * 100));
    } else if (input.attackRelease && p.drawPower > 0.15) {
      // Loose Arrow!
      const power = p.drawPower;
      const angle = p.aimAngle;
      const speed = ARROW_BASE_SPEED * (0.45 + power * 0.75);
      const arrowDef = ARROW_TYPES.find((a) => a.id === p.arrowType) || ARROW_TYPES[0];

      stickmanAudio.playArrowRelease(power);

      eng.arrows.push({
        x: p.x + (p.facingRight ? 26 : -10),
        y: p.y + 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: angle,
        power,
        damage: Math.round(35 * eng.damageMult * arrowDef.damageMult * power),
        type: arrowDef.id,
        color: arrowDef.color,
        trailColor: arrowDef.trailColor,
        active: true,
      });

      p.drawPower = 0;
      p.isDrawing = false;
      setArmPower(0);
    } else {
      p.isDrawing = false;
      p.drawPower = 0;
    }

    // Update screen pos for input aiming center
    if (inputRef.current) {
      inputRef.current.setPlayerScreenPos(p.x + 14, p.y + 24);
    }

    // Screen bounds check
    p.x = Math.max(10, Math.min(canvas.width - p.width - 10, p.x));
    if (p.y > canvas.height + 100) {
      p.hp = 0;
      handleDefeat();
      return;
    }

    if (p.hitFlash > 0) p.hitFlash--;

    // 2. Enemy AI & Physics
    let allEnemiesDead = true;

    for (const enemy of eng.enemies) {
      if (enemy.dead) continue;
      allEnemiesDead = false;

      // Enemy physics
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;
      enemy.vy += GRAVITY;
      enemy.onGround = checkPlatformCollision(enemy, eng.platforms);

      // Facing towards player
      const dxToPlayer = (p.x + 14) - (enemy.x + enemy.width / 2);
      const dyToPlayer = (p.y + 24) - (enemy.y + enemy.height / 2);
      enemy.facingRight = dxToPlayer > 0;

      if (enemy.hitFlash > 0) enemy.hitFlash--;

      // AI Decision Cycle
      enemy.aiCooldown--;
      if (enemy.aiCooldown <= 0) {
        enemy.aiCooldown = enemy.isBoss ? 55 : (enemy.type === 'elite_archer' ? 65 : 85);

        if (enemy.type === 'warrior' || enemy.type === 'assassin') {
          // Rush towards player platform
          enemy.vx = (dxToPlayer > 0 ? 1 : -1) * (enemy.type === 'assassin' ? 4.2 : 2.8);
          if (Math.abs(dxToPlayer) < 55 && p.onGround) {
            // Melee Slash
            stickmanAudio.playMeleeSlash();
            const slashDmg = Math.round(25 * (1 - eng.armorReduction));
            p.hp = Math.max(0, p.hp - slashDmg);
            p.hitFlash = 6;
            pSys.addDamageNumber(p.x + 14, p.y, slashDmg, false, '#ef4444');
            setPlayerHp(p.hp);
            if (p.hp <= 0) {
              handleDefeat();
              return;
            }
          }
        } else {
          // Archer AI: Aim at player with ballistic arc prediction
          const dist = Math.hypot(dxToPlayer, dyToPlayer);
          const flightTime = dist / (ARROW_BASE_SPEED * 0.8);
          // Compensate for gravity drop
          const targetY = dyToPlayer - 0.5 * GRAVITY * (flightTime * flightTime);
          const aimAngle = Math.atan2(targetY, dxToPlayer) + (Math.random() - 0.5) * 0.08;
          enemy.aimAngle = aimAngle;

          // Loose enemy arrow!
          stickmanAudio.playArrowRelease(0.85);

          const arrowCount = enemy.isBoss ? 3 : 1;
          for (let s = 0; s < arrowCount; s++) {
            const spreadAngle = aimAngle + (s - (arrowCount - 1) / 2) * 0.14;
            eng.enemyArrows.push({
              x: enemy.x + (enemy.facingRight ? 26 : -10),
              y: enemy.y + 24,
              vx: Math.cos(spreadAngle) * ARROW_BASE_SPEED * 0.8,
              vy: Math.sin(spreadAngle) * ARROW_BASE_SPEED * 0.8,
              rotation: spreadAngle,
              damage: enemy.isBoss ? 26 : 18,
              type: enemy.isBoss ? 'fire' : 'standard',
              color: enemy.isBoss ? '#f97316' : '#a7f3d0',
              trailColor: enemy.isBoss ? '#ef4444' : '#34d399',
              active: true,
            });
          }
        }
      }

      // Check Enemy Death
      if (enemy.hp <= 0) {
        enemy.dead = true;
        pSys.addSpark(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, 24);
        pSys.dropCoins(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.isBoss ? 15 : 6);
        eng.kills++;
        setKillsDisplay(eng.kills);
      }

      // Update Boss HUD bar if this is boss
      if (enemy.isBoss) {
        setBossHp(Math.max(0, enemy.hp));
      }
    }

    // Check Level Victory
    if (allEnemiesDead && eng.enemies.length > 0) {
      handleVictory();
      return;
    }

    // 3. Player Arrows Update & Hit Detection
    for (let i = eng.arrows.length - 1; i >= 0; i--) {
      const a = eng.arrows[i];
      if (!a.active) continue;

      const prevX = a.x;
      const prevY = a.y;

      a.x += a.vx;
      a.y += a.vy;
      a.vy += GRAVITY;
      a.rotation = Math.atan2(a.vy, a.vx);

      // Trailing sparks
      if (eng.tick % 2 === 0) {
        pSys.addSpark(a.x, a.y, a.trailColor, 1);
      }

      let arrowConsumed = false;

      // Collision with Crates & TNT
      for (const crate of eng.crates) {
        if (crate.destroyed) continue;
        if (lineIntersectsBox(prevX, prevY, a.x, a.y, crate)) {
          crate.hp -= a.damage;
          arrowConsumed = true;
          pSys.addSpark(a.x, a.y, crate.type === 'tnt' ? '#facc15' : '#d97706', 8);

          if (crate.type === 'tnt' || crate.hp <= 0) {
            crate.destroyed = true;
            if (crate.type === 'tnt' || a.type === 'explosive') {
              triggerExplosionAt(crate.x + crate.width / 2, crate.y + crate.height / 2, 85, 75);
            }
          }
          break;
        }
      }

      if (arrowConsumed) {
        eng.arrows.splice(i, 1);
        continue;
      }

      // Collision with Enemies
      for (const enemy of eng.enemies) {
        if (enemy.dead) continue;

        const bodyBox = {
          x: enemy.x,
          y: enemy.y + 14,
          width: enemy.width,
          height: enemy.height - 14,
        };

        const headBox = {
          x: enemy.x + (enemy.width - 22) / 2,
          y: enemy.y - 12,
          width: 22,
          height: 24,
        };

        const hitHead = lineIntersectsBox(prevX, prevY, a.x, a.y, headBox);
        const hitBody = lineIntersectsBox(prevX, prevY, a.x, a.y, bodyBox);

        if (hitHead || hitBody) {
          const isCrit = hitHead;
          const damageDealt = isCrit ? Math.round(a.damage * 2.5) : a.damage;
          enemy.hp -= damageDealt;
          enemy.hitFlash = 6;
          eng.screenShake = isCrit ? 8 : 3;

          stickmanAudio.playHit(isCrit);
          pSys.addSpark(a.x, a.y, isCrit ? '#facc15' : '#ef4444', isCrit ? 16 : 8);

          if (isCrit) {
            eng.headshots++;
            setHeadshotsDisplay(eng.headshots);
            pSys.addDamageNumber(enemy.x + enemy.width / 2, enemy.y - 10, `HEADSHOT! -${damageDealt}`, true, '#facc15');
          } else {
            pSys.addDamageNumber(enemy.x + enemy.width / 2, enemy.y + 10, `-${damageDealt}`, false, '#ffffff');
          }

          // Special arrow effects
          if (a.type === 'explosive') {
            triggerExplosionAt(a.x, a.y, 80, 55);
          } else if (a.type === 'fire') {
            enemy.color = '#ea580c';
            pSys.addSpark(enemy.x + enemy.width / 2, enemy.y + 20, '#f97316', 12);
          }

          arrowConsumed = true;
          break;
        }
      }

      if (arrowConsumed) {
        eng.arrows.splice(i, 1);
        continue;
      }

      // Collision with Platforms (Arrows stick into ground)
      for (const plat of eng.platforms) {
        if (a.x >= plat.x && a.x <= plat.x + plat.width && a.y >= plat.y && a.y <= plat.y + 16) {
          a.active = false;
          pSys.addSpark(a.x, a.y, '#94a3b8', 5);
          if (a.type === 'explosive') {
            triggerExplosionAt(a.x, a.y, 75, 50);
          }
          break;
        }
      }

      // Out of bounds
      if (a.y > canvas.height + 40 || a.x < -40 || a.x > canvas.width + 40) {
        eng.arrows.splice(i, 1);
      }
    }

    // 4. Enemy Arrows Update & Player Collision
    for (let i = eng.enemyArrows.length - 1; i >= 0; i--) {
      const a = eng.enemyArrows[i];
      if (!a.active) continue;

      const prevX = a.x;
      const prevY = a.y;

      a.x += a.vx;
      a.y += a.vy;
      a.vy += GRAVITY;
      a.rotation = Math.atan2(a.vy, a.vx);

      let arrowConsumed = false;

      // Player collision check
      const pBox = { x: p.x, y: p.y, width: p.width, height: p.height };
      if (lineIntersectsBox(prevX, prevY, a.x, a.y, pBox)) {
        const damageTaken = Math.round(a.damage * (1 - eng.armorReduction));
        p.hp = Math.max(0, p.hp - damageTaken);
        p.hitFlash = 6;
        eng.screenShake = 6;

        stickmanAudio.playHit(false);
        pSys.addSpark(a.x, a.y, '#ef4444', 10);
        pSys.addDamageNumber(p.x + 14, p.y, `-${damageTaken}`, false, '#ef4444');
        setPlayerHp(p.hp);

        if (p.hp <= 0) {
          handleDefeat();
          return;
        }

        arrowConsumed = true;
      }

      // Platform collision
      if (!arrowConsumed) {
        for (const plat of eng.platforms) {
          if (a.x >= plat.x && a.x <= plat.x + plat.width && a.y >= plat.y && a.y <= plat.y + 16) {
            a.active = false;
            break;
          }
        }
      }

      if (arrowConsumed || a.y > canvas.height + 40 || a.x < -40 || a.x > canvas.width + 40) {
        eng.enemyArrows.splice(i, 1);
      }
    }

    // 5. Update Particles & Coins
    pSys.update(eng.platforms, p, (val) => {
      stickmanAudio.playCoin();
      eng.coinsEarned += val * 10;
      setCoinsDisplay((prev) => prev + val * 10);
    });

    // 6. RENDER SCENE
    ctx.save();

    // Screen Shake Offset
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

    // Aim trajectory dots while drawing bow
    if (p.isDrawing && p.drawPower > 0.1) {
      renderer.renderAimTrajectory(p.x + (p.facingRight ? 26 : -10), p.y + 24, p.aimAngle, p.drawPower);
    }

    // Render Enemies
    for (const enemy of eng.enemies) {
      if (!enemy.dead) {
        renderer.renderStickman(enemy, false, eng.tick);
      }
    }

    // Render Player
    renderer.renderStickman(p, true, eng.tick);

    // Render Projectiles & Visuals
    renderer.renderArrows([...eng.arrows, ...eng.enemyArrows]);
    renderer.renderParticles(pSys);

    ctx.restore();

    eng.tick++;
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [saveData.unlockedWeapons, saveData.unlockedArrows, triggerExplosionAt, handleDefeat, handleVictory]);

  // Canvas Resize Handler
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.min(window.innerWidth - 16, 960);
    const h = Math.min(window.innerHeight - 16, 540);
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Game Loop Initiation
  useEffect(() => {
    if (gameState === 'playing') {
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
  }, [gameState, gameLoop]);

  // Upgrade Purchase Action
  const buyUpgrade = (type, cost) => {
    if (saveData.coins < cost) return;
    stickmanAudio.playCoin();
    setSaveData((prev) => {
      const currentTier = prev.upgrades[type] || 0;
      const nextSave = {
        ...prev,
        coins: prev.coins - cost,
        upgrades: {
          ...prev.upgrades,
          [type]: currentTier + 1,
        },
      };
      saveUserData(nextSave);
      setCoinsDisplay(nextSave.coins);
      return nextSave;
    });
  };

  // Arrow Unlock Action
  const unlockArrow = (arrow) => {
    if (saveData.coins < arrow.price || saveData.unlockedArrows.includes(arrow.id)) return;
    stickmanAudio.playCoin();
    setSaveData((prev) => {
      const nextSave = {
        ...prev,
        coins: prev.coins - arrow.price,
        unlockedArrows: [...prev.unlockedArrows, arrow.id],
        activeArrow: arrow.id,
      };
      saveUserData(nextSave);
      setCoinsDisplay(nextSave.coins);
      setActiveArrowId(arrow.id);
      return nextSave;
    });
  };

  return (
    <div className="min-h-screen bg-[#040914] text-white flex flex-col items-center justify-center p-2 select-none font-sans relative overflow-hidden">
      
      {/* ── Active Game Arena (Landscape Canvas) ────────────────────────── */}
      <div ref={containerRef} className="relative border-4 border-[#1e293b] shadow-[0_0_35px_rgba(0,0,0,0.85)] bg-[#040914] rounded-lg overflow-hidden flex items-center justify-center max-w-[960px] w-full aspect-[16/9]">
        
        {/* Canvas */}
        <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

        {/* ── TOP HUD (Matches Reference Screenshot!) ──────────────────── */}
        {gameState === 'playing' && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-30 px-2 pt-1">
            
            {/* Left Controls: Back / Health / Arm Power */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGameState('paused')}
                className="pointer-events-auto w-9 h-9 bg-[#1e293b] hover:bg-[#334155] border-2 border-black flex items-center justify-center text-sm font-black shadow-neo-sm cursor-pointer active:scale-95 transition-transform"
                title="Pause Menu"
              >
                ◀
              </button>

              {/* Health Bar */}
              <div className="flex items-center gap-1.5 bg-black/60 border border-white/20 px-2.5 py-1 rounded">
                <span className="text-red-500 text-xs">❤️</span>
                <span className="font-mono text-[10px] font-black uppercase text-zinc-300">HEALTH</span>
                <div className="w-28 sm:w-36 h-3 bg-zinc-800 border border-black rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (playerHp / maxHp) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Arm Power Bar */}
              <div className="flex items-center gap-1.5 bg-black/60 border border-white/20 px-2.5 py-1 rounded">
                <span className="text-fuchsia-400 text-xs">⚡</span>
                <span className="font-mono text-[10px] font-black uppercase text-zinc-300">ARM POWER</span>
                <div className="w-24 sm:w-32 h-3 bg-zinc-800 border border-black rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-fuchsia-500 transition-all duration-75"
                    style={{ width: `${armPower}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Boss Health Bar (if active) */}
            {bossHp !== null && (
              <div className="absolute left-1/2 -translate-x-1/2 top-1 flex flex-col items-center">
                <span className="font-mono text-[10px] font-black uppercase tracking-wider text-red-400 mb-0.5">
                  👑 {bossName}
                </span>
                <div className="w-48 sm:w-64 h-3.5 bg-zinc-900 border-2 border-red-950 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Right Counters: Kills, Headshots, Coins */}
            <div className="flex items-center gap-3 bg-black/60 border border-white/20 px-3 py-1 rounded">
              <div className="flex items-center gap-1 text-xs font-mono font-bold">
                <span>💀</span>
                <span>{killsDisplay}</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-300">
                <span>🎯</span>
                <span>{headshotsDisplay}</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-yellow-400">
                <span>🪙</span>
                <span>{coinsDisplay.toLocaleString()}</span>
              </div>
            </div>

          </div>
        )}

        {/* ── BOTTOM ARROW SELECTOR (Matches Reference Screenshot!) ───── */}
        {gameState === 'playing' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-black/80 border border-white/20 rounded-lg pointer-events-auto shadow-2xl overflow-x-auto max-w-[94%]">
            {ARROW_TYPES.map((arr, idx) => {
              const isUnlocked = saveData.unlockedArrows.includes(arr.id);
              const isSelected = activeArrowId === arr.id;

              return (
                <button
                  key={arr.id}
                  onClick={() => {
                    if (isUnlocked) {
                      setActiveArrowId(arr.id);
                      if (engineRef.current.player) {
                        engineRef.current.player.arrowType = arr.id;
                      }
                    } else if (saveData.coins >= arr.price) {
                      unlockArrow(arr);
                    }
                  }}
                  className={`relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/20 scale-105 shadow-md'
                      : isUnlocked
                      ? 'border-white/20 bg-zinc-900/80 hover:bg-zinc-800'
                      : 'border-zinc-800 bg-black/60 opacity-60'
                  }`}
                  title={`${arr.name} ${!isUnlocked ? `(Unlock: ${arr.price} coins)` : ''}`}
                >
                  <span className="text-lg">{arr.icon}</span>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 rounded text-[8px] font-mono text-amber-300 font-bold">
                      <span>🔒</span>
                      <span>{arr.price}</span>
                    </div>
                  )}
                  {isUnlocked && (
                    <span className="absolute bottom-0 right-1 text-[8px] font-mono text-zinc-400">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── 1. MAIN MENU SCREEN ──────────────────────────────────────── */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-[#040914]/90 flex flex-col items-center justify-center p-6 z-40 backdrop-blur-sm">
            <button
              onClick={() => navigate('/')}
              className="absolute top-4 left-4 neo-btn-white px-3 py-1.5 text-xs font-mono font-black uppercase flex items-center gap-1.5"
            >
              ← HOME
            </button>

            <span className="px-3 py-1 bg-amber-400 text-black border-2 border-black font-mono font-black text-xs uppercase mb-3 shadow-neo-sm">
              🏹 2D ARCHERY & COMBAT
            </span>

            <h1 className="font-display font-black text-4xl sm:text-5xl uppercase tracking-tight text-white mb-2 drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]">
              STICKMAN SHOWDOWN
            </h1>
            <p className="font-mono text-xs text-zinc-400 mb-6 text-center max-w-md">
              Master weapons, loose glowing arrows across floating sky islands, and defeat rogue warrior waves!
            </p>

            <div className="flex flex-col gap-3 w-64">
              <button
                onClick={() => startLevel(saveData.maxLevelUnlocked || 1)}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-black font-display font-black text-lg uppercase tracking-wider border-3 border-black shadow-neo active:translate-y-0.5 cursor-pointer transition-all"
              >
                ▶ PLAY CAMPAIGN
              </button>

              <button
                onClick={() => setGameState('level_select')}
                className="w-full py-2.5 bg-white hover:bg-zinc-100 text-black font-mono font-black text-xs uppercase border-2 border-black shadow-neo-sm cursor-pointer transition-all"
              >
                🗺️ LEVEL SELECT
              </button>

              <button
                onClick={() => setGameState('shop')}
                className="w-full py-2.5 bg-[#818CF8] hover:bg-indigo-400 text-white font-mono font-black text-xs uppercase border-2 border-black shadow-neo-sm cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <span>⚔️</span>
                <span>ARMORY & UPGRADES ({coinsDisplay} 🪙)</span>
              </button>
            </div>

            {/* Controls Guide */}
            <div className="mt-8 flex gap-4 text-center font-mono text-[10px] text-zinc-400 bg-white/5 border border-white/10 px-4 py-2 rounded">
              <div><strong className="text-white">A / D:</strong> Move</div>
              <div><strong className="text-white">W / Space:</strong> Jump</div>
              <div><strong className="text-white">Mouse:</strong> Aim</div>
              <div><strong className="text-white">Hold Left Click:</strong> Draw Bow</div>
              <div><strong className="text-white">1–5:</strong> Switch Arrow</div>
            </div>
          </div>
        )}

        {/* ── 2. LEVEL SELECTION SCREEN ────────────────────────────────── */}
        {gameState === 'level_select' && (
          <div className="absolute inset-0 bg-[#040914]/95 flex flex-col items-center justify-center p-6 z-40">
            <button
              onClick={() => setGameState('menu')}
              className="absolute top-4 left-4 neo-btn-white px-3 py-1.5 text-xs font-mono font-black uppercase"
            >
              ← BACK
            </button>

            <h2 className="font-display font-black text-3xl uppercase text-white mb-1">
              CAMPAIGN CHAPTERS
            </h2>
            <p className="font-mono text-xs text-zinc-400 mb-6">Select a floating arena to battle</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl max-h-[70vh] overflow-y-auto p-2">
              {CAMPAIGN_LEVELS.map((lvl) => {
                const isUnlocked = lvl.id <= saveData.maxLevelUnlocked;
                const stars = saveData.levelStars[lvl.id] || 0;

                return (
                  <button
                    key={lvl.id}
                    disabled={!isUnlocked}
                    onClick={() => startLevel(lvl.id)}
                    className={`p-4 border-2 flex flex-col items-start justify-between text-left transition-all ${
                      isUnlocked
                        ? 'bg-zinc-900 border-amber-400 shadow-neo-sm hover:-translate-y-1 cursor-pointer'
                        : 'bg-black/40 border-zinc-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-mono text-[10px] font-black text-amber-400 uppercase">
                          LEVEL {lvl.id}
                        </span>
                        {isUnlocked && (
                          <span className="text-xs">{stars > 0 ? '⭐⭐⭐' : 'NEW'}</span>
                        )}
                      </div>
                      <h3 className="font-display font-black text-sm text-white uppercase">{lvl.title}</h3>
                      <p className="font-mono text-[10px] text-zinc-400 mt-1 line-clamp-2">{lvl.subtitle}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between w-full pt-2 border-t border-white/10 font-mono text-[10px] text-zinc-300">
                      <span>Reward: 🪙 {lvl.coinReward}</span>
                      <span>{isUnlocked ? 'RACE ➔' : '🔒 LOCKED'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 3. ARMORY & UPGRADES SCREEN ─────────────────────────────── */}
        {gameState === 'shop' && (
          <div className="absolute inset-0 bg-[#040914]/95 flex flex-col items-center justify-center p-6 z-40 overflow-y-auto">
            <button
              onClick={() => setGameState('menu')}
              className="absolute top-4 left-4 neo-btn-white px-3 py-1.5 text-xs font-mono font-black uppercase"
            >
              ← BACK
            </button>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display font-black text-3xl uppercase text-white">WARRIOR ARMORY</h2>
              <span className="bg-amber-400 text-black px-2 py-0.5 font-mono font-black text-xs rounded">
                🪙 {coinsDisplay} COINS
              </span>
            </div>
            <p className="font-mono text-xs text-zinc-400 mb-5">Upgrade stats and unlock special combat arrows</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full max-h-[65vh] overflow-y-auto p-1">
              {/* Max Health Upgrade */}
              <div className="p-3 bg-zinc-900 border border-white/20 rounded flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-sm uppercase text-red-400">❤️ Max Health</div>
                  <p className="font-mono text-[10px] text-zinc-400">Tier {saveData.upgrades.healthTier || 0} (+25 HP)</p>
                </div>
                <button
                  onClick={() => buyUpgrade('healthTier', 500 * ((saveData.upgrades.healthTier || 0) + 1))}
                  disabled={coinsDisplay < 500 * ((saveData.upgrades.healthTier || 0) + 1)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-mono font-black text-xs uppercase border border-black rounded disabled:opacity-40"
                >
                  UPGRADE ({500 * ((saveData.upgrades.healthTier || 0) + 1)} 🪙)
                </button>
              </div>

              {/* Bow Damage Upgrade */}
              <div className="p-3 bg-zinc-900 border border-white/20 rounded flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-sm uppercase text-amber-400">🏹 Bow Damage</div>
                  <p className="font-mono text-[10px] text-zinc-400">Tier {saveData.upgrades.damageTier || 0} (+20% Dmg)</p>
                </div>
                <button
                  onClick={() => buyUpgrade('damageTier', 600 * ((saveData.upgrades.damageTier || 0) + 1))}
                  disabled={coinsDisplay < 600 * ((saveData.upgrades.damageTier || 0) + 1)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-mono font-black text-xs uppercase border border-black rounded disabled:opacity-40"
                >
                  UPGRADE ({600 * ((saveData.upgrades.damageTier || 0) + 1)} 🪙)
                </button>
              </div>

              {/* Armor Upgrade */}
              <div className="p-3 bg-zinc-900 border border-white/20 rounded flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-sm uppercase text-sky-400">🛡️ Warrior Armor</div>
                  <p className="font-mono text-[10px] text-zinc-400">Tier {saveData.upgrades.armorTier || 0} (-10% damage)</p>
                </div>
                <button
                  onClick={() => buyUpgrade('armorTier', 750 * ((saveData.upgrades.armorTier || 0) + 1))}
                  disabled={coinsDisplay < 750 * ((saveData.upgrades.armorTier || 0) + 1)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-mono font-black text-xs uppercase border border-black rounded disabled:opacity-40"
                >
                  UPGRADE ({750 * ((saveData.upgrades.armorTier || 0) + 1)} 🪙)
                </button>
              </div>

              {/* Power Draw Speed */}
              <div className="p-3 bg-zinc-900 border border-white/20 rounded flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-sm uppercase text-fuchsia-400">⚡ Arm Power Regen</div>
                  <p className="font-mono text-[10px] text-zinc-400">Draws bowstring 25% faster</p>
                </div>
                <button
                  onClick={() => buyUpgrade('powerRegenTier', 600 * ((saveData.upgrades.powerRegenTier || 0) + 1))}
                  disabled={coinsDisplay < 600 * ((saveData.upgrades.powerRegenTier || 0) + 1)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-mono font-black text-xs uppercase border border-black rounded disabled:opacity-40"
                >
                  UPGRADE ({600 * ((saveData.upgrades.powerRegenTier || 0) + 1)} 🪙)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. PAUSE MODAL ───────────────────────────────────────────── */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-40 backdrop-blur-xs">
            <div className="neo-box-lg bg-[#FFFDF5] p-6 text-center max-w-xs w-full text-black">
              <h2 className="font-display font-black text-2xl uppercase mb-2">GAME PAUSED</h2>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => setGameState('playing')}
                  className="py-2.5 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  ▶ RESUME
                </button>
                <button
                  onClick={() => startLevel(currentLevelId)}
                  className="py-2.5 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  ↺ RESTART LEVEL
                </button>
                <button
                  onClick={() => setGameState('menu')}
                  className="py-2.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. VICTORY MODAL ─────────────────────────────────────────── */}
        {gameState === 'victory' && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-40 backdrop-blur-xs">
            <div className="neo-box-xl bg-[#FFFDF5] p-6 text-center max-w-sm w-full text-black animate-in zoom-in-95">
              <div className="inline-block px-4 py-1.5 bg-neo-lime border-3 border-black font-display font-black text-2xl uppercase mb-3 shadow-neo">
                🏆 VICTORY!
              </div>

              <h3 className="font-display font-black text-xl uppercase mb-1">
                Level {currentLevelId} Cleared!
              </h3>
              <p className="font-mono text-xs text-zinc-600 mb-4">All enemies defeated across the sky islands.</p>

              <div className="grid grid-cols-2 gap-2 bg-zinc-100 border-2 border-black p-3 font-mono text-xs font-bold mb-4">
                <div>💀 Kills: {levelStats.kills}</div>
                <div>🎯 Headshots: {levelStats.headshots}</div>
                <div className="col-span-2 text-amber-600 font-black">
                  🪙 +{levelStats.coins} COINS EARNED
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {currentLevelId < CAMPAIGN_LEVELS.length ? (
                  <button
                    onClick={() => startLevel(currentLevelId + 1)}
                    className="w-full py-3 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo cursor-pointer"
                  >
                    NEXT LEVEL ➔
                  </button>
                ) : (
                  <div className="p-2 bg-amber-100 border border-black font-mono text-xs font-black text-amber-800">
                    👑 CONGRATULATIONS! You completed all campaign chapters!
                  </div>
                )}

                <button
                  onClick={() => startLevel(currentLevelId)}
                  className="w-full py-2 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  ↺ REPLAY LEVEL
                </button>

                <button
                  onClick={() => setGameState('menu')}
                  className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. DEFEAT MODAL ──────────────────────────────────────────── */}
        {gameState === 'defeat' && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-40 backdrop-blur-xs">
            <div className="neo-box-xl bg-[#FFFDF5] p-6 text-center max-w-sm w-full text-black animate-in zoom-in-95">
              <div className="inline-block px-4 py-1.5 bg-neo-red text-white border-3 border-black font-display font-black text-2xl uppercase mb-3 shadow-neo">
                💀 DEFEATED
              </div>

              <h3 className="font-display font-black text-xl uppercase mb-1">
                You fell in battle
              </h3>
              <p className="font-mono text-xs text-zinc-600 mb-4">
                Upgrade your armor & bow in the Armory to take on tougher enemies!
              </p>

              <div className="w-full shrink-0 mb-3">
                <PostGameProgression result={lastProgressionResult} />
              </div>

              <div className="w-full my-2 flex justify-center shrink-0">
                <AdSlot placement="game-over" format="banner" className="max-w-[280px] sm:max-w-[340px] max-h-[55px] sm:max-h-[90px]" />
              </div>

              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  onClick={() => startLevel(currentLevelId)}
                  className="w-full py-3 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo cursor-pointer"
                >
                  ↺ TRY AGAIN
                </button>

                <button
                  onClick={() => setGameState('shop')}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  ⚔️ OPEN ARMORY & UPGRADES
                </button>

                <button
                  onClick={() => setGameState('menu')}
                  className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm cursor-pointer"
                >
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

