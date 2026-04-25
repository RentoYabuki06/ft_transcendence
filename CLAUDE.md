# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`cd backend`)
```bash
npm run dev          # tsx watch server.ts — hot-reload dev server
npm run build        # tsc (type-check + compile to dist/)
npm run lint         # tsc --noEmit (type-check only; no ESLint)
npm run setup        # prisma migrate deploy + seed (first-time init)
npm run migrate      # prisma migrate deploy
npm run seed         # tsx src/seed.ts
```

### Frontend (`cd frontend`)
```bash
npm run dev          # vite dev server on port 5173
npm run build        # tsc && vite build
npm run lint         # tsc --noEmit (type-check only; no ESLint)
```

### Docker (root)
```bash
docker compose up    # start nginx (8443/8080), frontend, backend
docker compose down
```

### E2E tests (backend must be running)
```bash
cd backend
node e2e-match.mjs        # 1v1 match + score
node e2e-tournament.mjs   # 4-player tournament
node e2e-chat.mjs         # DM real-time delivery
node e2e-friends.mjs      # friends + presence
node e2e-2fa.mjs          # 2FA setup + challenge login
```

There is no Jest/Vitest — only these hand-written `.mjs` E2E scripts.

## Architecture

### Services

```
Browser (HTTPS/WSS :8443)
  └─ nginx (reverse proxy)
       ├─ /api/*     → backend:3000   (REST + WebSocket)
       ├─ /uploads/* → backend:3000/uploads/*
       └─ /*         → frontend:5173  (Vite dev + HMR)
```

### Backend (`backend/`)

Entry point: `server.ts`. Fastify 5 + TypeScript, SQLite via Prisma 5.

**Route modules** (`src/routes/`): `auth`, `users`, `friends`, `blocks`, `messages`, `games`, `matchmaking`, `tournaments`, `achievements`, `twofa`, `websocket`, `legal`.

**Library** (`src/lib/`):
- `auth.ts` — `signToken`/`verifyToken` with `jsonwebtoken` (7-day tokens, no refresh)
- `middleware.ts` — `authenticate` preHandler reads `Authorization: Bearer <token>`, sets `request.userId`
- `gameEngine.ts` — server-authoritative Pong: 60 Hz physics tick, 30 Hz snapshot broadcast, swept collision detection, first to 11 wins
- `prisma.ts` — singleton Prisma client
- `mailer.ts` — nodemailer wrapper for OTP email

**WebSocket** (`src/routes/websocket.ts`) uses four in-memory maps (reset on restart): `presenceMap`, `matchmakingMap`, `gameInstances`, `chatMap`. Endpoints: `WS /ws/presence`, `WS /ws/matchmaking`, `WS /ws/game/:id`, `WS /ws/chat`. WebSocket auth uses `?token=` query param.

**Game protocol**: client sends `input` (`{ up, down, serve, resign }`); server sends 30 Hz `snapshot` with compressed keys (`ball`, `pl`, `pr`, `sl`, `sr`, `p`, `ss`, `cd`, `w`) plus phase events (`game_start`, `game_finished`, `opponent_disconnected`, `paused`).

**Prisma output**: `generated/prisma/` (non-default). Multi-platform binary targets for Docker (linux-musl-arm64/amd64).

### Frontend (`frontend/`)

React 19 SPA with Vite 7 + Tailwind CSS 4 + Babylon.js 9 (3D game rendering).

**Context hierarchy** (`App.tsx`): `AuthProvider` → `PresenceProvider` → `ChatNotificationsProvider`.

**Key hooks/services**:
- `hooks/useAuth.tsx` — auth context; JWT stored in `sessionStorage` under key `auth_token`
- `hooks/usePresence.tsx` — presence WebSocket, auto-reconnects every 3 s
- `services/api.ts` — single `api` object for all `fetch` calls to `/api/*`
- `types/index.ts` — shared TypeScript interfaces

All API calls go through `/api/*`; Vite proxies these to the backend in dev.

### Authentication Flow

1. **Normal login**: `POST /api/auth/login` → JWT in `sessionStorage`
2. **2FA** (email OTP, not TOTP): login returns `{ requires2fa: true, tempToken }` → user enters 6-digit OTP → `POST /api/auth/2fa/challenge` → JWT. OTPs are bcrypt-hashed, 10-minute TTL, stored on the `Users` row.
3. **42 OAuth**: `GET /api/auth/42` → callback → JWT → frontend redirect

### Database

SQLite file at `backend/data/dev.db` (volume-mounted in Docker). Schema: `Statuses` (status master with `category+name` unique), `Users`, `Accounts` (auth provider: local / intra42), `Friendships` (pending/accepted), `Blocks`, `Messages`, `Tournaments`, `TournamentParticipants`, `WaitingRooms`, `Games`, `GameTypes`, `PlayerScores`, `Achievements`, `UserAchievements`.

`Users` and `Accounts` are separate: `Users` = profile, `Accounts` = auth credentials (one user can have multiple providers).

### Environment Variables (backend `.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path (`file:./data/dev.db`) |
| `JWT_SECRET` | JWT signing secret |
| `PORT` / `HOST` | Server bind (`3000` / `0.0.0.0`) |
| `INTRA42_CLIENT_ID/SECRET/REDIRECT_URI` | 42 OAuth |
| `FRONTEND_URL` | Used for CORS and OAuth redirects |

Frontend Vite vars (set in `docker-compose.yml`): `VITE_HOST`, `VITE_PORT`, `VITE_API_PROXY_PATH`, `VITE_API_TARGET`, `VITE_HMR_BEHIND_PROXY`.

## Key Gotchas

- **`speakeasy` is installed but unused** — 2FA uses email OTP (`nodemailer`) not TOTP despite what `BACKEND.md` documents.
- **Backend TypeScript strict mode**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` — all enabled.
- **Online presence is in-memory only** — WebSocket maps reset on server restart; no persistence.
- **`tsc --noEmit` is the linter** — there is no ESLint in this project.
