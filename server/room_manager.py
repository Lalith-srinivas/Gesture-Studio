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
        # Mid-match disconnect grace period timers: roomId -> asyncio.Task
        self.disconnect_timers: Dict[str, asyncio.Task] = {}

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

        # Ensure user document has profile, tag, and starting coins in Firestore
        self._ensure_user_profile(uid, username, avatar)

        # Check if user reconnected to an active match room with a running 5s grace period
        for r_id, r in list(self.rooms.items()):
            grace = r.get("disconnect_grace")
            if grace and grace.get("exiting_uid") == uid and not r.get("settled"):
                logger.info(f"User {uid} reconnected to room {r_id} within 5s grace period!")
                # Cancel the 5-second countdown timer
                timer = self.disconnect_timers.pop(r_id, None)
                if timer and not timer.done():
                    timer.cancel()
                other_uid = grace.get("other_uid")
                r.pop("disconnect_grace", None)
                self.connected_users[uid]["current_room"] = r_id
                self.connected_users[uid]["status"] = "in_game"

                # Notify remaining opponent that player reconnected
                await self.send_to_user(other_uid, {
                    "type": "OPPONENT_RECONNECTED",
                    "roomId": r_id,
                    "reconnectedUid": uid,
                    "message": "Opponent reconnected! Match continues!"
                })

                # Send match rejoined payload to reconnected player
                opp_info = self.connected_users.get(other_uid, {})
                await self.send_to_user(uid, {
                    "type": "MATCH_REJOINED",
                    "roomId": r_id,
                    "gameId": r.get("game_id", "fruit-ninja"),
                    "seed": r.get("seed"),
                    "tier": r.get("tier", "bronze"),
                    "pool": r.get("total_pool", 400),
                    "opponent": {
                        "uid": other_uid,
                        "username": opp_info.get("username", "Opponent"),
                        "avatar": opp_info.get("avatar", "🎮")
                    }
                })
                break

    async def unregister_user(self, uid: str):
        if uid not in self.connected_users:
            return

        user_info = self.connected_users[uid]
        current_room_id = user_info.get("current_room")
        if not current_room_id:
            for r_id, r in self.rooms.items():
                if (r.get("player1", {}).get("uid") == uid or r.get("player2", {}).get("uid") == uid) and not r.get("settled"):
                    current_room_id = r_id
                    break

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

    def get_user_status_info(self, uid: str) -> dict:
        if uid not in self.connected_users:
            return {
                "online": False,
                "status": "offline",
                "isPlaying": False,
                "activity": "Offline",
                "gameName": ""
            }

        u = self.connected_users[uid]
        raw_status = u.get("status", "idle")
        game_name = u.get("game_name", "")

        is_playing = raw_status in ("playing_solo", "in_game", "in_lobby", "queueing", "playing")

        activity = "Online now"
        if raw_status in ("playing_solo", "in_game", "playing"):
            activity = f"Playing {game_name}" if game_name else "In a game"
        elif raw_status == "queueing":
            activity = "Searching for match"
        elif raw_status == "in_lobby":
            activity = "In match lobby"

        return {
            "online": True,
            "status": raw_status,
            "isPlaying": is_playing,
            "activity": activity,
            "gameName": game_name
        }

    def set_user_status(self, uid: str, status: str, game_name: str = ""):
        if uid in self.connected_users:
            self.connected_users[uid]["status"] = status
            self.connected_users[uid]["game_name"] = game_name

    # ── Database User Profiles & Social ────────────────────────────────────────
    def _ensure_user_profile(self, uid: str, username: str = "Player", avatar: str = "🎮"):
        """Ensure the user has an initialized coins field, playerTag, and friend lists."""
        if not firebase_initialized or not firestore_db:
            return
        try:
            clean = "".join(c for c in uid if c.isalnum())[-5:].upper()
            tag = f"GS-{clean.rjust(5, '8')}"
            doc_ref = firestore_db.collection("users").document(uid)
            doc = doc_ref.get()
            updates = {
                "uid": uid,
                "playerTag": tag,
                "playerTag_lowercase": tag.lower(),
            }
            if username and username not in ("Player", "Guest Player", "guest_temp"):
                existing_username = (doc.to_dict() or {}).get("username") if doc.exists else None
                # Do not overwrite an existing custom username with a generic Guest_XXXX name
                if not (existing_username and not existing_username.startswith("Guest_") and username.startswith("Guest_")):
                    updates["username"] = username
                    updates["username_lowercase"] = username.lower()
            if avatar:
                updates["avatar"] = avatar

            if doc.exists:
                data = doc.to_dict() or {}
                if "coins" not in data:
                    updates["coins"] = INITIAL_USER_COINS
                if "friends" not in data:
                    updates["friends"] = []
                if "incomingFriendRequests" not in data:
                    updates["incomingFriendRequests"] = []
                if "outgoingFriendRequests" not in data:
                    updates["outgoingFriendRequests"] = []
            else:
                updates["coins"] = INITIAL_USER_COINS
                updates["friends"] = []
                updates["incomingFriendRequests"] = []
                updates["outgoingFriendRequests"] = []

            doc_ref.set(updates, merge=True)
        except Exception as e:
            logger.warning(f"Error ensuring profile for {uid}: {e}")

    def _ensure_user_coins(self, uid: str):
        self._ensure_user_profile(uid)

    async def send_friend_request(self, sender: dict, target_user: dict) -> bool:
        if not firebase_initialized or not firestore_db:
            return False
        sender_uid = sender.get("uid")
        target_uid = target_user.get("uid")
        if not sender_uid or not target_uid or sender_uid == target_uid:
            return False
        try:
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            clean_s = "".join(c for c in sender_uid if c.isalnum())[-5:].upper()
            sender_tag = sender.get("playerTag") or f"GS-{clean_s.rjust(5, '8')}"
            clean_t = "".join(c for c in target_uid if c.isalnum())[-5:].upper()
            target_tag = target_user.get("playerTag") or f"GS-{clean_t.rjust(5, '8')}"

            incoming_payload = {
                "uid": sender_uid,
                "username": sender.get("username") or "Player",
                "avatar": sender.get("avatar") or "🎮",
                "playerTag": sender_tag,
                "sentAt": now,
            }
            outgoing_payload = {
                "uid": target_uid,
                "username": target_user.get("username") or "Player",
                "avatar": target_user.get("avatar") or "🎮",
                "playerTag": target_tag,
                "sentAt": now,
            }

            from firebase_admin import firestore as fa_firestore
            target_ref = firestore_db.collection("users").document(target_uid)
            sender_ref = firestore_db.collection("users").document(sender_uid)

            target_ref.set({
                "incomingFriendRequests": fa_firestore.ArrayUnion([incoming_payload])
            }, merge=True)

            sender_ref.set({
                "outgoingFriendRequests": fa_firestore.ArrayUnion([outgoing_payload])
            }, merge=True)

            if target_uid in self.connected_users:
                ws = self.connected_users[target_uid]["ws"]
                await ws.send_json({
                    "type": "FRIEND_REQUEST_RECEIVED",
                    "request": incoming_payload
                })

            return True
        except Exception as e:
            logger.error(f"Error sending friend request: {e}")
            return False

    async def accept_friend_request(self, my_uid: str, requester_uid: str) -> bool:
        if not firebase_initialized or not firestore_db:
            return False
        try:
            from firebase_admin import firestore as fa_firestore
            my_ref = firestore_db.collection("users").document(my_uid)
            req_ref = firestore_db.collection("users").document(requester_uid)

            my_doc = my_ref.get()
            req_doc = req_ref.get()

            if my_doc.exists:
                my_data = my_doc.to_dict() or {}
                updated_incoming = [r for r in my_data.get("incomingFriendRequests", []) if r.get("uid") != requester_uid]
                my_ref.set({
                    "incomingFriendRequests": updated_incoming,
                    "friends": fa_firestore.ArrayUnion([requester_uid])
                }, merge=True)

            if req_doc.exists:
                req_data = req_doc.to_dict() or {}
                updated_outgoing = [r for r in req_data.get("outgoingFriendRequests", []) if r.get("uid") != my_uid]
                req_ref.set({
                    "outgoingFriendRequests": updated_outgoing,
                    "friends": fa_firestore.ArrayUnion([my_uid])
                }, merge=True)

            if requester_uid in self.connected_users:
                ws = self.connected_users[requester_uid]["ws"]
                await ws.send_json({
                    "type": "FRIEND_REQUEST_ACCEPTED",
                    "friendUid": my_uid
                })

            return True
        except Exception as e:
            logger.error(f"Error accepting friend request: {e}")
            return False

    async def decline_friend_request(self, my_uid: str, requester_uid: str) -> bool:
        if not firebase_initialized or not firestore_db:
            return False
        try:
            my_ref = firestore_db.collection("users").document(my_uid)
            req_ref = firestore_db.collection("users").document(requester_uid)

            my_doc = my_ref.get()
            if my_doc.exists:
                my_data = my_doc.to_dict() or {}
                updated_incoming = [r for r in my_data.get("incomingFriendRequests", []) if r.get("uid") != requester_uid]
                my_ref.set({"incomingFriendRequests": updated_incoming}, merge=True)

            req_doc = req_ref.get()
            if req_doc.exists:
                req_data = req_doc.to_dict() or {}
                updated_outgoing = [r for r in req_data.get("outgoingFriendRequests", []) if r.get("uid") != my_uid]
                req_ref.set({"outgoingFriendRequests": updated_outgoing}, merge=True)

            return True
        except Exception as e:
            logger.error(f"Error declining friend request: {e}")
            return False

    async def cancel_friend_request(self, my_uid: str, target_uid: str) -> bool:
        if not firebase_initialized or not firestore_db:
            return False
        try:
            my_ref = firestore_db.collection("users").document(my_uid)
            target_ref = firestore_db.collection("users").document(target_uid)

            my_doc = my_ref.get()
            if my_doc.exists:
                my_data = my_doc.to_dict() or {}
                updated_outgoing = [r for r in my_data.get("outgoingFriendRequests", []) if r.get("uid") != target_uid]
                my_ref.set({"outgoingFriendRequests": updated_outgoing}, merge=True)

            target_doc = target_ref.get()
            if target_doc.exists:
                target_data = target_doc.to_dict() or {}
                updated_incoming = [r for r in target_data.get("incomingFriendRequests", []) if r.get("uid") != my_uid]
                target_ref.set({"incomingFriendRequests": updated_incoming}, merge=True)

            return True
        except Exception as e:
            logger.error(f"Error canceling friend request: {e}")
            return False

    async def remove_friend(self, my_uid: str, friend_uid: str) -> bool:
        if not firebase_initialized or not firestore_db:
            return False
        try:
            from firebase_admin import firestore as fa_firestore
            my_ref = firestore_db.collection("users").document(my_uid)
            friend_ref = firestore_db.collection("users").document(friend_uid)

            my_ref.set({"friends": fa_firestore.ArrayRemove([friend_uid])}, merge=True)
            friend_ref.set({"friends": fa_firestore.ArrayRemove([my_uid])}, merge=True)
            return True
        except Exception as e:
            logger.error(f"Error removing friend: {e}")
            return False

    async def send_coin_requests(self, sender: dict, target_friend_uids: List[str], amount: int, date_str: str) -> bool:
        if not firebase_initialized or not firestore_db:
            return True
        sender_uid = sender.get("uid")
        if not sender_uid or not target_friend_uids:
            return False
        try:
            from firebase_admin import firestore as fa_firestore
            sender_ref = firestore_db.collection("users").document(sender_uid)
            sender_ref.set({
                "lastCoinRequestDate": date_str,
                "lastCoinRequestTimestamp": int(time.time() * 1000)
            }, merge=True)

            for f_uid in target_friend_uids:
                friend_ref = firestore_db.collection("users").document(f_uid)
                req_id = f"cr_{sender_uid}_{int(time.time()*1000)}_{random.randint(100, 999)}"
                payload = {
                    "id": req_id,
                    "fromUid": sender_uid,
                    "fromUsername": sender.get("username", "Player"),
                    "fromAvatar": sender.get("avatar", "🎮"),
                    "fromPlayerTag": sender.get("playerTag", "GS-0000"),
                    "amount": amount,
                    "createdAt": int(time.time() * 1000),
                    "dateStr": date_str
                }
                friend_ref.set({
                    "incomingCoinRequests": fa_firestore.ArrayUnion([payload])
                }, merge=True)
            return True
        except Exception as e:
            logger.error(f"Error sending coin requests: {e}")
            return False

    async def accept_coin_request(self, my_uid: str, from_uid: str, request_id: str, amount: int = 400) -> bool:
        if not firebase_initialized or not firestore_db:
            return True
        try:
            from firebase_admin import firestore as fa_firestore
            my_ref = firestore_db.collection("users").document(my_uid)
            my_doc = my_ref.get()
            if my_doc.exists:
                data = my_doc.to_dict() or {}
                incoming = data.get("incomingCoinRequests", [])
                updated = [r for r in incoming if r.get("id") != request_id and r.get("fromUid") != from_uid]
                my_ref.update({"incomingCoinRequests": updated})

            # Award bonus coins to requester without deducting from the accepting friend
            requester_ref = firestore_db.collection("users").document(from_uid)
            requester_ref.set({
                "coins": fa_firestore.Increment(amount)
            }, merge=True)
            logger.info(f"Granted {amount} coins bonus to {from_uid} from friend {my_uid}")
            return True
        except Exception as e:
            logger.error(f"Error accepting coin request: {e}")
            return False

    async def decline_coin_request(self, my_uid: str, request_id: str) -> bool:
        if not firebase_initialized or not firestore_db:
            return True
        try:
            my_ref = firestore_db.collection("users").document(my_uid)
            my_doc = my_ref.get()
            if my_doc.exists:
                data = my_doc.to_dict() or {}
                incoming = data.get("incomingCoinRequests", [])
                updated = [r for r in incoming if r.get("id") != request_id]
                my_ref.update({"incomingCoinRequests": updated})
            return True
        except Exception as e:
            logger.error(f"Error declining coin request: {e}")
            return False

    def search_users(self, query_str: str, current_uid: str = "") -> list:
        if not firebase_initialized or not firestore_db:
            return []
        raw = query_str.strip()
        if raw.startsWith("#") if hasattr(raw, "startsWith") else raw.startswith("#"):
            raw = raw[1:]
        q_lower = raw.lower()
        if len(q_lower) < 2:
            return []

        results = {}
        try:
            users_coll = firestore_db.collection("users")
            docs1 = users_coll.where("playerTag_lowercase", "==", q_lower).limit(5).stream()
            for d in docs1:
                if d.id != current_uid:
                    data = d.to_dict() or {}
                    results[d.id] = {
                        "uid": d.id,
                        "username": data.get("username", "Player"),
                        "avatar": data.get("avatar", "🎮"),
                        "playerTag": data.get("playerTag", f"GS-{d.id[-5:].upper()}"),
                        "level": data.get("level", 1)
                    }

            docs2 = users_coll.where("playerTag", "==", raw.upper()).limit(5).stream()
            for d in docs2:
                if d.id != current_uid and d.id not in results:
                    data = d.to_dict() or {}
                    results[d.id] = {
                        "uid": d.id,
                        "username": data.get("username", "Player"),
                        "avatar": data.get("avatar", "🎮"),
                        "playerTag": data.get("playerTag", f"GS-{d.id[-5:].upper()}"),
                        "level": data.get("level", 1)
                    }

            docs3 = users_coll.where("username_lowercase", ">=", q_lower).where("username_lowercase", "<=", q_lower + "\uf8ff").limit(10).stream()
            for d in docs3:
                if d.id != current_uid and d.id not in results:
                    data = d.to_dict() or {}
                    results[d.id] = {
                        "uid": d.id,
                        "username": data.get("username", "Player"),
                        "avatar": data.get("avatar", "🎮"),
                        "playerTag": data.get("playerTag", f"GS-{d.id[-5:].upper()}"),
                        "level": data.get("level", 1)
                    }

            clean_code = "".join(c for c in raw if c.isalnum()).upper()
            if len(clean_code) >= 3:
                all_docs = users_coll.limit(60).stream()
                for d in all_docs:
                    if d.id != current_uid and d.id not in results:
                        uid_clean = "".join(c for c in d.id if c.isalnum())[-5:].upper()
                        gen_tag = f"GS-{uid_clean.rjust(5, '8')}"
                        data = d.to_dict() or {}
                        d_tag = data.get("playerTag", gen_tag)
                        if clean_code in d_tag.replace("-", "").upper() or clean_code in uid_clean:
                            results[d.id] = {
                                "uid": d.id,
                                "username": data.get("username", "Player"),
                                "avatar": data.get("avatar", "🎮"),
                                "playerTag": d_tag,
                                "level": data.get("level", 1)
                            }
        except Exception as e:
            logger.error(f"Error searching users: {e}")

        return list(results.values())

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

    async def submit_final_score(self, room_id: str, uid: str, final_score: int, reason: str = "game_over"):
        room = self.rooms.get(room_id)
        if not room or room["settled"]:
            return

        if room["player1"]["uid"] == uid:
            room["player1"]["score"] = final_score
            room["player1"]["finished"] = True
            room["player1"]["reason"] = reason
            other_uid = room["player2"]["uid"]
        elif room["player2"]["uid"] == uid:
            room["player2"]["score"] = final_score
            room["player2"]["finished"] = True
            room["player2"]["reason"] = reason
            other_uid = room["player1"]["uid"]
        else:
            return

        # Settle match immediately upon any player game over
        if reason in ("bomb", "miss", "defeat", "game_over"):
            await self.settle_match(room_id, default_winner_uid=other_uid)
        else:
            await self.settle_match(room_id)

    async def settle_match(self, room_id: str, default_winner_uid: Optional[str] = None, forfeit_uid: Optional[str] = None):
        room = self.rooms.get(room_id)
        if not room or room["settled"]:
            return

        room["settled"] = True
        room["state"] = "FINISHED"

        # Cancel any active disconnect timer for this room
        timer = self.disconnect_timers.pop(room_id, None)
        if timer and not timer.done():
            timer.cancel()
        room.pop("disconnect_grace", None)

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
            "forfeit": forfeit_uid is not None,
            "forfeitUid": forfeit_uid,
            "reason": "OPPONENT_LEFT" if forfeit_uid else ("SCORE" if not default_winner_uid else "GAME_OVER"),
            "player1": {"uid": p1["uid"], "username": p1["username"], "avatar": p1["avatar"], "score": score1},
            "player2": {"uid": p2["uid"], "username": p2["username"], "avatar": p2["avatar"], "score": score2},
            "coinsWon": coins_won,
            "tier": room.get("tier", "bronze"),
            "pool": pool
        })

    async def start_disconnect_grace_period(self, room_id: str, exiting_uid: str, other_uid: str):
        room = self.rooms.get(room_id)
        if not room or room.get("settled") or room.get("state") != "PLAYING":
            return

        # If grace period already active for this room:
        if room.get("disconnect_grace"):
            # If the other player also disconnects/leaves
            if room["disconnect_grace"].get("exiting_uid") != exiting_uid:
                logger.info(f"Both players disconnected from room {room_id}. Settling as draw.")
                timer = self.disconnect_timers.pop(room_id, None)
                if timer and not timer.done():
                    timer.cancel()
                await self.settle_match(room_id, default_winner_uid="DRAW")
            return

        room["disconnect_grace"] = {
            "exiting_uid": exiting_uid,
            "other_uid": other_uid,
            "start_time": time.time(),
            "duration": 5
        }

        logger.info(f"Started 5s disconnect grace timer for player {exiting_uid} in room {room_id}")

        # Notify remaining player with grace countdown
        await self.send_to_user(other_uid, {
            "type": "OPPONENT_DISCONNECTED_GRACE",
            "roomId": room_id,
            "opponentUid": exiting_uid,
            "secondsRemaining": 5,
            "message": "Opponent disconnected or left. Waiting 5s for them to return..."
        })

        # Cancel any previous timer
        if room_id in self.disconnect_timers:
            t = self.disconnect_timers.pop(room_id)
            if not t.done():
                t.cancel()

        self.disconnect_timers[room_id] = asyncio.create_task(
            self._grace_period_countdown(room_id, exiting_uid, other_uid)
        )

    async def _grace_period_countdown(self, room_id: str, exiting_uid: str, other_uid: str):
        try:
            for s in range(5, 0, -1):
                await asyncio.sleep(1)
                room = self.rooms.get(room_id)
                if not room or room.get("settled") or room.get("state") != "PLAYING":
                    return
                grace = room.get("disconnect_grace")
                if not grace or grace.get("exiting_uid") != exiting_uid:
                    # Player reconnected and grace was cancelled
                    return

                # Send tick update to the remaining player
                await self.send_to_user(other_uid, {
                    "type": "OPPONENT_DISCONNECTED_TICK",
                    "roomId": room_id,
                    "secondsRemaining": s - 1
                })

            # 5s passed without returning!
            room = self.rooms.get(room_id)
            if not room or room.get("settled") or room.get("state") != "PLAYING":
                return

            logger.info(f"5s grace period expired for {exiting_uid} in room {room_id}. Declaring {other_uid} winner by forfeit!")
            room.pop("disconnect_grace", None)
            await self.settle_match(room_id, default_winner_uid=other_uid, forfeit_uid=exiting_uid)
        except asyncio.CancelledError:
            logger.info(f"Grace countdown cancelled for room {room_id}")
        finally:
            self.disconnect_timers.pop(room_id, None)

    async def handle_player_disconnect(self, room_id: str, disconnected_uid: str):
        room = self.rooms.get(room_id)
        if not room or room.get("settled"):
            return

        logger.info(f"Player {disconnected_uid} disconnected from room {room_id} in state {room['state']}")

        p1_uid = room["player1"]["uid"]
        p2_uid = room["player2"]["uid"]
        other_uid = p2_uid if disconnected_uid == p1_uid else p1_uid

        # If disconnected before match start (MATCH_FOUND, TIER_SELECTION, COUNTDOWN)
        if room["state"] in ("MATCH_FOUND", "TIER_SELECTION", "COUNTDOWN"):
            leaving_player = room["player1"] if disconnected_uid == p1_uid else room["player2"]
            leaving_name = leaving_player.get("username", "Friend")

            # Refund deducted coins if any
            if room.get("coins_deducted"):
                entry_fee = room.get("entry_fee", 0)
                if entry_fee > 0:
                    self.refund_coins(p1_uid, entry_fee)
                    self.refund_coins(p2_uid, entry_fee)
                room["coins_deducted"] = False

            await self.send_to_user(other_uid, {
                "type": "OPPONENT_LEFT",
                "message": f"{leaving_name} left the lobby.",
                "opponentName": leaving_name
            })
            if other_uid in self.connected_users and self.connected_users[other_uid].get("current_room") == room_id:
                self.connected_users[other_uid]["current_room"] = None
            del self.rooms[room_id]
        elif room["state"] == "PLAYING":
            # Wait 5 seconds for them to return before declaring remaining player winner
            await self.start_disconnect_grace_period(room_id, disconnected_uid, other_uid)

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
            p1_uid = room["player1"]["uid"]
            p2_uid = room["player2"]["uid"]
            p1_coins = self.get_user_coins(p1_uid)
            p2_coins = self.get_user_coins(p2_uid)

            # Determine rematch tier: prefer current tier, else fallback to bronze
            chosen_tier = room.get("tier", "bronze")
            if chosen_tier not in MATCH_TIERS:
                chosen_tier = "bronze"

            entry_fee = MATCH_TIERS[chosen_tier]["entry"]
            total_pool = MATCH_TIERS[chosen_tier]["pool"]

            # If players cannot afford the previous tier, fall back to bronze (200)
            if (p1_coins < entry_fee or p2_coins < entry_fee) and chosen_tier != "bronze":
                chosen_tier = "bronze"
                entry_fee = MATCH_TIERS["bronze"]["entry"]
                total_pool = MATCH_TIERS["bronze"]["pool"]

            # If both can afford the rematch entry fee, start countdown immediately
            if p1_coins >= entry_fee and p2_coins >= entry_fee:
                deducted = self.deduct_coins_atomic(p1_uid, p2_uid, entry_fee)
                if not deducted:
                    await self.broadcast_to_room(room_id, {
                        "type": "ERROR",
                        "message": "Coins transaction failed. Please return to lobby."
                    })
                    return

                room["seed"] = random.randint(1, 2147483647)
                room["state"] = "COUNTDOWN"
                room["tier"] = chosen_tier
                room["entry_fee"] = entry_fee
                room["total_pool"] = total_pool
                room["coins_deducted"] = True
                room["settled"] = False
                room["player1"]["score"] = 0
                room["player2"]["score"] = 0
                room["player1"]["finished"] = False
                room["player2"]["finished"] = False
                room["player1"]["tier_selected"] = chosen_tier
                room["player2"]["tier_selected"] = chosen_tier
                room["player1"]["play_again"] = False
                room["player2"]["play_again"] = False

                # Broadcast START_COUNTDOWN directly to both clients
                await self.broadcast_to_room(room_id, {
                    "type": "START_COUNTDOWN",
                    "roomId": room_id,
                    "seed": room["seed"],
                    "tier": room["tier"],
                    "entryFee": room["entry_fee"],
                    "totalPool": room["total_pool"],
                    "countdownSeconds": 3,
                    "gameDuration": 60
                })

                # Background task to start game after countdown
                asyncio.create_task(self._run_countdown_and_start(room_id))
            else:
                # If neither has enough coins for bronze, move to tier selection
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

                await self.broadcast_to_room(room_id, {
                    "type": "MOVE_TO_TIER_SELECTION",
                    "roomId": room_id,
                    "tiers": MATCH_TIERS,
                    "player1Coins": p1_coins,
                    "player2Coins": p2_coins,
                    "message": "One or both players have insufficient coins. Please choose stakes."
                })

    async def leave_room(self, room_id: str, uid: str):
        room = self.rooms.get(room_id)
        if not room:
            return
        p1_uid = room["player1"]["uid"]
        p2_uid = room["player2"]["uid"]
        other_uid = p2_uid if uid == p1_uid else p1_uid

        if room["state"] == "PLAYING" and not room.get("settled"):
            logger.info(f"Player {uid} left room {room_id} mid-match! Starting 5s grace timer.")
            await self.start_disconnect_grace_period(room_id, uid, other_uid)
            return

        leaving_player = room["player1"] if uid == p1_uid else room["player2"]
        leaving_name = leaving_player.get("username", "Friend")

        # If in pre-game lobby states (MATCH_FOUND, TIER_SELECTION, COUNTDOWN)
        if room["state"] in ("MATCH_FOUND", "TIER_SELECTION", "COUNTDOWN"):
            if room.get("coins_deducted"):
                entry_fee = room.get("entry_fee", 0)
                if entry_fee > 0:
                    self.refund_coins(p1_uid, entry_fee)
                    self.refund_coins(p2_uid, entry_fee)
                room["coins_deducted"] = False

            await self.send_to_user(other_uid, {
                "type": "OPPONENT_LEFT",
                "message": f"{leaving_name} left the lobby.",
                "opponentName": leaving_name
            })
            if uid in self.connected_users and self.connected_users[uid].get("current_room") == room_id:
                self.connected_users[uid]["current_room"] = None
            if other_uid in self.connected_users and self.connected_users[other_uid].get("current_room") == room_id:
                self.connected_users[other_uid]["current_room"] = None
            del self.rooms[room_id]
            return

        # Notify the other player that opponent left
        await self.send_to_user(other_uid, {
            "type": "OPPONENT_LEFT",
            "message": f"{leaving_name} left the lobby.",
            "opponentName": leaving_name
        })
        if uid in self.connected_users and self.connected_users[uid].get("current_room") == room_id:
            self.connected_users[uid]["current_room"] = None
        if other_uid in self.connected_users and self.connected_users[other_uid].get("current_room") == room_id:
            self.connected_users[other_uid]["current_room"] = None
        if room["state"] in ("FINISHED", "IDLE", "MATCH_FOUND"):
            del self.rooms[room_id]

    # ── Friend Invites ────────────────────────────────────────────────────────
    async def send_friend_invite(self, from_uid: str, to_uid: str, game_id: str):
        target_info = self.get_user_status_info(to_uid)
        if not target_info.get("online"):
            await self.send_to_user(from_uid, {
                "type": "INVITE_FAILED",
                "message": "Friend is currently offline."
            })
            return

        if target_info.get("isPlaying"):
            activity = target_info.get("activity") or "in a game"
            await self.send_to_user(from_uid, {
                "type": "INVITE_FAILED",
                "message": f"Friend is currently {activity.lower()}. Cannot send invites while playing."
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
