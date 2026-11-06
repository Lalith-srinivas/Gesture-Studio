/**
 * StickmanLevels — Campaign level definitions for Stickman Showdown
 * Floating platforms, destructible crates, explosive TNT barrels, and enemy squad setups.
 */

export const WEAPONS = [
  { id: 'bow', name: 'Recurve Bow', icon: '🏹', type: 'ranged', damage: 35, unlocked: true, price: 0, desc: 'Classic long-range weapon with charged trajectory.' },
  { id: 'sword', name: 'Shadow Katana', icon: '⚔️', type: 'melee', damage: 45, unlocked: false, price: 1500, desc: 'Quick melee slashes that can deflect incoming arrows.' },
  { id: 'spear', name: 'Dragon Spear', icon: '🔱', type: 'melee', damage: 55, unlocked: false, price: 2500, desc: 'Extended range piercing thrust with heavy knockback.' },
  { id: 'axe', name: 'Battle Axe', icon: '🪓', type: 'melee', damage: 70, unlocked: false, price: 3500, desc: 'Heavy crushing cleave that pulverizes obstacles.' },
  { id: 'crossbow', name: 'Repeater Crossbow', icon: '🎯', type: 'ranged', damage: 28, unlocked: false, price: 5000, desc: 'Rapid dual-bolt firing with flat high-speed trajectory.' },
];

export const ARROW_TYPES = [
  { id: 'standard', name: 'Iron Arrow', icon: '➡️', color: '#f8fafc', trailColor: '#94a3b8', damageMult: 1.0, unlocked: true, price: 0, desc: 'Standard sharp arrow with high velocity.' },
  { id: 'fire', name: 'Fire Arrow', icon: '🔥', color: '#f97316', trailColor: '#ea580c', damageMult: 1.3, burnDamage: 10, unlocked: false, price: 1000, desc: 'Ignites targets on fire and burns wooden blocks.' },
  { id: 'explosive', name: 'Explosive Arrow', icon: '💥', color: '#ef4444', trailColor: '#dc2626', damageMult: 1.8, blastRadius: 85, unlocked: false, price: 2000, desc: 'Explodes violently on impact with massive AoE damage.' },
  { id: 'ice', name: 'Ice Frost Arrow', icon: '❄️', color: '#38bdf8', trailColor: '#0284c7', damageMult: 1.1, slowDuration: 4000, unlocked: false, price: 1800, desc: 'Freezes enemies and reduces movement speed by 60%.' },
  { id: 'lightning', name: 'Lightning Arrow', icon: '⚡', color: '#facc15', trailColor: '#eab308', damageMult: 1.5, chainRange: 120, unlocked: false, price: 2800, desc: 'Emits a blinding electric bolt that shocks nearby enemies.' },
  { id: 'poison', name: 'Poison Arrow', icon: '🧪', color: '#4ade80', trailColor: '#16a34a', damageMult: 1.2, poisonDot: 8, unlocked: false, price: 2200, desc: 'Inflicts toxic rot that drains enemy life over time.' },
];

export const CAMPAIGN_LEVELS = [
  {
    id: 1,
    title: 'Level 1: Archery Training',
    subtitle: 'Learn bow mechanics & hit your first rogue target',
    targetScore: 200,
    coinReward: 400,
    playerStart: { x: 120, y: 380 },
    platforms: [
      // Left player ledge
      { x: 50, y: 440, width: 220, height: 40, type: 'island' },
      // Target platform
      { x: 620, y: 420, width: 200, height: 40, type: 'island' },
    ],
    crates: [
      // Stack of destructible wooden boxes (matches screenshot)
      { x: 420, y: 380, width: 36, height: 36, type: 'wood', hp: 30 },
      { x: 420, y: 344, width: 36, height: 36, type: 'wood', hp: 30 },
      { x: 420, y: 308, width: 36, height: 36, type: 'tnt', hp: 15 },
    ],
    tntPlatforms: [
      { x: 380, y: 416, width: 110, height: 26, type: 'floating' },
    ],
    enemies: [
      { id: 'e1', type: 'archer', x: 720, y: 360, maxHp: 60, name: 'Trainee Archer', color: '#22c55e' },
    ],
  },
  {
    id: 2,
    title: 'Level 2: Mountain Outpost',
    subtitle: 'Dodge enemy arrows and snipe cross-platform enemies',
    targetScore: 450,
    coinReward: 650,
    playerStart: { x: 100, y: 380 },
    platforms: [
      { x: 40, y: 440, width: 200, height: 40, type: 'island' },
      { x: 380, y: 340, width: 150, height: 30, type: 'floating' },
      { x: 680, y: 430, width: 220, height: 40, type: 'island' },
      { x: 730, y: 260, width: 140, height: 26, type: 'floating' },
    ],
    crates: [
      { x: 395, y: 304, width: 36, height: 36, type: 'wood', hp: 30 },
      { x: 435, y: 304, width: 36, height: 36, type: 'tnt', hp: 15 },
      { x: 750, y: 394, width: 36, height: 36, type: 'wood', hp: 30 },
    ],
    enemies: [
      { id: 'e1', type: 'archer', x: 460, y: 280, maxHp: 75, name: 'Outpost Archer', color: '#22c55e' },
      { id: 'e2', type: 'elite_archer', x: 780, y: 200, maxHp: 90, name: 'Sentry Sniper', color: '#10b981' },
    ],
  },
  {
    id: 3,
    title: 'Level 3: Chasm Ambush',
    subtitle: 'Sword warriors rush your platform while archers cover them',
    targetScore: 700,
    coinReward: 900,
    playerStart: { x: 100, y: 380 },
    platforms: [
      { x: 40, y: 440, width: 260, height: 40, type: 'island' },
      { x: 360, y: 450, width: 180, height: 35, type: 'island' },
      { x: 640, y: 390, width: 250, height: 40, type: 'island' },
      { x: 400, y: 240, width: 130, height: 25, type: 'floating' },
    ],
    crates: [
      { x: 430, y: 204, width: 36, height: 36, type: 'tnt', hp: 15 },
      { x: 700, y: 354, width: 36, height: 36, type: 'wood', hp: 30 },
      { x: 700, y: 318, width: 36, height: 36, type: 'wood', hp: 30 },
    ],
    enemies: [
      { id: 'e1', type: 'warrior', x: 440, y: 390, maxHp: 95, name: 'Blade Runner', color: '#f59e0b' },
      { id: 'e2', type: 'archer', x: 720, y: 330, maxHp: 80, name: 'Cliff Scout', color: '#22c55e' },
      { id: 'e3', type: 'assassin', x: 800, y: 330, maxHp: 70, name: 'Night Stalker', color: '#a855f7' },
    ],
  },
  {
    id: 4,
    title: 'Level 4: Fortress Bastion',
    subtitle: 'Heavily armored bruisers with explosive hazards',
    targetScore: 1100,
    coinReward: 1400,
    playerStart: { x: 90, y: 380 },
    platforms: [
      { x: 30, y: 440, width: 220, height: 40, type: 'island' },
      { x: 310, y: 370, width: 140, height: 30, type: 'floating' },
      { x: 520, y: 460, width: 180, height: 35, type: 'island' },
      { x: 740, y: 380, width: 220, height: 40, type: 'island' },
      { x: 600, y: 220, width: 150, height: 26, type: 'floating' },
    ],
    crates: [
      { x: 340, y: 334, width: 36, height: 36, type: 'tnt', hp: 15 },
      { x: 570, y: 424, width: 36, height: 36, type: 'wood', hp: 30 },
      { x: 570, y: 388, width: 36, height: 36, type: 'tnt', hp: 15 },
      { x: 800, y: 344, width: 36, height: 36, type: 'wood', hp: 30 },
    ],
    enemies: [
      { id: 'e1', type: 'heavy', x: 590, y: 400, maxHp: 160, name: 'Iron Guard', color: '#ef4444' },
      { id: 'e2', type: 'assassin', x: 370, y: 310, maxHp: 85, name: 'Shadow Assassin', color: '#a855f7' },
      { id: 'e3', type: 'elite_archer', x: 840, y: 320, maxHp: 110, name: 'Bastion Sniper', color: '#10b981' },
      { id: 'e4', type: 'archer', x: 670, y: 160, maxHp: 85, name: 'Tower Archer', color: '#22c55e' },
    ],
  },
  {
    id: 5,
    title: 'Level 5: The Shadow Warlord',
    subtitle: 'BOSS BATTLE — Defeat the Titan Warlord across the sky ruins',
    targetScore: 2000,
    coinReward: 2500,
    playerStart: { x: 100, y: 380 },
    platforms: [
      { x: 40, y: 440, width: 240, height: 40, type: 'island' },
      { x: 350, y: 320, width: 130, height: 26, type: 'floating' },
      { x: 540, y: 430, width: 360, height: 50, type: 'island' },
      { x: 680, y: 240, width: 160, height: 28, type: 'floating' },
    ],
    crates: [
      { x: 380, y: 284, width: 36, height: 36, type: 'tnt', hp: 15 },
      { x: 600, y: 394, width: 36, height: 36, type: 'tnt', hp: 15 },
      { x: 640, y: 394, width: 36, height: 36, type: 'wood', hp: 30 },
      { x: 740, y: 204, width: 36, height: 36, type: 'wood', hp: 30 },
    ],
    enemies: [
      {
        id: 'boss',
        type: 'boss',
        isBoss: true,
        x: 750,
        y: 330,
        maxHp: 480,
        name: 'SHADOW WARLORD',
        color: '#dc2626',
        scale: 1.6,
      },
      { id: 'e1', type: 'archer', x: 400, y: 260, maxHp: 80, name: 'Minion Scout', color: '#22c55e' },
      { id: 'e2', type: 'assassin', x: 620, y: 370, maxHp: 80, name: 'Minion Assassin', color: '#a855f7' },
    ],
  },
];
