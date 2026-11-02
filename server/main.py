import json
import logging
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from room_manager import RoomManager, MATCH_TIERS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FastAPIServer")

app = FastAPI(title="Gesture Studio Multiplayer WebSocket Server")

# Enable CORS for local Vite dev and Vercel production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

room_manager = RoomManager()

class FriendStatusRequest(BaseModel):
    friendUids: List[str]

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Gesture Studio Multiplayer Engine",
        "active_users": len(room_manager.connected_users),
        "active_rooms": len(room_manager.rooms),
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/tiers")
def get_tiers():
    return {"tiers": MATCH_TIERS}

@app.post("/api/friends/status")
def get_friends_status(req: FriendStatusRequest):
    status_map = {}
    for uid in req.friendUids:
        status_map[uid] = {
            "online": room_manager.is_user_online(uid),
            "status": room_manager.get_user_status(uid)
        }
    return {"friends": status_map}

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    uid: str = Query(...),
    username: str = Query("Player"),
    avatar: str = Query("🎮"),
    token: Optional[str] = Query(None)
):
    await websocket.accept()
    await room_manager.register_user(uid, websocket, username, avatar)

    # Send initial welcome & sync
    coins = room_manager.get_user_coins(uid)
    await websocket.send_json({
        "type": "CONNECTED",
        "uid": uid,
        "username": username,
        "avatar": avatar,
        "coins": coins,
        "tiers": MATCH_TIERS
    })

    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG"})

            elif msg_type == "JOIN_QUEUE":
                game_id = data.get("gameId", "fruit-ninja")
                await room_manager.join_queue(uid, game_id)
                await websocket.send_json({"type": "QUEUE_JOINED", "gameId": game_id})

            elif msg_type == "LEAVE_QUEUE":
                await room_manager.leave_queue(uid)
                await websocket.send_json({"type": "QUEUE_LEFT"})

            elif msg_type == "CONFIRM_MATCH":
                room_id = data.get("roomId")
                if room_id:
                    await room_manager.confirm_match(room_id, uid)

            elif msg_type == "SELECT_TIER":
                room_id = data.get("roomId")
                tier = data.get("tier")
                if room_id and tier:
                    await room_manager.select_tier(room_id, uid, tier)

            elif msg_type == "UPDATE_SCORE":
                room_id = data.get("roomId")
                score = data.get("score", 0)
                extra = data.get("extra")
                if room_id:
                    await room_manager.update_score(room_id, uid, score, extra)

            elif msg_type == "SUBMIT_FINAL_SCORE":
                room_id = data.get("roomId")
                score = data.get("score", 0)
                if room_id:
                    await room_manager.submit_final_score(room_id, uid, score)

            elif msg_type == "PLAY_AGAIN":
                room_id = data.get("roomId")
                if room_id:
                    await room_manager.play_again_request(room_id, uid)

            elif msg_type == "SEND_INVITE":
                to_uid = data.get("toUid")
                game_id = data.get("gameId", "fruit-ninja")
                if to_uid:
                    await room_manager.send_friend_invite(uid, to_uid, game_id)

            elif msg_type == "RESPOND_INVITE":
                invite_id = data.get("inviteId")
                accept = bool(data.get("accept"))
                if invite_id:
                    await room_manager.respond_to_invite(invite_id, uid, accept)

            elif msg_type == "CHECK_FRIENDS_STATUS":
                friend_uids = data.get("friendUids", [])
                status_map = {
                    f_uid: {
                        "online": room_manager.is_user_online(f_uid),
                        "status": room_manager.get_user_status(f_uid)
                    }
                    for f_uid in friend_uids
                }
                await websocket.send_json({
                    "type": "FRIENDS_STATUS",
                    "friends": status_map
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {uid}")
        await room_manager.unregister_user(uid)
    except Exception as e:
        logger.error(f"WebSocket error for {uid}: {e}")
        await room_manager.unregister_user(uid)

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
