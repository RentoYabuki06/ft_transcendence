*This project has been created as part of the 42 curriculum by ryabuki, timanish, myokono, pchung.*

---

# PongVerse — Multiplayer Pong Web Application

## Description

**PongVerse** is a real-time multiplayer Pong platform built as the final project of the 42 Common Core. The application lets users register, compete in 1v1 Pong matches on a server-authoritative game engine, climb a global leaderboard, and participate in bracket-style tournaments — all from a browser over HTTPS/WSS.

**Key features:**
- Real-time 2-player Pong (server-authoritative, 60 Hz physics tick, 30 Hz broadcast)
- WebSocket-based online presence, matchmaking queue, and live game sync
- Direct messaging between users with real-time delivery
- Friend system with online status tracking
- Tournament bracket system (4 or 8 players)
- User profiles with avatar upload, match history, leaderboard, and achievements
- Two-Factor Authentication via email OTP
- 42 Intranet OAuth 2.0 login
- GDPR: personal data export and anonymized account deletion
- Privacy Policy and Terms of Service pages
- Fully containerised — one command to run

---

## Instructions

### Prerequisites

| Tool | Version |
|---|---|
| Docker Desktop | ≥ 24 |
| Docker Compose | ≥ v2 (bundled with Docker Desktop) |

No Node.js or npm installation is required on the host.

### Environment setup

Copy the example file and fill in your secrets:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```dotenv
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="<replace-with-a-long-random-string>"
PORT=3000
HOST=0.0.0.0

# 42 OAuth — obtain from intra.42.fr → Applications
INTRA42_CLIENT_ID=""
INTRA42_CLIENT_SECRET=""
INTRA42_REDIRECT_URI="https://localhost:8443/api/auth/42/callback"
FRONTEND_URL="https://localhost:8443"

# SMTP — required for email OTP 2FA
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@example.com"
```

### Run (single command)

```bash
docker compose up        # 全サービス起動
docker compose down      # 停止
```

| URL | Description |
|---|---|
| https://localhost:8443 | Application (HTTPS) |
| https://localhost:8443/api | REST API |

> The TLS certificate is self-signed. On first visit, click **Advanced → Proceed** in Chrome.

### Stop

```bash
docker compose down
```

### E2E tests (backend must be running separately)

```bash
cd backend
node e2e-match.mjs        # 1v1 match + score recording
node e2e-tournament.mjs   # 4-player tournament flow
node e2e-chat.mjs         # DM real-time delivery
node e2e-friends.mjs      # friend requests + presence
node e2e-2fa.mjs          # 2FA setup + challenge login
```

---

## Team Information

| Login | Name | Role(s) |
|---|---|---|
| ryabuki | Rento Yabuki | Technical Lead + Developer |
| timanish | — | Project Manager + Developer |
| myokono | Mai Yokono | Product Owner + Developer |
| pchung | —  | Developer |

### Responsibilities

**ryabuki — Technical Lead + Developer**
Defined the overall technical architecture (service topology, WebSocket protocol, server-authoritative game engine). Responsible for backend core: game engine (`gameEngine.ts`), WebSocket routing, authentication (JWT + 2FA + 42 OAuth), matchmaking, and Docker/nginx setup. Led code reviews on critical backend changes.

**timanish — Project Manager + Developer**
Facilitated team meetings and tracked sprint progress. Implemented frontend pages: dashboard, ranking, match history, user profile, and friends. Ensured cross-browser compatibility and responsive layout.

**myokono — Product Owner + Developer**
Maintained the product backlog and feature priorities. Implemented tournament system (backend routes and frontend bracket UI), achievement system, and GDPR data export/deletion.

**pchung — Developer**
Implemented chat (DM), block feature, ProfileEdit page (avatar upload, password change, 2FA setup), and Privacy Policy / Terms of Service pages.

---

## Project Management

**Work organization:** The team used GitHub Issues to track tasks. Work was divided into one-week sprints. Each sprint began with a planning session (Discord voice) and ended with a brief retrospective.

**Task distribution:** Features were assigned by area — one member per module at a time to avoid merge conflicts. Pull requests required at least one reviewer before merge.

**Communication:** Discord (daily async updates + weekly voice call) and GitHub Issues/PRs for written records.

---

## Technical Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Dev server + bundler |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| Babylon.js | 9 | 3D graphics dependency (installed; game uses 2D canvas) |

### Backend
| Technology | Version | Role |
|---|---|---|
| Fastify | 5 | HTTP + WebSocket server |
| TypeScript | 5 | Type safety |
| Prisma | 5 | ORM + migrations |
| SQLite | — | Database |
| jsonwebtoken | — | JWT signing/verification |
| bcryptjs | — | Password hashing (cost 12) |
| nodemailer | — | Email OTP delivery |

### Infrastructure
| Technology | Role |
|---|---|
| nginx | Reverse proxy (HTTPS :8443, WSS) |
| Docker Compose | Single-command deployment |
| Self-signed TLS | HTTPS/WSS in development |

### Justification for major choices

- **Fastify over Express:** Native TypeScript types, built-in WebSocket plugin, and higher throughput with lower latency — important for game snapshot broadcasting at 30 Hz.
- **SQLite over PostgreSQL:** Sufficient for the load profile of this project; zero-configuration Docker volume mount (`./data/dev.db`) keeps the setup simple and the evaluation environment reproducible.
- **Prisma ORM:** Type-safe query builder with migration management; reduces raw SQL errors and accelerates schema iteration.
- **Server-authoritative game model:** Prevents cheating and resolves collisions consistently regardless of client frame rate or network jitter.

---

## Database Schema

### Tables and relationships

```
Statuses        — status master (category + name unique)
  ↑ referenced by: Users, Accounts, Games, GameTypes,
                   Tournaments, WaitingRooms, WaitingRoomParticipants, PlayerScores

Users           — user profile (id, email, nickname, pictureURL, statusId, 2FA fields)
  ↓ auth:    Accounts (1 user → many providers: local, intra42)
  ↓ games:   PlayerScores (1 user → many game results)
  ↓ social:  Friendships (userId ↔ friendId, status: pending|accepted)
             Blocks      (userId blocks blockedId)
             Messages    (senderId → receiverId)
  ↓ games:   UserAchievements (userId + achievementId, unlockedAt)
  ↓ tourney: TournamentParticipants (tournamentId + userId)

Tournaments     — (id, name, createdBy, maxParticipants: 4|8, statusId)
  ↓ TournamentParticipants (tournamentId, userId, alias)
  ↓ Games (tournamentId nullable — NULL = casual match)

Games           — (id, tournamentId?, round, order, playerNum, gameTypeId, winnerId?, statusId)
  ↓ PlayerScores (gameId, userId, score, isWinner)
  ↓ GameTypes (id, gameType)

WaitingRooms    — matchmaking lobby (id, name, adminUserId, statusId)
  ↓ WaitingRoomParticipants (waitingRoomId, userId, statusId)

Achievements    — master (id, key, name, description, icon)
  ↓ UserAchievements (userId, achievementId, unlockedAt)
```

### Key fields

| Table | Key fields |
|---|---|
| Users | `id PK`, `email UNIQUE`, `nickname UNIQUE`, `statusId FK`, `isTwoFactorEnabled` |
| Accounts | `userId FK`, `provider` (local\|intra42), `providerAccountId`, `passwordHash?` — UNIQUE(provider, providerAccountId) |
| Games | `id PK`, `tournamentId?`, `round`, `order`, `winnerId?`, `statusId FK` |
| PlayerScores | `gameId FK`, `userId FK`, `score`, `isWinner` |
| Friendships | `userId FK`, `friendId FK`, `status` (pending\|accepted) — UNIQUE(userId, friendId) |
| Messages | `senderId FK`, `receiverId FK`, `body`, `readAt?`, indexed on (sender,receiver,createdAt) |
| UserAchievements | `userId FK`, `achievementId FK`, `unlockedAt` — UNIQUE(userId, achievementId) |

---

## Features List

| Feature | Description | Team member(s) |
|---|---|---|
| User registration / login | Email + bcrypt (cost 12) password auth; JWT stored in sessionStorage | ryabuki |
| 42 OAuth login | OAuth 2.0 via 42 Intranet; merges into existing account if email matches | ryabuki |
| Two-Factor Authentication | Email OTP (6 digits, bcrypt-hashed, 10-min TTL); optional per user | ryabuki, pchung |
| Profile editing | Nickname, email, password, avatar upload (JPEG/PNG/GIF/WebP, max 5 MB) | pchung |
| User profile page | Displays stats, avatar, match history for any user | timanish |
| Online presence | WebSocket heartbeat; friends see online/offline in real time | ryabuki |
| Friend system | Send/accept/cancel/remove requests; see friends list with online status | timanish |
| Block feature | Block/unblock users; blocks prevent messaging and matchmaking | pchung |
| Direct messaging (DM) | Real-time 1-to-1 chat over WebSocket; history persisted in DB | pchung |
| Matchmaking queue | Auto-pairs waiting players; excludes blocked opponents | ryabuki |
| Pong game (2D) | Server-authoritative, 60 Hz physics, 30 Hz snapshot broadcast, first to 11 | ryabuki |
| Game reconnection | Rejoin an in-progress game within a grace window after disconnect | ryabuki |
| Tournament system | Create 4/8-player brackets; auto-advance rounds; registration flow | myokono |
| Match history | Paginated list of past games with opponent, score, result, date | timanish |
| Leaderboard (ranking) | Global ranking by wins; shows win rate and level | timanish |
| Achievement system | Unlock achievements on milestones; displayed on dashboard | myokono |
| Level system | Player level = wins / 5 + 1; shown on profile and ranking | timanish, myokono |
| GDPR data export | `GET /api/users/me/export` — downloads full user data as JSON | myokono |
| GDPR account deletion | `DELETE /api/users/me` — anonymises personal data, retains game records | myokono |
| Privacy Policy | Static page accessible from footer | pchung |
| Terms of Service | Static page accessible from footer | pchung |
| Responsive layout | Works on desktop, tablet, and mobile (keyboard + touch controls) | timanish |
| Docker deployment | Single `docker compose up` starts nginx + frontend + backend | ryabuki |

---

## Modules

**Total: 17 points** (14 mandatory + 3 bonus)

### Major modules (2 pts each)

| Module | Category | Implementation | Team member(s) |
|---|---|---|---|
| Use frameworks for both frontend and backend | Web | React 19 (frontend) + Fastify 5 (backend) | ryabuki, timanish |
| Real-time features using WebSockets | Web | Four WebSocket endpoints: `/ws/presence`, `/ws/matchmaking`, `/ws/game/:id`, `/ws/chat`; graceful disconnect handling; efficient broadcasting | ryabuki |
| Allow users to interact with other users | Web | DM chat (send/receive), profile pages (view any user), friend system (add/remove/accept) | pchung, timanish |
| Standard user management and authentication | User Management | Profile update, avatar upload with default fallback, friends with online status, dedicated profile page | ryabuki, pchung, timanish |
| Implement a complete web-based game | Gaming | 2D Pong: server-authoritative 60 Hz engine, swept collision detection, serve mechanic, first to 11 wins, 2D canvas rendering | ryabuki |

**Major subtotal: 10 pts**

### Minor modules (1 pt each)

| Module | Category | Implementation | Team member(s) |
|---|---|---|---|
| Use an ORM for the database | Web | Prisma 5 with SQLite; typed queries, migration management | ryabuki |
| Game statistics and match history | User Management | Win/loss counts, win rate, level, paginated match history table, leaderboard | timanish, myokono |
| Remote authentication (OAuth 2.0) | User Management | 42 Intranet OAuth; JWT issued on callback; links to existing account by email | ryabuki |
| Two-Factor Authentication (2FA) | User Management | Email OTP: 6-digit code, bcrypt-hashed, 10-min TTL; per-user opt-in | ryabuki, pchung |
| Tournament system | Gaming | 4 or 8-player single-elimination brackets; auto-advance on game completion; registration/alias system | myokono |
| Gamification system | Gaming | Achievements (DB-persistent, unlock on milestone), leaderboard, XP/level system (wins/5+1) — 3 features implemented with visual feedback on dashboard | myokono, timanish |
| GDPR compliance features | Data & Analytics | Data export (JSON download of all personal data); anonymised account deletion (email/nickname replaced, credentials purged, game records retained for leaderboard integrity) | myokono |

**Minor subtotal: 7 pts**

**Grand total: 17 pts**

---

## Individual Contributions

### ryabuki (Rento Yabuki) — Technical Lead + Developer
- Designed and implemented the server-authoritative game engine (`backend/src/lib/gameEngine.ts`): 60 Hz physics loop, swept AABB collision, adaptive ball speed, round management, and snapshot serialisation.
- Built all four WebSocket endpoints (`websocket.ts`): game sync at 30 Hz, presence broadcasting, matchmaking queue pairing, real-time chat delivery.
- Implemented the full authentication stack: JWT signing/verification, 42 OAuth flow, 2FA challenge/setup routes, bcrypt password handling.
- Set up Docker Compose, nginx reverse proxy (HTTPS/WSS), and multi-platform Prisma binary targets for ARM/AMD Docker images.
- Wrote all five E2E test scripts (`.mjs`).
- **Key challenge:** Eliminating paddle tunnelling and snapshot drift in the server-authoritative model. Solved with swept collision detection and position correction at each physics tick.

### timanish — Project Manager + Developer
- Built frontend pages: Dashboard, Ranking (leaderboard), Match History, User Profile view, and Friends page.
- Implemented presence indicators and friend online-status display across the UI.
- Ensured responsive design across all pages (Tailwind CSS breakpoints, mobile touch controls for game).
- Managed sprint planning, GitHub Issues triage, and PR review coordination.
- **Key challenge:** Keeping friend presence state in sync with backend WebSocket events without introducing stale reads; solved with a reactive `usePresence` hook and periodic reconciliation.

### myokono (Mai Yokono) — Product Owner + Developer
- Built the complete tournament system: backend routes (`tournaments.ts`, 16 KB), frontend bracket UI (TournamentListPage, TournamentDetailPage), and automatic round advancement logic.
- Implemented the achievement system (backend route + seed data) and the gamification display on the Dashboard.
- Implemented GDPR features: full JSON data export endpoint and transactional anonymised account deletion.
- Maintained the product backlog and feature priorities throughout the project.
- **Key challenge:** Bracket auto-advancement required correctly determining when all games in a round were resolved; solved with a database query that counts unfinished games per round.

### pchung — Developer
- Implemented DM chat: backend `messages.ts` route and frontend ChatPage with real-time WebSocket delivery.
- Built the block system (`blocks.ts`): bidirectional enforcement (messaging and matchmaking exclusion).
- Implemented ProfileEditPage: avatar upload with type/size validation, nickname/email/password change, and 2FA enable/disable.
- Created Privacy Policy and Terms of Service pages (`legal.ts` backend + frontend pages).
- **Key challenge:** Ensuring that blocked users are correctly excluded from both chat delivery and matchmaking queue pairings without adding per-request database overhead; solved by caching the blocked-user set on the WebSocket connection.

---

## Resources

### References
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vite.dev/guide/)
- [WebSocket API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [HTML Canvas 2D API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [JWT Introduction](https://jwt.io/introduction)
- [42 API Documentation](https://api.intra.42.fr/apidoc)
- [GDPR — Data subject rights](https://gdpr.eu/data-subject-rights/)
- [bcrypt — Password hashing](https://en.wikipedia.org/wiki/Bcrypt)

### AI Usage

Claude Code (Anthropic) was used throughout the project as a development assistant:

- **Architecture planning:** Discussed server-authoritative vs. client-side game model trade-offs; AI helped articulate the rationale for the swept-collision approach.
- **Code generation:** Used to scaffold boilerplate (Fastify route handlers, Prisma query patterns, React hooks); all generated code was reviewed, tested, and understood by the author before merging.
- **Debugging:** Pasted error traces and asked for diagnosis; AI suggestions were verified against actual runtime behaviour before applying.
- **Documentation:** Assisted in drafting this README structure and the Privacy Policy / Terms of Service content.
- **Test scripts:** E2E `.mjs` scripts were initially drafted with AI assistance, then manually validated against the running server.

All AI-generated content was reviewed and is fully understood by the team members who submitted it.

---

---
---

# 日本語訳 (Japanese Translation)

---

*このプロジェクトは、ryabuki, timanish, myokono, pchung によって 42 カリキュラムの一環として作成されました。*

---

# PongVerse — マルチプレイヤー Pong Web アプリケーション

## 説明

**PongVerse** は、42 Common Core の最終課題として構築されたリアルタイムマルチプレイヤー Pong プラットフォームです。ユーザーは登録後、サーバー権威型ゲームエンジンで 1v1 の Pong 対戦を行い、グローバルリーダーボードで競い合い、ブラケット形式のトーナメントに参加できます。すべて HTTPS/WSS 経由でブラウザから利用可能です。

**主な機能：**
- リアルタイム 2 人 Pong（サーバー権威型、60 Hz 物理演算、30 Hz ブロードキャスト）
- WebSocket によるオンラインプレゼンス・マッチメイキングキュー・ライブゲーム同期
- ユーザー間リアルタイムダイレクトメッセージ
- オンライン状態追跡付きフレンドシステム
- トーナメントブラケットシステム（4 人・8 人）
- アバターアップロード・マッチ履歴・リーダーボード・実績付きユーザープロフィール
- メール OTP による二段階認証（2FA）
- 42 Intranet OAuth 2.0 ログイン
- GDPR 対応：個人データエクスポートおよび匿名化アカウント削除
- プライバシーポリシーおよび利用規約ページ
- 完全コンテナ化 — コマンド 1 つで起動

---

## 実行手順

### 前提条件

| ツール | バージョン |
|---|---|
| Docker Desktop | ≥ 24 |
| Docker Compose | ≥ v2（Docker Desktop に同梱） |

ホスト側に Node.js や npm のインストールは不要です。

### 環境設定

サンプルファイルをコピーしてシークレットを設定します：

```bash
cp backend/.env.example backend/.env
```

`backend/.env` を編集：

```dotenv
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="<長いランダム文字列に置き換えてください>"
PORT=3000
HOST=0.0.0.0

# 42 OAuth — intra.42.fr → Applications から取得
INTRA42_CLIENT_ID=""
INTRA42_CLIENT_SECRET=""
INTRA42_REDIRECT_URI="https://localhost:8443/api/auth/42/callback"
FRONTEND_URL="https://localhost:8443"

# SMTP — メール OTP 2FA に必要
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@example.com"
```

### 起動（コマンド 1 つ）

```bash
docker compose up
```

| URL | 説明 |
|---|---|
| https://localhost:8443 | アプリケーション（HTTPS） |
| https://localhost:8443/api | REST API |

> TLS 証明書は自己署名です。初回アクセス時は Chrome で **「詳細設定」→「続行」** をクリックしてください。

### 停止

```bash
docker compose down
```

### E2E テスト（バックエンドを別途起動した状態で実行）

```bash
cd backend
node e2e-match.mjs        # 1v1 マッチング + スコア記録
node e2e-tournament.mjs   # 4 人トーナメントフロー
node e2e-chat.mjs         # DM リアルタイム配信
node e2e-friends.mjs      # フレンド申請 + プレゼンス
node e2e-2fa.mjs          # 2FA セットアップ + チャレンジログイン
```

---

## チーム情報

| ログイン | 氏名 | 役割 |
|---|---|---|
| ryabuki | Rento Yabuki | テクニカルリード + 開発者 |
| timanish | — | プロジェクトマネージャー + 開発者 |
| myokono | Mai Yokono | プロダクトオーナー + 開発者 |
| pchung | —  | 開発者 |

### 担当内容

**ryabuki — テクニカルリード + 開発者**
全体技術アーキテクチャ（サービス構成・WebSocket プロトコル・サーバー権威型ゲームエンジン）を設計。バックエンドコア（ゲームエンジン・WebSocket ルーティング・認証（JWT + 2FA + 42 OAuth）・マッチメイキング・Docker/nginx 構成）を担当。重要なバックエンド変更のコードレビューをリード。

**timanish — プロジェクトマネージャー + 開発者**
チームミーティングのファシリテーションとスプリント進捗管理。フロントエンドページ（ダッシュボード・ランキング・マッチ履歴・ユーザープロフィール・フレンド）を実装。クロスブラウザ対応とレスポンシブレイアウトを確保。

**myokono — プロダクトオーナー + 開発者**
プロダクトバックログと機能優先度の管理。トーナメントシステム（バックエンドルートとフロントエンドブラケット UI）・実績システム・GDPR データエクスポート/削除を実装。

**pchung — 開発者**
チャット（DM）・ブロック機能・ProfileEdit ページ（アバターアップロード・パスワード変更・2FA 設定）・プライバシーポリシー/利用規約ページを実装。

---

## プロジェクト管理

**作業組織：** GitHub Issues でタスクを管理。1 週間スプリントで分割。毎スプリント、Discord ボイスでプランニングとレトロスペクティブを実施。

**タスク分担：** マージ競合を避けるため、機能ごとに担当者を 1 人割り当て。プルリクエストはマージ前に最低 1 人のレビューが必要。

**コミュニケーション：** Discord（デイリー非同期 + 週次ボイス通話）および GitHub Issues/PR を文書記録として使用。

---

## 技術スタック

### フロントエンド
| 技術 | バージョン | 役割 |
|---|---|---|
| React | 19 | UI フレームワーク |
| Vite | 7 | 開発サーバー + バンドラー |
| TypeScript | 5 | 型安全性 |
| Tailwind CSS | 4 | スタイリング |
| Babylon.js | 9 | 3D グラフィックス依存関係（インストール済み；ゲームは 2D キャンバスを使用） |

### バックエンド
| 技術 | バージョン | 役割 |
|---|---|---|
| Fastify | 5 | HTTP + WebSocket サーバー |
| TypeScript | 5 | 型安全性 |
| Prisma | 5 | ORM + マイグレーション |
| SQLite | — | データベース |
| jsonwebtoken | — | JWT 署名/検証 |
| bcryptjs | — | パスワードハッシュ化（コスト 12） |
| nodemailer | — | メール OTP 配信 |

### インフラ
| 技術 | 役割 |
|---|---|
| nginx | リバースプロキシ（HTTPS :8443、WSS） |
| Docker Compose | ワンコマンドデプロイ |
| 自己署名 TLS | 開発環境 HTTPS/WSS |

### 主要な技術選択の根拠

- **Express ではなく Fastify：** ネイティブ TypeScript 型、組み込み WebSocket プラグイン、30 Hz ゲームスナップショット配信に重要な高スループット・低レイテンシ。
- **PostgreSQL ではなく SQLite：** 本プロジェクトの負荷プロファイルには十分。Docker ボリュームマウント（`./data/dev.db`）でセットアップをシンプルに保ち、評価環境を再現可能に。
- **Prisma ORM：** 型安全なクエリビルダーとマイグレーション管理。生 SQL エラーを削減し、スキーマ反復を加速。
- **サーバー権威型ゲームモデル：** クライアントフレームレートやネットワークジッターに関係なく、チート防止と一貫した衝突判定を実現。

---

## データベーススキーマ

### テーブルと関係

```
Statuses        — ステータスマスター（category + name ユニーク）
  ↑ 参照元: Users, Accounts, Games, GameTypes,
             Tournaments, WaitingRooms, WaitingRoomParticipants, PlayerScores

Users           — ユーザープロフィール（id, email, nickname, pictureURL, statusId, 2FA フィールド）
  ↓ 認証:    Accounts（1 ユーザー → 複数プロバイダー: local, intra42）
  ↓ ゲーム:  PlayerScores（1 ユーザー → 複数ゲーム結果）
  ↓ ソーシャル: Friendships（userId ↔ friendId, status: pending|accepted）
               Blocks（userId が blockedId をブロック）
               Messages（senderId → receiverId）
  ↓ 実績:    UserAchievements（userId + achievementId, unlockedAt）
  ↓ 大会:    TournamentParticipants（tournamentId + userId）

Tournaments     — （id, name, createdBy, maxParticipants: 4|8, statusId）
  ↓ TournamentParticipants（tournamentId, userId, alias）
  ↓ Games（tournamentId は nullable — NULL = カジュアルマッチ）

Games           — （id, tournamentId?, round, order, playerNum, gameTypeId, winnerId?, statusId）
  ↓ PlayerScores（gameId, userId, score, isWinner）
  ↓ GameTypes（id, gameType）

WaitingRooms    — マッチメイキングロビー（id, name, adminUserId, statusId）
  ↓ WaitingRoomParticipants（waitingRoomId, userId, statusId）

Achievements    — マスター（id, key, name, description, icon）
  ↓ UserAchievements（userId, achievementId, unlockedAt）
```

### 主要フィールド

| テーブル | 主要フィールド |
|---|---|
| Users | `id PK`, `email UNIQUE`, `nickname UNIQUE`, `statusId FK`, `isTwoFactorEnabled` |
| Accounts | `userId FK`, `provider`（local\|intra42）, `providerAccountId`, `passwordHash?` — UNIQUE(provider, providerAccountId) |
| Games | `id PK`, `tournamentId?`, `round`, `order`, `winnerId?`, `statusId FK` |
| PlayerScores | `gameId FK`, `userId FK`, `score`, `isWinner` |
| Friendships | `userId FK`, `friendId FK`, `status`（pending\|accepted）— UNIQUE(userId, friendId) |
| Messages | `senderId FK`, `receiverId FK`, `body`, `readAt?`、(sender,receiver,createdAt) でインデックス |
| UserAchievements | `userId FK`, `achievementId FK`, `unlockedAt` — UNIQUE(userId, achievementId) |

---

## 機能一覧

| 機能 | 説明 | 担当者 |
|---|---|---|
| ユーザー登録 / ログイン | メール + bcrypt（コスト 12）パスワード認証；JWT を sessionStorage に保存 | ryabuki |
| 42 OAuth ログイン | 42 Intranet 経由 OAuth 2.0；メールが一致する場合は既存アカウントにリンク | ryabuki |
| 二段階認証（2FA） | メール OTP（6 桁、bcrypt ハッシュ、10 分 TTL）；ユーザー任意で有効化 | ryabuki, pchung |
| プロフィール編集 | ニックネーム・メール・パスワード・アバターアップロード（JPEG/PNG/GIF/WebP、最大 5 MB） | pchung |
| ユーザープロフィールページ | 任意ユーザーの統計・アバター・マッチ履歴を表示 | timanish |
| オンラインプレゼンス | WebSocket ハートビート；フレンドがリアルタイムでオンライン/オフラインを確認可能 | ryabuki |
| フレンドシステム | 申請送信/承認/キャンセル/削除；オンライン状態付きフレンドリスト | timanish |
| ブロック機能 | ユーザーをブロック/解除；メッセージングとマッチメイキングを遮断 | pchung |
| ダイレクトメッセージ（DM） | WebSocket 経由 1 対 1 リアルタイムチャット；履歴を DB に永続化 | pchung |
| マッチメイキングキュー | 待機中のプレイヤーを自動ペアリング；ブロック済み相手を除外 | ryabuki |
| Pong ゲーム（2D） | サーバー権威型、60 Hz 物理演算、30 Hz スナップショット配信、先取 11 点 | ryabuki |
| ゲーム再接続 | 切断後のグレース期間内に進行中ゲームへ復帰可能 | ryabuki |
| トーナメントシステム | 4/8 人ブラケット作成；ゲーム完了時に自動次ラウンド進行；登録フロー | myokono |
| マッチ履歴 | 過去のゲームをページネーション付きで一覧表示（相手・スコア・結果・日付） | timanish |
| リーダーボード（ランキング） | 勝利数によるグローバルランキング；勝率とレベルを表示 | timanish |
| 実績システム | マイルストーンで実績をアンロック；ダッシュボードに表示 | myokono |
| レベルシステム | プレイヤーレベル = 勝利数 / 5 + 1；プロフィールとランキングに表示 | timanish, myokono |
| GDPR データエクスポート | `GET /api/users/me/export` — 全個人データを JSON でダウンロード | myokono |
| GDPR アカウント削除 | `DELETE /api/users/me` — 個人データを匿名化；ゲーム記録はリーダーボードのために保持 | myokono |
| プライバシーポリシー | フッターからアクセス可能な静的ページ | pchung |
| 利用規約 | フッターからアクセス可能な静的ページ | pchung |
| レスポンシブレイアウト | デスクトップ・タブレット・モバイル対応（キーボード + タッチコントロール） | timanish |
| Docker デプロイ | `docker compose up` 1 コマンドで nginx + フロントエンド + バックエンド起動 | ryabuki |

---

## モジュール

**合計：17 ポイント**（必須 14pt + ボーナス 3pt）

### Major モジュール（各 2pt）

| モジュール | カテゴリ | 実装内容 | 担当者 |
|---|---|---|---|
| フロントエンドとバックエンド両方にフレームワーク使用 | Web | React 19（フロントエンド）+ Fastify 5（バックエンド） | ryabuki, timanish |
| WebSocket によるリアルタイム機能 | Web | 4 つの WebSocket エンドポイント（`/ws/presence`・`/ws/matchmaking`・`/ws/game/:id`・`/ws/chat`）；切断の適切な処理；効率的なブロードキャスト | ryabuki |
| ユーザー間インタラクション | Web | DM チャット（送受信）・プロフィールページ（任意ユーザー閲覧）・フレンドシステム（追加/削除/承認） | pchung, timanish |
| 標準ユーザー管理と認証 | User Management | プロフィール更新・アバターアップロード（デフォルト表示あり）・オンライン状態付きフレンド・プロフィールページ | ryabuki, pchung, timanish |
| 完全な Web ゲームの実装 | Gaming | 2D Pong：サーバー権威型 60 Hz エンジン・スウェプト衝突判定・サーブ機能・先取 11 点・2D キャンバス描画 | ryabuki |

**Major 小計：10pt**

### Minor モジュール（各 1pt）

| モジュール | カテゴリ | 実装内容 | 担当者 |
|---|---|---|---|
| ORM 使用 | Web | Prisma 5 + SQLite；型安全クエリ・マイグレーション管理 | ryabuki |
| ゲーム統計とマッチ履歴 | User Management | 勝敗数・勝率・レベル・ページネーション付きマッチ履歴テーブル・リーダーボード | timanish, myokono |
| リモート認証（OAuth 2.0） | User Management | 42 Intranet OAuth；コールバック時に JWT を発行；メールによる既存アカウントへのリンク | ryabuki |
| 二段階認証（2FA） | User Management | メール OTP：6 桁コード・bcrypt ハッシュ・10 分 TTL；ユーザーごとに有効化 | ryabuki, pchung |
| トーナメントシステム | Gaming | 4/8 人シングルエリミネーションブラケット；ゲーム完了時の自動進行；登録/エイリアスシステム | myokono |
| ゲーミフィケーションシステム | Gaming | 実績（DB 永続・マイルストーンでアンロック）・リーダーボード・XP/レベルシステム（勝利数/5+1）— 3 機能をダッシュボードのビジュアルフィードバック付きで実装 | myokono, timanish |
| GDPR コンプライアンス機能 | Data & Analytics | データエクスポート（全個人データの JSON ダウンロード）；匿名化アカウント削除（メール/ニックネームを置換・認証情報を削除・ゲーム記録はリーダーボード整合性のために保持） | myokono |

**Minor 小計：7pt**

**合計：17pt**

---

## 個人の貢献

### ryabuki（Rento Yabuki）— テクニカルリード + 開発者
- サーバー権威型ゲームエンジン（`backend/src/lib/gameEngine.ts`）を設計・実装：60 Hz 物理ループ・スウェプト AABB 衝突・適応的ボール速度・ラウンド管理・スナップショットシリアライズ。
- 4 つの WebSocket エンドポイント（`websocket.ts`）を構築：30 Hz ゲーム同期・プレゼンスブロードキャスト・マッチメイキングキューペアリング・リアルタイムチャット配信。
- 認証スタック全体を実装：JWT 署名/検証・42 OAuth フロー・2FA チャレンジ/セットアップルート・bcrypt パスワード処理。
- Docker Compose・nginx リバースプロキシ（HTTPS/WSS）・ARM/AMD Docker イメージ向けマルチプラットフォーム Prisma バイナリターゲットをセットアップ。
- 5 つの E2E テストスクリプト（`.mjs`）を作成。
- **主な課題：** サーバー権威型モデルでのパドル貫通とスナップショットドリフトの排除。各物理ティックでスウェプト衝突判定と位置補正を使用して解決。

### timanish — プロジェクトマネージャー + 開発者
- フロントエンドページを構築：ダッシュボード・ランキング（リーダーボード）・マッチ履歴・ユーザープロフィールビュー・フレンドページ。
- プレゼンスインジケーターと UI 全体のフレンドオンライン状態表示を実装。
- 全ページのレスポンシブデザインを確保（Tailwind CSS ブレークポイント・ゲームのモバイルタッチコントロール）。
- スプリントプランニング・GitHub Issues トリアージ・PR レビュー調整を管理。
- **主な課題：** バックエンド WebSocket イベントとのフレンドプレゼンス状態同期の維持。リアクティブ `usePresence` フックと定期的な調整で解決。

### myokono（Mai Yokono）— プロダクトオーナー + 開発者
- 完全なトーナメントシステムを構築：バックエンドルート（`tournaments.ts`）・フロントエンドブラケット UI（TournamentListPage, TournamentDetailPage）・自動ラウンド進行ロジック。
- 実績システム（バックエンドルート + シードデータ）とダッシュボードのゲーミフィケーション表示を実装。
- GDPR 機能を実装：全 JSON データエクスポートエンドポイントとトランザクション付き匿名化アカウント削除。
- プロジェクト全体を通じてプロダクトバックログと機能優先度を管理。
- **主な課題：** ブラケット自動進行でラウンド内のすべてのゲームが解決済みかを正確に判定する必要があった。ラウンドごとの未終了ゲーム数をカウントするデータベースクエリで解決。

### pchung — 開発者
- DM チャットを実装：バックエンド `messages.ts` ルートとリアルタイム WebSocket 配信付きフロントエンド ChatPage。
- ブロックシステム（`blocks.ts`）を構築：双方向の適用（メッセージングとマッチメイキング除外）。
- ProfileEditPage を実装：型/サイズバリデーション付きアバターアップロード・ニックネーム/メール/パスワード変更・2FA 有効化/無効化。
- プライバシーポリシーと利用規約ページを作成（`legal.ts` バックエンド + フロントエンドページ）。
- **主な課題：** ブロックされたユーザーをチャット配信とマッチメイキングキューペアリングの両方から、リクエストごとのデータベースオーバーヘッドなしに正確に除外する必要があった。WebSocket 接続時にブロック済みユーザーセットをキャッシュして解決。

---

## リソース

### 参考資料
- [Fastify ドキュメント](https://fastify.dev/docs/latest/)
- [Prisma ドキュメント](https://www.prisma.io/docs)
- [React ドキュメント](https://react.dev)
- [Tailwind CSS v4 ドキュメント](https://tailwindcss.com/docs)
- [Vite ドキュメント](https://vite.dev/guide/)
- [WebSocket API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [HTML Canvas 2D API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [JWT 入門](https://jwt.io/introduction)
- [42 API ドキュメント](https://api.intra.42.fr/apidoc)
- [GDPR — データ主体の権利](https://gdpr.eu/data-subject-rights/)
- [bcrypt — パスワードハッシュ化](https://en.wikipedia.org/wiki/Bcrypt)

### AI の活用

Claude Code（Anthropic）を開発全体を通じて開発アシスタントとして使用しました：

- **アーキテクチャ計画：** サーバー権威型 vs クライアントサイドゲームモデルのトレードオフを検討；AI がスウェプト衝突アプローチの根拠を明確化するのを支援。
- **コード生成：** ボイラープレートのスキャフォールディング（Fastify ルートハンドラー・Prisma クエリパターン・React フック）に使用；生成されたコードはすべてマージ前に作者がレビュー・テスト・理解済み。
- **デバッグ：** エラートレースを貼り付けて診断を依頼；AI の提案は適用前に実際のランタイム動作に対して検証。
- **ドキュメント：** この README の構造およびプライバシーポリシー/利用規約の内容のドラフト作成を支援。
- **テストスクリプト：** E2E `.mjs` スクリプトは AI アシスタンスで初稿を作成し、実行中のサーバーに対して手動で検証。

AI が生成したコンテンツはすべてレビュー済みで、提出したチームメンバーが完全に理解しています。
