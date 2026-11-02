import os
import json
import time
import random
import asyncio
import logging
from typing import Dict, Any, Optional, List
from fastapi import WebSocket

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RoomManager")

# Firebase Admin Setup
firebase_initialized = False
firestore_db = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth

    # Search for serviceAccountKey.json in parent dir or current dir
    base_dir = os.path.dirname(os.path.abspath(__file__))
    key_paths = [
        os.path.join(base_dir, "serviceAccountKey.json"),
        os.path.join(os.path.dirname(base_dir), "serviceAccountKey.json"),
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    ]
    
    service_account_env = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or os.getenv("FIREBASE_CREDENTIALS")
    cred_file = next((p for p in key_paths if p and os.path.exists(p)), None)

    if service_account_env:
        try:
            cert_dict = json.loads(service_account_env)
            if not firebase_admin._apps:
                cred = credentials.Certificate(cert_dict)
                firebase_admin.initialize_app(cred)
            firestore_db = firestore.client()
            firebase_initialized = True
            logger.info("Firebase Admin initialized successfully from FIREBASE_SERVICE_ACCOUNT_JSON environment variable")
        except Exception as err:
            logger.error(f"Error parsing FIREBASE_SERVICE_ACCOUNT_JSON: {err}")
    elif cred_file:
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_file)
            firebase_admin.initialize_app(cred)
        firestore_db = firestore.client()
        firebase_initialized = True
        logger.info(f"Firebase Admin initialized successfully using {cred_file}")
    else:
        # Default initialization (useful on cloud providers like Railway / Render)
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        firestore_db = firestore.client()
        firebase_initialized = True
        logger.info("Firebase Admin initialized with default credentials")
except Exception as e:
    logger.warning(f"Firebase Admin could not be initialized: {e}. Running in local-state mode.")

# Tiers configuration
MATCH_TIERS = {
    "bronze": {"name": "Bronze Match", "entry": 200, "pool": 400},
    "silver": {"name": "Silver Match", "entry": 500, "pool": 1000},
    "gold":   {"name": "Gold Match",   "entry": 2500, "pool": 5000},
}

INITIAL_USER_COINS = 1000

class RoomManager:
    def __init__(self):
        # Connected clients: uid -> { ws, username, avatar, status, current_room }
        self.connected_users: Dict[str, Dict[str, Any]] = {}
        # Active match rooms: roomId -> dict
        self.rooms: Dict[str, Dict[str, Any]] = {}
        # Matchmaking queues: gameId -> [uid1, uid2, ...]
        self.queues: Dict[str, List[str]] = {}
        # Pending friend invitations: inviteId -> dict
        self.pending_invites: Dict[str, Dict[str, Any]] = {}

    # ── User Connections & Presence ───────────────────────────────────────────
    async def register_user(self, uid: str, ws: WebSocket, username: str, avatar: str):
        self.connected_users[uid] = {
            "ws": ws,
            "username": username or "Player",
            "avatar": avatar or "🎮",
            "status": "idle", # "idle", "queueing", "in_lobby", "in_game"
            "current_room": None,
            "connected_at": time.time()
        }
        logger.info(f"User registered: {username} ({uid})")

        # Ensure user document has starting coins in Firestore
        self._ensure_user_coins(uid)

    async def unregister_user(self, uid: str):
        if uid not in self.connected_users:
            return

        user_info = self.connected_users[uid]
        current_room_id = user_info.get("current_room")

        # Remove from matchmaking queues
        for game_id, queue in self.queues.items():
            if uid in queue:
                queue.remove(uid)

        # Handle active room cleanup or disconnection
        if current_room_id and current_room_id in self.rooms:
            await self.handle_player_disconnect(current_room_id, uid)

        del self.connected_users[uid]
        logger.info(f"User unregistered: {uid}")

    def is_user_online(self, uid: str) -> bool:
        return uid in self.connected_users

    def get_user_status(self, uid: str) -> str:
        if uid in self.connected_users:
            return self.connected_users[uid].get("status", "online")
        return "offline"

    # ── Database Coins & Security ─────────────────────────────────────────────
    def _ensure_user_coins(self, uid: str):
        """Ensure the user has an initialized coins field (default 1,000)."""
        if not firebase_initialized or not firestore_db:
            return
        try:
            doc_ref = firestore_db.collection("users").document(uid)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict() or {}
                if "coins" not in data:
                    doc_ref.set({"coins": INITIAL_USER_COINS}, merge=True)
            else:
                doc_ref.set({"coins": INITIAL_USER_COINS, "uid": uid}, merge=True)
        except Exception as e:
            logger.warning(f"Error ensuring coins for {uid}: {e}")

    def get_user_coins(self, uid: str) -> int:
        if not firebase_initialized or not firestore_db:
            return 1000
        try:
            doc_ref = firestore_db.collection("users").document(uid)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict() or {}
                return data.get("coins", INITIAL_USER_COINS)
            return INITIAL_USER_COINS
        except Exception as e:
            logger.error(f"Error getting coins for {uid}: {e}")
            return 1000

    def deduct_coins_atomic(self, uid1: str, uid2: str, amount: int) -> bool:
        """
        Secure atomic transaction to verify both players have >= amount
        and deduct entry fee simultaneously.
        """
        if not firebase_initialized or not firestore_db:
            return True

        transaction = firestore_db.transaction()
        ref1 = firestore_db.collection("users").document(uid1)
        ref2 = firestore_db.collection("users").document(uid2)

        @firestore.transactional
        def _txn(txn):
            snap1 = ref1.get(transaction=txn)
            snap2 = ref2.get(transaction=txn)
            c1 = (snap1.to_dict() or {}).get("coins", INITIAL_USER_COINS) if snap1.exists else INITIAL_USER_COINS
            c2 = (snap2.to_dict() or {}).get("coins", INITIAL_USER_COINS) if snap2.exists else INITIAL_USER_COINS

            if c1 < amount:
                raise ValueError(f"Player 1 has insufficient coins ({c1} < {amount})")
            if c2 < amount:
                raise ValueError(f"Player 2 has insufficient coins ({c2} < {amount})")

            txn.update(ref1, {"coins": c1 - amount})
            txn.update(ref2, {"coins": c2 - amount})
            return True

        try:
            return _txn(transaction)
        except Exception as e:
            logger.error(f"Coin deduction failed: {e}")
            return False

    def refund_coins(self, uid: str, amount: int):
        """Refund deducted coins if match cancelled before start."""
        if not firebase_initialized or not firestore_db:
            return
        try:
            ref = firestore_db.collection("users").document(uid)
            ref.update({"coins": firestore.Increment(amount)})
            logger.info(f"Refunded {amount} coins to {uid}")
        except Exception as e:
            logger.error(f"Error refunding coins to {uid}: {e}")

    def award_winner(self, winner_uid: str, pool_amount: int):
        """Add total prize pool to winner."""
        if not firebase_initialized or not firestore_db:
            return
        try:
            ref = firestore_db.collection("users").document(winner_uid)
            ref.update({"coins": firestore.Increment(pool_amount)})
            logger.info(f"Awarded {pool_amount} coins to winner {winner_uid}")
        except Exception as e:
            logger.error(f"Error awarding winner coins: {e}")

    def record_match_history(self, room: Dict[str, Any], winner_id: str):
        """Save match result record in Firestore for both players' profile history."""
        if not firebase_initialized or not firestore_db:
            return
        try:
            p1 = room["player1"]
            p2 = room["player2"]
            entry_fee = room.get("entry_fee", 200)
            pool = room.get("total_pool", 400)
            tier = room.get("tier", "bronze")
            game_id = room.get("game_id", "fruit-ninja")
            game_name = "Fruit Ninja" if game_id == "fruit-ninja" else game_id.replace("-", " ").title()

            match_data = {
                "matchId": room["room_id"],
                "gameId": game_id,
                "gameName": game_name,
                "playerUids": [p1["uid"], p2["uid"]],
                "player1": {
                    "uid": p1["uid"],
                    "username": p1["username"],
                    "avatar": p1["avatar"],
                    "score": p1.get("score", 0)
                },
                "player2": {
                    "uid": p2["uid"],
                    "username": p2["username"],
                    "avatar": p2["avatar"],
                    "score": p2.get("score", 0)
                },
                "scores": {
                    p1["uid"]: p1.get("score", 0),
                    p2["uid"]: p2.get("score", 0),
                },
                "winnerId": winner_id, # uid or "DRAW"
                "tier": tier,
                "entryFee": entry_fee,
                "pool": pool,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "createdAt": time.strftime("%Y-%m-%d %H:%M:%S")
            }

            firestore_db.collection("matchHistory").add(match_data)
            logger.info(f"Match history recorded for room {room['room_id']}")
        except Exception as e:
            logger.error(f"Error recording match history: {e}")

    # ── Matchmaking Queue ─────────────────────────────────────────────────────
    async def join_queue(self, uid: str, game_id: str):
        if uid not in self.connected_users:
            return

        if game_id not in self.queues:
            self.queues[game_id] = []

        if uid in self.queues[game_id]:
            return

        self.queues[game_id].append(uid)
        self.connected_users[uid]["status"] = "queueing"
        logger.info(f"User {uid} joined queue for {game_id}. Queue length: {len(self.queues[game_id])}")

        await self._check_queue(game_id)

    async def leave_queue(self, uid: str):
        for game_id, queue in self.queues.items():
            if uid in queue:
                queue.remove(uid)
                if uid in self.connected_users:
                    self.connected_users[uid]["status"] = "idle"
                logger.info(f"User {uid} left queue for {game_id}")

    async def _check_queue(self, game_id: str):
        queue = self.queues.get(game_id, [])
        while len(queue) >= 2:
            uid1 = queue.pop(0)
            uid2 = queue.pop(0)

            # Validate both still connected
            if uid1 not in self.connected_users or uid2 not in self.connected_users:
                if uid1 in self.connected_users:
                    queue.insert(0, uid1)
                if uid2 in self.connected_users:
                    queue.insert(0, uid2)
                break

            await self.create_room(game_id, uid1, uid2, mode="random")

    # ── Room Lifecycle ────────────────────────────────────────────────────────
    async def create_room(self, game_id: str, uid1: str, uid2: str, mode: str = "random") -> str:
        room_id = f"room_{int(time.time()*1000)}_{random.randint(100, 999)}"
        u1 = self.connected_users[uid1]
        u2 = self.connected_users[uid2]

        # 32-bit PRNG seed for Mulberry32
        shared_seed = random.randint(1, 2147483647)

        room = {
            "room_id": room_id,
            "game_id": game_id,
            "mode": mode,
            "seed": shared_seed,
            "state": "MATCH_FOUND", # MATCH_FOUND -> TIER_SELECTION -> COUNTDOWN -> PLAYING -> FINISHED
            "created_at": time.time(),
            "tier": None,
            "entry_fee": 0,
            "total_pool": 0,
            "coins_deducted": False,
            "settled": False,
            "player1": {
                "uid": uid1,
                "username": u1["username"],
                "avatar": u1["avatar"],
                "confirmed": False,
                "tier_selected": None,
                "score": 0,
                "finished": False,
                "play_again": False
            },
            "player2": {
                "uid": uid2,
                "username": u2["username"],
                "avatar": u2["avatar"],
                "confirmed": False,
                "tier_selected": None,
                "score": 0,
                "finished": False,
                "play_again": False
            }
        }

        self.rooms[room_id] = room
        u1["current_room"] = room_id
        u2["current_room"] = room_id
        u1["status"] = "in_lobby"
        u2["status"] = "in_lobby"

        logger.info(f"Room {room_id} created for {u1['username']} vs {u2['username']}")

        # Notify both players that a match was found
        await self.broadcast_to_room(room_id, {
            "type": "MATCH_FOUND",
            "roomId": room_id,
            "gameId": game_id,
            "player1": {"uid": uid1, "username": u1["username"], "avatar": u1["avatar"]},
            "player2": {"uid": uid2, "username": u2["username"], "avatar": u2["avatar"]},
        })

        return room_id

    async def confirm_match(self, room_id: str, uid: str):
        room = self.rooms.get(room_id)
        if not room or room["state"] != "MATCH_FOUND":
            return

        if room["player1"]["uid"] == uid:
            room["player1"]["confirmed"] = True
        elif room["player2"]["uid"] == uid:
            room["player2"]["confirmed"] = True

        # Check if both confirmed
        if room["player1"]["confirmed"] and room["player2"]["confirmed"]:
            room["state"] = "TIER_SELECTION"
            p1_coins = self.get_user_coins(room["player1"]["uid"])
            p2_coins = self.get_user_coins(room["player2"]["uid"])

            await self.broadcast_to_room(room_id, {
                "type": "MOVE_TO_TIER_SELECTION",
                "roomId": room_id,
                "tiers": MATCH_TIERS,
                "player1Coins": p1_coins,
                "player2Coins": p2_coins
            })

    async def select_tier(self, room_id: str, uid: str, tier: str):
        room = self.rooms.get(room_id)
        if not room or room["state"] != "TIER_SELECTION":
            return

        if tier not in MATCH_TIERS:
            return

        tier_info = MATCH_TIERS[tier]
        entry = tier_info["entry"]

        # Check this player's coins
        user_coins = self.get_user_coins(uid)
        if user_coins < entry:
            await self.send_to_user(uid, {
                "type": "ERROR",
                "message": f"You need at least {entry} coins for {tier_info['name']}."
            })
            return

        if room["player1"]["uid"] == uid:
            room["player1"]["tier_selected"] = tier
        elif room["player2"]["uid"] == uid:
            room["player2"]["tier_selected"] = tier

        # Inform both players of current selections
        await self.broadcast_to_room(room_id, {
            "type": "TIER_SELECTION_UPDATE",
            "p1Tier": room["player1"]["tier_selected"],
            "p2Tier": room["player2"]["tier_selected"],
        })

        # Check if both selected the same tier
        t1 = room["player1"]["tier_selected"]
        t2 = room["player2"]["tier_selected"]

        if t1 and t2 and t1 == t2:
            room["tier"] = t1
            room["entry_fee"] = MATCH_TIERS[t1]["entry"]
            room["total_pool"] = MATCH_TIERS[t1]["pool"]

            # Deduct coins securely via atomic transaction
            success = self.deduct_coins_atomic(
                room["player1"]["uid"],
                room["player2"]["uid"],
                room["entry_fee"]
            )

            if not success:
                await self.broadcast_to_room(room_id, {
                    "type": "ERROR",
                    "message": "One or both players do not have enough coins to start this match."
                })
                room["player1"]["tier_selected"] = None
                room["player2"]["tier_selected"] = None
                return

            room["coins_deducted"] = True
            room["state"] = "COUNTDOWN"

            # Transition to synchronized countdown
            await self.broadcast_to_room(room_id, {
                "type": "START_COUNTDOWN",
                "roomId": room_id,
                "seed": room["seed"],
                "tier": room["tier"],
                "entryFee": room["entry_fee"],
                "totalPool": room["total_pool"],
                "countdownSeconds": 3,
                "gameDuration": 60 # 60 seconds of synchronized gameplay
            })

            # Background task to start game after countdown
            asyncio.create_task(self._run_countdown_and_start(room_id))

    async def _run_countdown_and_start(self, room_id: str):
        await asyncio.sleep(3.2)
        room = self.rooms.get(room_id)
        if not room or room["state"] != "COUNTDOWN":
            return

        room["state"] = "PLAYING"
        room["start_time"] = time.time()
        
        u1 = self.connected_users.get(room["player1"]["uid"])
        u2 = self.connected_users.get(room["player2"]["uid"])
        if u1: u1["status"] = "in_game"
        if u2: u2["status"] = "in_game"

        await self.broadcast_to_room(room_id, {
            "type": "GAME_START",
            "roomId": room_id,
            "seed": room["seed"],
            "startTime": room["start_time"],
            "duration": 60
        })

    async def update_score(self, room_id: str, uid: str, score: int, extra_info: Optional[Dict] = None):
        """Stream live score to opponent in real time."""
        room = self.rooms.get(room_id)
        if not room or room["state"] != "PLAYING":
            return

        if room["player1"]["uid"] == uid:
            room["player1"]["score"] = score
        elif room["player2"]["uid"] == uid:
            room["player2"]["score"] = score

        # Broadcast score update
        await self.broadcast_to_room(room_id, {
            "type": "SCORE_UPDATE",
            "uid": uid,
            "score": score,
            "extra": extra_info or {}
        })

    async def submit_final_score(self, room_id: str, uid: str, final_score: int):
        room = self.rooms.get(room_id)
        if not room or room["settled"]:
            return

        if room["player1"]["uid"] == uid:
            room["player1"]["score"] = final_score
            room["player1"]["finished"] = True
        elif room["player2"]["uid"] == uid:
            room["player2"]["score"] = final_score
            room["player2"]["finished"] = True

        # Settle once both submit or timeout
        if room["player1"]["finished"] and room["player2"]["finished"]:
            await self.settle_match(room_id)

    async def settle_match(self, room_id: str, default_winner_uid: Optional[str] = None):
        room = self.rooms.get(room_id)
        if not room or room["settled"]:
            return

        room["settled"] = True
        room["state"] = "FINISHED"

        p1 = room["player1"]
        p2 = room["player2"]
        score1 = p1.get("score", 0)
        score2 = p2.get("score", 0)
        pool = room.get("total_pool", 400)
        entry = room.get("entry_fee", 200)

        winner_uid = default_winner_uid
        if not winner_uid:
            if score1 > score2:
                winner_uid = p1["uid"]
            elif score2 > score1:
                winner_uid = p2["uid"]
            else:
                winner_uid = "DRAW"

        # Award rewards or refund on draw
        coins_won = 0
        if winner_uid == "DRAW":
            # Refund both players
            self.refund_coins(p1["uid"], entry)
            self.refund_coins(p2["uid"], entry)
            coins_won = entry
        elif winner_uid:
            self.award_winner(winner_uid, pool)
            coins_won = pool

        # Record match history in Firestore
        self.record_match_history(room, winner_uid)

        # Notify both players
        await self.broadcast_to_room(room_id, {
            "type": "MATCH_RESULT",
            "roomId": room_id,
            "winnerId": winner_uid,
            "player1": {"uid": p1["uid"], "username": p1["username"], "avatar": p1["avatar"], "score": score1},
            "player2": {"uid": p2["uid"], "username": p2["username"], "avatar": p2["avatar"], "score": score2},
            "coinsWon": coins_won,
            "tier": room.get("tier", "bronze"),
            "pool": pool
        })

    async def handle_player_disconnect(self, room_id: str, disconnected_uid: str):
        room = self.rooms.get(room_id)
        if not room or room["settled"]:
            return

        logger.info(f"Player {disconnected_uid} disconnected from room {room_id} in state {room['state']}")

        p1_uid = room["player1"]["uid"]
        p2_uid = room["player2"]["uid"]
        other_uid = p2_uid if disconnected_uid == p1_uid else p1_uid

        # If disconnected before match start (MATCH_FOUND, TIER_SELECTION, COUNTDOWN)
        if room["state"] in ("MATCH_FOUND", "TIER_SELECTION", "COUNTDOWN"):
            # Refund deducted coins if any
            if room["coins_deducted"]:
                self.refund_coins(p1_uid, room["entry_fee"])
                self.refund_coins(p2_uid, room["entry_fee"])
                room["coins_deducted"] = False

            await self.send_to_user(other_uid, {
                "type": "OPPONENT_DISCONNECTED",
                "message": "Your opponent disconnected. Any entry coins have been refunded."
            })
            del self.rooms[room_id]
        elif room["state"] == "PLAYING":
            # Settle match awarding victory to the remaining player
            await self.settle_match(room_id, default_winner_uid=other_uid)

    async def play_again_request(self, room_id: str, uid: str):
        room = self.rooms.get(room_id)
        if not room:
            return

        if room["player1"]["uid"] == uid:
            room["player1"]["play_again"] = True
        elif room["player2"]["uid"] == uid:
            room["player2"]["play_again"] = True

        other_uid = room["player2"]["uid"] if uid == room["player1"]["uid"] else room["player1"]["uid"]

        await self.send_to_user(other_uid, {
            "type": "OPPONENT_WANTS_PLAY_AGAIN",
            "requesterUid": uid
        })

        # If both agreed to play again
        if room["player1"]["play_again"] and room["player2"]["play_again"]:
            # Reset room to tier selection with a new random seed
            room["seed"] = random.randint(1, 2147483647)
            room["state"] = "TIER_SELECTION"
            room["coins_deducted"] = False
            room["settled"] = False
            room["player1"]["score"] = 0
            room["player2"]["score"] = 0
            room["player1"]["finished"] = False
            room["player2"]["finished"] = False
            room["player1"]["tier_selected"] = None
            room["player2"]["tier_selected"] = None
            room["player1"]["play_again"] = False
            room["player2"]["play_again"] = False

            p1_coins = self.get_user_coins(room["player1"]["uid"])
            p2_coins = self.get_user_coins(room["player2"]["uid"])

            await self.broadcast_to_room(room_id, {
                "type": "MOVE_TO_TIER_SELECTION",
                "roomId": room_id,
                "tiers": MATCH_TIERS,
                "player1Coins": p1_coins,
                "player2Coins": p2_coins
            })

    # ── Friend Invites ────────────────────────────────────────────────────────
    async def send_friend_invite(self, from_uid: str, to_uid: str, game_id: str):
        if to_uid not in self.connected_users:
            await self.send_to_user(from_uid, {
                "type": "INVITE_FAILED",
                "message": "Friend is currently offline."
            })
            return

        from_user = self.connected_users[from_uid]
        invite_id = f"inv_{int(time.time()*1000)}_{random.randint(100, 999)}"

        self.pending_invites[invite_id] = {
            "from_uid": from_uid,
            "to_uid": to_uid,
            "game_id": game_id,
            "created_at": time.time()
        }

        # Send notification to target friend
        await self.send_to_user(to_uid, {
            "type": "RECEIVE_MATCH_INVITE",
            "inviteId": invite_id,
            "fromUser": {
                "uid": from_uid,
                "username": from_user["username"],
                "avatar": from_user["avatar"]
            },
            "gameId": game_id,
            "gameName": "Fruit Ninja" if game_id == "fruit-ninja" else game_id.replace("-", " ").title()
        })

        await self.send_to_user(from_uid, {
            "type": "INVITE_SENT",
            "toUid": to_uid,
            "inviteId": invite_id
        })

    async def respond_to_invite(self, invite_id: str, to_uid: str, accept: bool):
        invite = self.pending_invites.pop(invite_id, None)
        if not invite:
            return

        from_uid = invite["from_uid"]
        game_id = invite["game_id"]

        if not accept:
            await self.send_to_user(from_uid, {
                "type": "INVITE_REJECTED",
                "message": f"Invitation was declined."
            })
            return

        # Accepted! Check if from_user is still online
        if from_uid not in self.connected_users or to_uid not in self.connected_users:
            await self.send_to_user(to_uid, {
                "type": "ERROR",
                "message": "Player is no longer available."
            })
            return

        # Create private match room for the two friends
        await self.create_room(game_id, from_uid, to_uid, mode="friend")

    # ── Utility Messaging ─────────────────────────────────────────────────────
    async def send_to_user(self, uid: str, message: Dict[str, Any]):
        user = self.connected_users.get(uid)
        if user and user["ws"]:
            try:
                await user["ws"].send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to {uid}: {e}")

    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any]):
        room = self.rooms.get(room_id)
        if not room:
            return
        p1 = room["player1"]["uid"]
        p2 = room["player2"]["uid"]
        await self.send_to_user(p1, message)
        await self.send_to_user(p2, message)
