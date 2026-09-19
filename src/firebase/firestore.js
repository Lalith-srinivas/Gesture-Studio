/**
 * Cloud Firestore Database Service
 * - Collections: users, leaderboards, gameScores, achievements, dailyChallenges, weeklyChallenges, userSettings
 * - Local storage offline fallback + automatic online sync
 * - Streak calculation system
 * - Batch writes & query limits
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export const COLLECTIONS = {
  USERS: 'users',
  USERNAMES: 'usernames',
  LEADERBOARDS: 'leaderboards',
  GAME_SCORES: 'gameScores',
  ACHIEVEMENTS: 'achievements',
  DAILY_CHALLENGES: 'dailyChallenges',
  WEEKLY_CHALLENGES: 'weeklyChallenges',
  USER_SETTINGS: 'userSettings'
};

export const SUPPORTED_GAMES = {
  FRUIT_NINJA: 'Fruit Ninja',
  CRAZY_ROAD: 'Crazy Road',
  FLAPPY_BIRD: 'Flappy Bird',
  ARCHERY: 'Archery Challenge',
  BIRD_HUNTER: 'Bird Hunter Challenge',
  SPACE_SHOOTER: 'Space Shooter',
};

// --- LOCAL CACHE HELPERS ---
const CACHE_PREFIX = 'gesture_studio_';

export const cacheLocally = (key, data) => {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn('[Cache] LocalStorage save error:', e);
  }
};

export const getLocalCache = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

// --- STREAK CALCULATOR ---
export const calculateStreak = (lastLoginIso, currentStreak = 0, longestStreak = 0) => {
  if (!lastLoginIso) {
    return { currentStreak: 1, longestStreak: Math.max(1, longestStreak), isNewDay: true };
  }

  const last = new Date(lastLoginIso);
  const now = new Date();

  // Normalize dates to midnight for calendar day comparison
  const lastMidnight = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const diffDays = Math.round((todayMidnight - lastMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Logged in on the same calendar day; streak unchanged
    return { currentStreak, longestStreak, isNewDay: false };
  } else if (diffDays === 1) {
    // Next consecutive day: streak increments!
    const newStreak = currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, longestStreak),
      isNewDay: true
    };
  } else {
    // Missed one or more days: reset to 1
    return {
      currentStreak: 1,
      longestStreak: Math.max(1, longestStreak),
      isNewDay: true
    };
  }
};

// --- USERNAME UNIQUENESS & RESERVATION ---

/**
 * Check if a username is globally available
 * Returns { available: boolean, error: string | null }
 */
export const isUsernameAvailable = async (rawUsername, currentUid = null) => {
  const username = (rawUsername || '').trim();
  if (!username) return { available: false, error: 'Nickname cannot be empty.' };
  if (username.length < 3) return { available: false, error: 'Nickname must be at least 3 characters.' };
  if (username.length > 20) return { available: false, error: 'Nickname cannot exceed 20 characters.' };

  const normalized = username.toLowerCase();

  try {
    // 1. Direct O(1) lookup on dedicated 'usernames' collection
    try {
      const unameRef = doc(db, COLLECTIONS.USERNAMES, normalized);
      const unameSnap = await getDoc(unameRef);
      if (unameSnap.exists()) {
        const data = unameSnap.data();
        if (!currentUid || data.uid !== currentUid) {
          return { available: false, error: 'Name not available' };
        }
      }
    } catch (e) {
      console.warn('[Firestore] usernames collection check warning:', e?.message);
    }

    // 2. Query 'users' collection for matching username or username_lowercase
    const usersRef = collection(db, COLLECTIONS.USERS);

    // Exact match query
    const qExact = query(usersRef, where('username', '==', username), limit(2));
    const snapExact = await getDocs(qExact);
    const takenExact = snapExact.docs.some((d) => !currentUid || d.id !== currentUid);
    if (takenExact) {
      return { available: false, error: 'Name not available' };
    }

    // Lowercase match query if indexed
    const qLower = query(usersRef, where('username_lowercase', '==', normalized), limit(2));
    const snapLower = await getDocs(qLower);
    const takenLower = snapLower.docs.some((d) => !currentUid || d.id !== currentUid);
    if (takenLower) {
      return { available: false, error: 'Name not available' };
    }

    // 3. Fallback: check Global Leaderboard entries
    try {
      const lbSnap = await getDocs(query(collection(db, COLLECTIONS.LEADERBOARDS, 'global', 'entries'), limit(100)));
      const takenInLb = lbSnap.docs.some((d) => {
        const u = (d.data()?.username || '').trim().toLowerCase();
        return u === normalized && (!currentUid || d.id !== currentUid);
      });
      if (takenInLb) {
        return { available: false, error: 'Name not available' };
      }
    } catch { /* silent fallback */ }

    return { available: true, error: null };
  } catch (error) {
    console.warn('[Firestore] Error verifying username availability:', error);
    // On network or offline failure, allow proceeding
    return { available: true, error: null, offline: true };
  }
};

/**
 * Claim or update a username in the usernames registry
 */
export const claimUsername = async (rawUsername, uid, oldUsername = null) => {
  if (!rawUsername || !uid) return;
  const username = rawUsername.trim();
  const normalized = username.toLowerCase();

  try {
    const unameRef = doc(db, COLLECTIONS.USERNAMES, normalized);
    await setDoc(unameRef, {
      username,
      normalized,
      uid,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (oldUsername) {
      const oldNormalized = oldUsername.trim().toLowerCase();
      if (oldNormalized && oldNormalized !== normalized) {
        await deleteDoc(doc(db, COLLECTIONS.USERNAMES, oldNormalized)).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Firestore] Could not claim username:', err?.message);
  }
};

// --- USER PROFILE OPERATIONS ---

export const getOrCreateUserProfile = async (user, additionalData = {}) => {
  if (!user || !user.uid) return null;

  const userRef = doc(db, COLLECTIONS.USERS, user.uid);
  const cached = getLocalCache(`user_${user.uid}`);

  try {
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      // Calculate daily login streak
      const streakInfo = calculateStreak(
        data.lastLogin,
        data.currentStreak || 0,
        data.longestStreak || 0
      );

      const updates = {
        lastLogin: new Date().toISOString()
      };

      if (streakInfo.isNewDay) {
        updates.currentStreak = streakInfo.currentStreak;
        updates.longestStreak = streakInfo.longestStreak;
      }

      // If user has a real displayName and doc has fallback 'Player' or 'Guest_...', sync it
      if (
        user.displayName &&
        (!data.username || data.username === 'Player' || data.username.startsWith('Guest_'))
      ) {
        updates.username = user.displayName;
      }
      if (user.email && !data.email) {
        updates.email = user.email;
      }
      if (data.isAnonymous && !user.isAnonymous) {
        updates.isAnonymous = false;
      }

      await updateDoc(userRef, updates);
      const merged = { ...data, ...updates };
      cacheLocally(`user_${user.uid}`, merged);
      return merged;
    } else {
      // Create new user profile document
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const guestHandle = `Guest_${randomSuffix}`;
      const finalUsername = user.displayName || additionalData.username || (user.isAnonymous ? guestHandle : 'Player');

      const newProfile = {
        uid: user.uid,
        username: finalUsername,
        username_lowercase: finalUsername.toLowerCase(),
        email: user.email || '',
        isAnonymous: Boolean(user.isAnonymous),
        avatar: user.photoURL || '🎮',
        joinedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        currentStreak: 1,
        longestStreak: 1,
        currentGameStreak: 0,
        longestGameStreak: 0,
        lastGamePlayedDate: null,
        dailyRewardDay: 0,
        lastDailyRewardDate: null,
        achievementsUnlocked: [],
        gamesPlayedByGame: {},
        gamesPlayed: 0,
        totalGamesPlayed: 0,
        totalScore: 0,
        xp: 0,
        level: 1,
        favoriteGame: 'Fruit Ninja',
        tutorialCompleted: false,
        gestureAcademyVersion: 1,
        settings: {
          darkMode: true,
          sound: true,
          music: true,
          gestureGuide: true,
          showTutorials: true,
          cameraPermission: true,
          language: 'en'
        },
        ...additionalData
      };

      await setDoc(userRef, newProfile);
      claimUsername(finalUsername, user.uid).catch(() => {});
      cacheLocally(`user_${user.uid}`, newProfile);
      return newProfile;
    }
  } catch (error) {
    console.warn('[Firestore] Profile fetch error, falling back to local cache:', error?.message);
    if (cached) return cached;

    // Default offline guest profile
    const offlineProfile = {
      uid: user.uid,
      username: user.displayName || 'Guest Player',
      email: user.email || '',
      isAnonymous: Boolean(user.isAnonymous),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
      joinedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      currentStreak: 1,
      longestStreak: 1,
      gamesPlayed: 0,
      totalScore: 0,
      xp: 0,
      level: 1,
      favoriteGame: 'Fruit Ninja',
      tutorialCompleted: false,
      gestureAcademyVersion: 1,
      settings: {
        darkMode: true,
        sound: true,
        music: true,
        gestureGuide: true,
        showTutorials: true,
        cameraPermission: true,
        language: 'en'
      }
    };
    cacheLocally(`user_${user.uid}`, offlineProfile);
    return offlineProfile;
  }
};

export const updateUserProfile = async (uid, updates) => {
  if (!uid) return;
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const enrichedUpdates = { ...updates };
  if (updates.username) {
    enrichedUpdates.username_lowercase = updates.username.trim().toLowerCase();
    claimUsername(updates.username, uid).catch(() => {});
  }
  try {
    await updateDoc(userRef, enrichedUpdates);
    const cached = getLocalCache(`user_${uid}`, {});
    cacheLocally(`user_${uid}`, { ...cached, ...enrichedUpdates });
  } catch (err) {
    console.warn('[Firestore] Could not update profile online:', err?.message);
    const cached = getLocalCache(`user_${uid}`, {});
    cacheLocally(`user_${uid}`, { ...cached, ...enrichedUpdates });
  }
};

// --- GESTURE ACADEMY SYNC ---

export const recordAcademyCompletion = async (uid, version = 1) => {
  const completionData = {
    tutorialCompleted: true,
    tutorialCompletedAt: new Date().toISOString(),
    gestureAcademyVersion: version
  };

  cacheLocally('gesture_academy_status', completionData);

  if (uid) {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, uid);
      await updateDoc(userRef, completionData);
    } catch (err) {
      console.warn('[Firestore] Offline: cached Academy progress locally:', err?.message);
    }
  }
  return completionData;
};

// --- USER SETTINGS SYNC ---

export const syncUserSettings = async (uid, settings) => {
  cacheLocally('user_settings', settings);
  if (!uid) return;

  try {
    const settingsDoc = doc(db, COLLECTIONS.USER_SETTINGS, uid);
    await setDoc(settingsDoc, { uid, ...settings, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Offline: settings cached locally:', err?.message);
  }
};

// --- GAME SCORES & GLOBAL LEADERBOARDS ---

export const saveGameScore = async ({
  uid,
  username,
  avatar,
  gameName,
  score,
  combo = 0
}) => {
  if (!gameName) return;

  const scoreEntry = {
    gameName,
    score,
    combo,
    date: new Date().toISOString(),
    timestamp: Date.now()
  };

  // Cache latest score locally
  cacheLocally(`latest_${gameName}`, scoreEntry);

  if (!uid) return;

  try {
    const batch = writeBatch(db);

    // 1. Record specific user game score entry
    const userGameScoreRef = doc(db, COLLECTIONS.USERS, uid, 'games', gameName);
    const prevSnap = await getDoc(userGameScoreRef);
    const prevData = prevSnap.exists() ? prevSnap.data() : { bestScore: 0, gamesPlayed: 0, highestCombo: 0, totalScore: 0 };

    const newGamesPlayed = (prevData.gamesPlayed || 0) + 1;
    const newBestScore = Math.max(score, prevData.bestScore || 0);
    const newHighestCombo = Math.max(combo, prevData.highestCombo || 0);
    const newTotal = (prevData.totalScore || 0) + score;

    batch.set(userGameScoreRef, {
      gameName,
      bestScore: newBestScore,
      gamesPlayed: newGamesPlayed,
      highestCombo: newHighestCombo,
      totalScore: newTotal,
      averageScore: Math.round(newTotal / newGamesPlayed),
      lastPlayed: new Date().toISOString()
    }, { merge: true });

    // 2. Submit to global game leaderboard if this is a high score
    const safeGameId = gameName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const leaderboardRef = doc(db, COLLECTIONS.LEADERBOARDS, safeGameId, 'entries', uid);

    batch.set(leaderboardRef, {
      uid,
      username: username || 'Player',
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
      score: newBestScore,
      date: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 3. Increment aggregate XP & games played on user root doc
    const userRootRef = doc(db, COLLECTIONS.USERS, uid);
    const earnedXp = Math.floor(score / 10) + 10;
    batch.update(userRootRef, {
      gamesPlayed: increment(1),
      totalScore: increment(score),
      xp: increment(earnedXp),
      lastLogin: new Date().toISOString()
    });

    await batch.commit();
  } catch (error) {
    console.warn('[Firestore] Could not save score online (offline mode):', error?.message);
  }
};

/**
 * Fetch Top Scores for a Game's Global Leaderboard
 */
export const getLeaderboard = async (gameName, topLimit = 20) => {
  const safeGameId = gameName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cacheKey = `leaderboard_${safeGameId}`;
  const local = getLocalCache(cacheKey, []);

  try {
    const entriesRef = collection(db, COLLECTIONS.LEADERBOARDS, safeGameId, 'entries');
    const q = query(entriesRef, orderBy('score', 'desc'), limit(topLimit));
    const snapshot = await getDocs(q);

    const items = [];
    snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));

    if (items.length > 0) {
      cacheLocally(cacheKey, items);
      return items;
    }
    return local;
  } catch (err) {
    console.warn('[Firestore] Offline or failed to load leaderboard, using cached:', err?.message);
    return local;
  }
};

// --- ACHIEVEMENTS SYSTEM ---

export const INITIAL_ACHIEVEMENTS = [
  { id: 'first_game', title: 'First Flight', description: 'Play your first gesture game', icon: '??', xp: 50 },
  { id: 'fruits_100', title: 'Fruit Ninja Sensei', description: 'Slice 100 fruits in Fruit Ninja', icon: '??', xp: 150 },
  { id: 'birds_500', title: 'Master Falconer', description: 'Hunt 500 birds in Bird Hunter', icon: '??', xp: 200 },
  { id: 'perfect_shot', title: 'Robin Hood', description: 'Score a bullseye in Archery Challenge', icon: '??', xp: 100 },
  { id: 'streak_7', title: '7-Day Warrior', description: 'Maintain a 7-day login streak', icon: '??', xp: 300 },
  { id: 'streak_30', title: 'Monthly Legend', description: 'Maintain a 30-day login streak', icon: '??', xp: 1000 },
  { id: 'top_100', title: 'Leaderboard Contender', description: 'Reach the top 100 on any game board', icon: '??', xp: 500 }
];

export const unlockAchievement = async (uid, achievementId) => {
  if (!uid || !achievementId) return;
  const ach = INITIAL_ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!ach) return;

  const cacheKey = `achievements_${uid}`;
  const cached = getLocalCache(cacheKey, []);
  if (!cached.includes(achievementId)) {
    cached.push(achievementId);
    cacheLocally(cacheKey, cached);
  }

  try {
    const achDoc = doc(db, COLLECTIONS.USERS, uid, 'unlockedAchievements', achievementId);
    await setDoc(achDoc, {
      ...ach,
      unlockedAt: new Date().toISOString()
    }, { merge: true });

    // Grant achievement XP
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      xp: increment(ach.xp || 50)
    });
  } catch (err) {
    console.warn('[Firestore] Offline: achievement saved locally:', err?.message);
  }
};
