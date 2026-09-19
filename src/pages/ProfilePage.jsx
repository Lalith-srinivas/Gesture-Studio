/**
 * ProfilePage — Full player profile with stats, achievements, settings.
 * Tabs: PROFILE | ACHIEVEMENTS | SETTINGS (via ?tab= query param)
 */
import React, { useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '../firebase/firebase';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../hooks/usePlayer';
import XPBar from '../components/XPBar';
import DailyRewardModal from '../components/DailyRewardModal';
import AuthModal from '../components/AuthModal';
import { useGestureAcademy } from '../hooks/useGestureAcademy';
import { ACHIEVEMENTS, getAchievementProgress } from '../services/achievementService';
import { getWeeklyStreakVisualization } from '../services/streakService';
import { GAME_LABELS } from '../services/gameStatsService';
import { updateLeaderboardIdentity } from '../services/leaderboardService';
import { isUsernameAvailable, claimUsername } from '../firebase/firestore';

const AVATAR_PRESETS = ['🎮', '🏆', '⚡', '🔥', '🎯', '🎨', '🦅', '🌟'];

const TABS = [
  { id: 'profile',      label: '👤 PROFILE' },
  { id: 'achievements', label: '🥇 ACHIEVEMENTS' },
  { id: 'settings',     label: '⚙️ SETTINGS' },
];

function StatCard({ icon, label, value, bg = 'bg-white' }) {
  return (
    <div className={`${bg} border-2 border-black shadow-neo-sm p-3 flex flex-col gap-1`}>
      <span className="text-[10px] font-mono font-black uppercase text-zinc-500 tracking-wider leading-tight">{icon} {label}</span>
      <span className="font-display font-black text-2xl text-black leading-none">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'profile';
  const navigate = useNavigate();
  const { currentUser, isGuest, logout } = useAuth();
  const { playerData, xpInfo, allGameStats, unlockedAchievements, dailyRewardClaimed } = usePlayer();
  const { resetAll, settings } = useGestureAcademy();

  const [showReward, setShowReward] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameVal, setUsernameVal] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [achFilter, setAchFilter] = useState('all');

  const setTab = (t) => setSearchParams({ tab: t });

  const username = playerData?.username || currentUser?.displayName || (isGuest ? `Guest_${currentUser?.uid?.slice(-4) || '0000'}` : 'Player');
  const avatar = playerData?.avatar || '🎮';
  const weeklyStreak = getWeeklyStreakVisualization(playerData?.lastGamePlayedDate, playerData?.currentGameStreak || 0);

  const saveUsername = useCallback(async () => {
    const trimmed = usernameVal.trim().slice(0, 24);
    if (!trimmed || !currentUser?.uid) {
      setEditingUsername(false);
      setUsernameError(null);
      return;
    }

    // If unchanged, simply exit edit mode
    if (trimmed.toLowerCase() === (playerData?.username || '').trim().toLowerCase()) {
      setEditingUsername(false);
      setUsernameError(null);
      return;
    }

    if (trimmed.length < 3) {
      setUsernameError('Nickname must be at least 3 characters');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    try {
      const check = await isUsernameAvailable(trimmed, currentUser.uid);
      if (!check.available) {
        setUsernameError('Name not available');
        setSavingUsername(false);
        return;
      }

      // 1. Update Firestore user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        username: trimmed,
        username_lowercase: trimmed.toLowerCase()
      });
      await claimUsername(trimmed, currentUser.uid, playerData?.username);

      // 2. Update Firebase Auth displayName
      if (currentUser) {
        await updateProfile(currentUser, { displayName: trimmed }).catch(() => {});
      }
      // 3. Update all Leaderboards immediately
      await updateLeaderboardIdentity(currentUser.uid, { username: trimmed });
      setEditingUsername(false);
    } catch {
      setUsernameError('Failed to save username.');
    } finally {
      setSavingUsername(false);
    }
  }, [usernameVal, currentUser, playerData?.username]);

  const saveAvatar = useCallback(async (emoji) => {
    if (!currentUser?.uid) return;
    setShowAvatarPicker(false);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { avatar: emoji });
      await updateLeaderboardIdentity(currentUser.uid, { avatar: emoji });
    } catch { /* silent */ }
  }, [currentUser]);

  const handleResetTutorial = () => {
    resetAll();
    alert('Tutorial progress has been reset. You will see the Gesture Academy again on next game launch.');
  };

  const handleLogout = async () => { await logout(); navigate('/'); };

  const checkUnlocked = (ach) => {
    return (
      unlockedAchievements.includes(ach.id) ||
      Boolean(ach.check && ach.check({ ...playerData, allGameStats }))
    );
  };

  const unlockedCount = ACHIEVEMENTS.filter(checkUnlocked).length;

  const filteredAchs = ACHIEVEMENTS.filter((a) => {
    if (achFilter === 'unlocked') return checkUnlocked(a);
    if (achFilter === 'platform') return a.category === 'platform';
    if (achFilter === 'game') return a.category === 'game';
    return true;
  });

  // Sort per-game stats by lastPlayed desc
  const recentGames = Object.entries(allGameStats)
    .filter(([, s]) => s.lastPlayed)
    .sort(([, a], [, b]) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
    .slice(0, 4);

  return (
    <div className="w-full min-h-screen bg-neo-dots text-black font-sans pb-24 md:pb-12">
      <DailyRewardModal isOpen={showReward} onClose={() => setShowReward(false)} />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full bg-neo-yellow border-b-3 border-black shadow-neo-sm flex items-center justify-between px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2 font-mono font-black text-xs uppercase hover:underline">
          <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
          <span>← HOME</span>
        </Link>
        <h1 className="font-display font-black text-base uppercase tracking-tight">MY PROFILE</h1>
        <div className="w-16" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Tab Switcher ─────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-white border-2 border-black shadow-neo-sm p-1 w-full overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-[11px] font-mono font-black uppercase whitespace-nowrap transition-colors px-2 ${tab === t.id ? 'bg-neo-yellow border-2 border-black shadow-neo-sm' : 'hover:bg-zinc-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PROFILE TAB                                                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'profile' && (
          <div className="space-y-5">
            {/* Avatar + Name Card */}
            <div className="bg-white border-3 border-black shadow-neo-lg p-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowAvatarPicker((v) => !v)}
                    title="Click to customize avatar"
                    className="w-20 h-20 text-5xl bg-neo-yellow border-3 border-black shadow-neo flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  >
                    {avatar}
                  </button>
                  <button
                    onClick={() => setShowAvatarPicker((v) => !v)}
                    className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold bg-black text-white px-1.5 py-0.5 border border-black shadow-neo-sm hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
                  >
                    {showAvatarPicker ? '✕' : 'EDIT'}
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                  {/* Username */}
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                    {editingUsername ? (
                      <div className="flex flex-col items-center sm:items-start gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={usernameVal}
                            onChange={(e) => {
                              setUsernameVal(e.target.value);
                              if (usernameError) setUsernameError(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && saveUsername()}
                            maxLength={24}
                            className={`border-2 px-2 py-1 font-display font-black text-xl uppercase focus:outline-none focus:bg-neo-yellow/30 w-44 ${
                              usernameError ? 'border-red-600 bg-red-50' : 'border-black'
                            }`}
                          />
                          <button onClick={saveUsername} disabled={savingUsername} className="bg-neo-lime border-2 border-black px-2 py-1 font-mono font-black text-xs uppercase shadow-neo-sm hover:bg-lime-300 cursor-pointer">
                            {savingUsername ? '...' : 'SAVE'}
                          </button>
                          <button onClick={() => { setEditingUsername(false); setUsernameError(null); }} className="border-2 border-black px-2 py-1 font-mono font-black text-xs uppercase hover:bg-zinc-100 cursor-pointer">✕</button>
                        </div>
                        {usernameError && (
                          <div className="px-2 py-1 bg-rose-100 border-2 border-black text-[11px] font-mono font-black text-rose-900 shadow-neo-sm">
                            ⚠️ {usernameError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <h2 className="font-display font-black text-2xl uppercase truncate">{username}</h2>
                        {!isGuest && (
                          <button onClick={() => { setUsernameVal(username); setEditingUsername(true); }} className="text-xs text-zinc-400 hover:text-black border border-zinc-300 hover:border-black px-1.5 py-0.5 font-mono transition-colors">
                            ✏️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs font-mono text-zinc-500 mb-2 truncate">
                    {isGuest ? '👤 Guest Account — progress may not be saved across devices' : currentUser?.email || ''}
                  </p>

                  {/* Level + XP */}
                  <XPBar xpInfo={xpInfo} />

                  {/* Guest upgrade prompt */}
                  {isGuest && (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="mt-3 px-4 py-1.5 bg-neo-lime border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm hover:bg-lime-300 active:translate-y-0.5 transition-all"
                    >
                      🔗 SAVE PROGRESS — Link Account
                    </button>
                  )}
                </div>
              </div>

              {/* ── Aligned Inline Avatar Picker ── */}
              {showAvatarPicker && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-black/20">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black uppercase text-zinc-800">CHOOSE YOUR AVATAR</span>
                      <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">• Click any icon to update</span>
                    </div>
                    <button
                      onClick={() => setShowAvatarPicker(false)}
                      className="text-[11px] font-mono font-black uppercase text-zinc-600 hover:text-black border-2 border-black px-2 py-0.5 bg-zinc-100 hover:bg-neo-yellow transition-colors shadow-neo-sm"
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map((em) => (
                      <button
                        key={em}
                        onClick={() => saveAvatar(em)}
                        title={`Select ${em}`}
                        className={`h-12 text-2xl border-2 border-black transition-all flex items-center justify-center cursor-pointer ${
                          avatar === em
                            ? 'bg-neo-yellow shadow-neo -translate-y-0.5 font-black ring-2 ring-black'
                            : 'bg-white hover:bg-yellow-100 shadow-neo-sm hover:-translate-y-0.5'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard icon="🔥" label="Game Streak" value={`${playerData?.currentGameStreak || 0}D`} bg="bg-amber-50" />
              <StatCard icon="🏆" label="Longest Streak" value={`${playerData?.longestGameStreak || 0}D`} bg="bg-amber-50" />
              <StatCard icon="🎮" label="Games Played" value={playerData?.totalGamesPlayed || 0} bg="bg-neo-cyanLight" />
              <StatCard icon="⭐" label="Total Score" value={(playerData?.totalScore || 0).toLocaleString()} bg="bg-neo-cyanLight" />
              <StatCard icon="🥇" label="Achievements" value={`${unlockedCount}/${ACHIEVEMENTS.length}`} bg="bg-[#E0E7FF]" />
              <StatCard icon="⚡" label="Total XP" value={(playerData?.xp || 0).toLocaleString()} bg="bg-neo-yellow" />
            </div>

            {/* Weekly Streak Visual */}
            <div className="bg-white border-3 border-black shadow-neo-sm p-4">
              <h3 className="font-display font-black text-sm uppercase mb-3 flex items-center gap-2">🔥 This Week's Streak</h3>
              <div className="flex gap-1.5">
                {weeklyStreak.map((day) => (
                  <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full aspect-square flex items-center justify-center border-2 text-sm ${day.active ? 'bg-neo-lime border-black shadow-neo-sm' : 'bg-zinc-100 border-zinc-300'}`}>
                      {day.active ? '✓' : '·'}
                    </div>
                    <span className="text-[9px] font-mono font-black text-zinc-600">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Reward */}
            <div
              className={`border-3 border-black shadow-neo p-4 flex items-center justify-between cursor-pointer hover:shadow-neo-lg transition-all ${dailyRewardClaimed ? 'bg-neo-lime/20' : 'bg-neo-pink/20'}`}
              onClick={() => setShowReward(true)}
            >
              <div>
                <p className="font-display font-black text-base uppercase">🎁 Daily Reward</p>
                <p className="text-xs font-mono text-zinc-600 mt-0.5">
                  {dailyRewardClaimed ? '✓ Claimed today — come back tomorrow!' : 'Your reward is ready to claim!'}
                </p>
              </div>
              <div className={`px-4 py-2 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm ${dailyRewardClaimed ? 'bg-neo-lime text-black' : 'bg-neo-pink text-black animate-pulse'}`}>
                {dailyRewardClaimed ? '✓ CLAIMED' : 'CLAIM →'}
              </div>
            </div>

            {/* Per-Game Stats */}
            {Object.keys(GAME_LABELS).length > 0 && (
              <div className="bg-white border-3 border-black shadow-neo-sm p-4">
                <h3 className="font-display font-black text-sm uppercase mb-3">🎮 Game Stats</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(GAME_LABELS).map(([gameId, { label, emoji }]) => {
                    const stats = allGameStats[gameId] || {};
                    return (
                      <div key={gameId} className="bg-zinc-50 border-2 border-black p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{emoji}</span>
                          <span className="text-[10px] font-mono font-black uppercase truncate">{label}</span>
                        </div>
                        <p className="font-display font-black text-lg leading-none">{stats.bestScore || 0}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{stats.gamesPlayed || 0} games · Best Score</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Games */}
            {recentGames.length > 0 && (
              <div className="bg-white border-3 border-black shadow-neo-sm p-4">
                <h3 className="font-display font-black text-sm uppercase mb-3">🕐 Recent Activity</h3>
                <div className="space-y-2">
                  {recentGames.map(([gameId, stats]) => {
                    const gameInfo = GAME_LABELS[gameId] || { label: gameId, emoji: '🎮' };
                    const lastPlayed = stats.lastPlayed ? new Date(stats.lastPlayed).toLocaleDateString() : '—';
                    return (
                      <div key={gameId} className="flex items-center gap-3 bg-zinc-50 border border-black px-3 py-2">
                        <span className="text-xl">{gameInfo.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-black text-xs uppercase truncate">{gameInfo.label}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{lastPlayed}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-black text-sm">Best: {stats.bestScore || 0}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{stats.gamesPlayed} plays</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ACHIEVEMENTS TAB                                                */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'achievements' && (
          <div>
            {/* Header count */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-black text-xl uppercase">🥇 Achievements</h2>
                <p className="text-xs font-mono text-zinc-600 mt-0.5">{unlockedCount} / {ACHIEVEMENTS.length} Unlocked</p>
              </div>
              {/* Progress bar */}
              <div className="w-32 h-3 bg-zinc-200 border-2 border-black">
                <div className="h-full bg-neo-lime transition-all" style={{ width: `${Math.round((unlockedCount / ACHIEVEMENTS.length) * 100)}%` }} />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 mb-5 flex-wrap">
              {[['all', 'ALL'], ['platform', 'PLATFORM'], ['game', 'GAME'], ['unlocked', 'UNLOCKED']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setAchFilter(id)}
                  className={`px-3 py-1.5 border-2 border-black text-xs font-mono font-black uppercase transition-colors ${achFilter === id ? 'bg-neo-yellow shadow-neo-sm' : 'bg-white hover:bg-zinc-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Achievement Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAchs.map((ach) => {
                const isUnlocked = checkUnlocked(ach);
                const progress = ach.progress ? getAchievementProgress(ach.id, playerData) : null;
                return (
                  <div
                    key={ach.id}
                    className={`border-2 border-black p-4 shadow-neo-sm flex flex-col gap-2 transition-all ${isUnlocked ? 'bg-white' : 'bg-zinc-100 opacity-70'}`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="text-3xl leading-none">{ach.icon}</span>
                        <div>
                          <p className="font-display font-black text-sm uppercase leading-tight">{ach.title}</p>
                          <p className="text-[10px] font-mono text-zinc-600 leading-tight mt-0.5">{ach.description}</p>
                        </div>
                      </div>
                      <div className={`shrink-0 text-[9px] font-mono font-black uppercase px-1.5 py-0.5 border ${isUnlocked ? 'bg-neo-lime border-black text-black' : 'bg-zinc-200 border-zinc-400 text-zinc-600'}`}>
                        {isUnlocked ? '✓' : '🔒'}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {progress && !isUnlocked && (
                      <div>
                        <div className="flex justify-between text-[9px] font-mono font-bold text-zinc-500 mb-0.5">
                          <span>{progress.current} / {progress.target}</span>
                          <span>{progress.percent}%</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-200 border border-black">
                          <div className="h-full bg-neo-yellow transition-all" style={{ width: `${progress.percent}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.5 border ${ach.category === 'platform' ? 'bg-[#E0E7FF] border-[#818CF8]' : 'bg-[#FEF08A] border-black'}`}>
                        {ach.category === 'platform' ? '🌐 PLATFORM' : `${GAME_LABELS[ach.gameId]?.emoji || '🎮'} ${GAME_LABELS[ach.gameId]?.label || ach.gameId}`}
                      </span>
                      <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 border ${isUnlocked ? 'bg-neo-lime border-black' : 'bg-zinc-200 border-zinc-400 text-zinc-500'}`}>
                        +{ach.xp} XP
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredAchs.length === 0 && (
                <div className="col-span-3 text-center py-12">
                  <p className="text-4xl mb-2">🏅</p>
                  <p className="font-mono font-black text-sm text-zinc-500 uppercase">No achievements match this filter</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB                                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'settings' && (
          <div className="space-y-5">
            {/* Account */}
            <section className="bg-white border-3 border-black shadow-neo-sm p-5">
              <h3 className="font-display font-black text-base uppercase mb-4 border-b-2 border-black pb-2">👤 Account</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-mono font-bold text-zinc-600">Username</span>
                  <span className="font-mono font-black">{username}</span>
                </div>
                {currentUser?.email && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-mono font-bold text-zinc-600">Email</span>
                    <span className="font-mono text-xs text-zinc-800">{currentUser.email}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="font-mono font-bold text-zinc-600">Account Type</span>
                  <span className={`font-mono font-black text-xs px-2 py-0.5 border-2 border-black ${isGuest ? 'bg-amber-200' : 'bg-neo-lime'}`}>
                    {isGuest ? '👤 GUEST' : '⭐ FULL ACCOUNT'}
                  </span>
                </div>
                {isGuest && (
                  <button onClick={() => setShowAuth(true)} className="w-full py-2.5 bg-neo-lime border-3 border-black font-mono font-black text-xs uppercase shadow-neo-sm hover:bg-lime-300 active:translate-y-0.5 transition-all">
                    🔗 Link Account to Save Progress
                  </button>
                )}
              </div>
            </section>

            {/* Gesture Academy */}
            <section className="bg-white border-3 border-black shadow-neo-sm p-5">
              <h3 className="font-display font-black text-base uppercase mb-4 border-b-2 border-black pb-2">🎓 Gesture Academy</h3>
              <div className="space-y-2.5">
                <Link
                  to="/gesture-academy"
                  className="block w-full py-2.5 bg-[#E0E7FF] hover:bg-[#C7D2FE] text-black border-3 border-black font-mono font-black text-xs uppercase text-center shadow-neo-sm active:translate-y-0.5 transition-all"
                >
                  🎓 Replay Gesture Academy
                </Link>
                <button
                  onClick={handleResetTutorial}
                  className="w-full py-2.5 bg-amber-100 hover:bg-amber-200 border-3 border-black font-mono font-black text-xs uppercase shadow-neo-sm active:translate-y-0.5 transition-all"
                >
                  🔄 Reset Tutorial Progress
                </button>
                <ToggleSetting
                  label="Don't Show Tutorial Again"
                  value={settings.dontShow}
                  onChange={(v) => settings.setDontShow(v)}
                />
              </div>
            </section>

            {/* Gesture Help */}
            <section className="bg-white border-3 border-black shadow-neo-sm p-5">
              <h3 className="font-display font-black text-base uppercase mb-4 border-b-2 border-black pb-2">✋ Gesture Help</h3>
              <div className="space-y-2.5">
                <ToggleSetting label="Show Gesture Guide During Games" value={settings.showGuide} onChange={(v) => settings.setShowGuide(v)} />
                <ToggleSetting label="Show Gesture Tips" value={settings.showTips} onChange={(v) => settings.setShowTips(v)} />
              </div>
            </section>

            {/* Danger Zone */}
            <section className="bg-red-50 border-3 border-red-400 shadow-neo-sm p-5">
              <h3 className="font-display font-black text-base uppercase text-red-700 mb-4 border-b-2 border-red-300 pb-2">⚠️ Danger Zone</h3>
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white border-3 border-black font-display font-black text-sm uppercase shadow-neo active:translate-y-0.5 transition-all"
              >
                🚪 LOG OUT
              </button>
            </section>
          </div>
        )}

      </div>
    </div>
  );
}

function ToggleSetting({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="font-mono text-xs font-bold text-zinc-700 flex-1">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 border-2 border-black transition-colors shrink-0 ${value ? 'bg-neo-lime' : 'bg-zinc-200'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-black transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
