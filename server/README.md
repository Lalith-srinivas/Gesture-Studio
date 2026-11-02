# Gesture Studio Multiplayer Backend (FastAPI + WebSockets)

Real-time WebSocket server handling:
- Matchmaking queues (Random player matching)
- Direct friend invites & status presence
- Mulberry32 deterministic PRNG seed distribution
- Atomic Firestore coin deductions, refunds, and victory settlements

## Deploying to Render (Web Service)

1. **New Web Service** -> Connect your GitHub repo `Gesture-Studio`
2. **Settings**:
   - **Name**: `gesture-studio-backend` (or your choice)
   - **Environment**: `Python 3`
   - **Root Directory**: `server`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Copy and paste the entire JSON content of your `serviceAccountKey.json` as a single-line or multi-line string.
   - `PYTHON_VERSION`: `3.11.8` (or `3.10.x` / `3.12.x`)

*(Alternatively, if Root Directory is left as repository root `.`:)*
- **Build Command**: `pip install -r server/requirements.txt`
- **Start Command**: `uvicorn server.main:app --host 0.0.0.0 --port $PORT`

## Local Development
```bash
cd server
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
