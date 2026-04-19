# Backend 実装ドキュメント

## 概要

Fastify + Prisma + SQLite によるバックエンド API サーバー。
フロントエンド (Vite) からは `/api/*` プレフィックスでアクセスし、Vite のプロキシが `/api` を削除してバックエンドに転送する。

---

## ディレクトリ構成

```
backend/
├── server.ts                  # エントリーポイント（全ルート登録・プラグイン設定）
├── prisma/
│   └── schema.prisma          # DBスキーマ定義
├── generated/prisma/          # Prisma が自動生成するクライアント（git 管理外）
├── src/
│   ├── lib/
│   │   ├── prisma.ts          # Prisma クライアント シングルトン
│   │   ├── auth.ts            # JWT 署名・検証ヘルパー
│   │   ├── middleware.ts      # Bearer Token 認証 preHandler
│   │   └── userBuilder.ts     # User レスポンスオブジェクト構築
│   ├── routes/
│   │   ├── auth.ts            # 認証 API（signup / login / logout / 42OAuth / 2FAチャレンジ）
│   │   ├── users.ts           # ユーザー / プロフィール API
│   │   ├── friends.ts         # フレンド API
│   │   ├── games.ts           # ゲーム履歴 / ランキング API
│   │   ├── matchmaking.ts     # マッチメイキング API（WebSocket通知連携）
│   │   ├── achievements.ts    # 実績 API
│   │   ├── twofa.ts           # 2FA (TOTP) API
│   │   ├── tournaments.ts     # トーナメント API
│   │   ├── websocket.ts       # WebSocket（presence / matchmaking / game）
│   │   └── legal.ts           # Privacy Policy / Terms of Service
│   └── seed.ts                # 初期データ投入スクリプト
├── uploads/                   # アバター画像保存先（git 管理外）
├── data/                      # SQLite DB ファイル（git 管理外）
├── .env                       # 環境変数（git 管理外）
├── .env.example               # 環境変数テンプレート
└── package.json
```

---

## 環境変数 (`.env`)

`.env.example` をコピーして設定する。

| 変数名 | 説明 | デフォルト値 |
|---|---|---|
| `DATABASE_URL` | SQLite ファイルパス | `file:./data/dev.db` |
| `JWT_SECRET` | JWT 署名秘密鍵（本番では長いランダム文字列に変更） | `changeme-in-production` |
| `PORT` | サーバーポート | `3000` |
| `HOST` | バインドホスト | `0.0.0.0` |
| `INTRA42_CLIENT_ID` | 42 OAuth クライアント ID | — |
| `INTRA42_CLIENT_SECRET` | 42 OAuth クライアントシークレット | — |
| `INTRA42_REDIRECT_URI` | 42 OAuth コールバック URI | `http://localhost:3000/auth/42/callback` |
| `FRONTEND_URL` | フロントエンドの URL（CORS・OAuth リダイレクト先） | `http://localhost:5173` |

---

## 起動方法

```bash
cd backend

# 初回セットアップ（マイグレーション + シードデータ投入）
cp .env.example .env
npm install
npm run setup

# 開発サーバー起動
npm run dev

# 型チェック
npm run lint
```

Docker 起動時は Dockerfile で自動的に `migrate deploy → seed → dev` が実行される。

---

## DB スキーマ

### 変更履歴

| マイグレーション | 内容 |
|---|---|
| `20251128151555_init` | 初期スキーマ（Statuses / Users / Accounts / Tournaments / WaitingRooms / Games 等） |
| `20260419_add_friendships_achievements_is_winner` | Friendships / Achievements / UserAchievements テーブル追加、PlayerScores に `isWinner` 追加 |
| `20260419_add_password_hash` | Accounts に `passwordHash` カラム追加 |
| `20260419_add_tournaments_and_participants` | Tournaments に `name / createdBy / maxParticipants` 追加、`TournamentParticipants` 追加、`Games.tournamentId` を nullable に変更 |

### 主要テーブル

| テーブル | 役割 |
|---|---|
| `Statuses` | ステータスマスター（category + name で一意） |
| `Users` | ユーザー基本情報・プロフィール・2FA 設定 |
| `Accounts` | 認証プロバイダー情報（local / intra42 等）、ハッシュ済みパスワード |
| `Friendships` | ユーザー間フレンド関係（双方向で2レコード） |
| `Tournaments` | トーナメント情報（名前・作成者・最大参加人数） |
| `TournamentParticipants` | トーナメント参加者（alias 付き） |
| `Games` | 試合レコード（tournamentId は nullable） |
| `PlayerScores` | 試合ごとのスコア・勝敗フラグ |
| `WaitingRooms` | マッチング待機室 |
| `WaitingRoomParticipants` | 待機室参加者 |
| `Achievements` | 実績マスター |
| `UserAchievements` | ユーザーが解除した実績 |
| `GameTypes` | ゲーム種別マスター |

### Statuses シードデータ

| category | name | 用途 |
|---|---|---|
| `user` | `active` | アクティブユーザー |
| `user` | `banned` | BAN ユーザー |
| `game` | `pending` | 開始前の試合 |
| `game` | `ongoing` | 進行中の試合 |
| `game` | `finished` | 終了した試合 |
| `gametype` | `standard` | 標準ゲームタイプ |
| `waitroom` | `waiting` | マッチング待機中 |
| `waitroom` | `matched` | マッチング成立 |
| `account` | `active` | アクティブなアカウント連携 |
| `tournament` | `pending` | 参加者募集中 |
| `tournament` | `ongoing` | 進行中のトーナメント |
| `tournament` | `finished` | 終了したトーナメント |

---

## API エンドポイント一覧

> **注意**: フロントエンドからは `/api/*` で呼ぶが、バックエンド側のルートは `/api` なし。

### システム

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/health` | 不要 | DB 接続確認・稼働状況 |
| GET | `/ping` | 不要 | 疎通確認 |

### 法的情報 (`src/routes/legal.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/privacy-policy` | 不要 | プライバシーポリシー（JSON） |
| GET | `/terms-of-service` | 不要 | 利用規約（JSON） |

### 認証 (`src/routes/auth.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/auth/signup` | 不要 | 新規ユーザー登録 |
| POST | `/auth/login` | 不要 | ログイン（2FA有効時は `requires2fa: true` + `tempToken` を返す） |
| POST | `/auth/logout` | 必要 | ログアウト |
| POST | `/auth/2fa/challenge` | 不要 | 2FA ログインチャレンジ（`tempToken` + `code` → 本 JWT 発行） |
| GET | `/auth/42` | 不要 | 42 OAuth 認証開始（302 リダイレクト） |
| GET | `/auth/42/callback` | 不要 | 42 OAuth コールバック処理 |

**signup / login レスポンス:**
```json
{ "token": "JWT文字列", "user": { ...UserObject } }
```

**2FA 有効時の login レスポンス:**
```json
{ "requires2fa": true, "tempToken": "JWT文字列" }
```

### ユーザー (`src/routes/users.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/users/me` | 必要 | 自身のプロフィール取得 |
| PUT | `/users/me` | 必要 | プロフィール更新（nickname / email / password） |
| POST | `/users/me/avatar` | 必要 | アバター画像アップロード（multipart/form-data） |
| GET | `/users/:id` | 必要 | 他ユーザーのプロフィール取得 |

### フレンド (`src/routes/friends.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/users/me/friends` | 必要 | フレンド一覧 |
| POST | `/users/me/friends/:userId` | 必要 | フレンド追加（双方向） |
| DELETE | `/users/me/friends/:userId` | 必要 | フレンド削除（双方向） |

### ゲーム / ランキング (`src/routes/games.ts`)

| メソッド | パス | 認証 | クエリパラメータ | 説明 |
|---|---|---|---|---|
| GET | `/games/history` | 必要 | `page`, `limit`, `sort` | 自身の試合履歴 |
| GET | `/games/:id` | 必要 | — | 特定試合の詳細 |
| GET | `/ranking` | 必要 | `page`, `limit` | グローバルランキング |

### マッチメイキング (`src/routes/matchmaking.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/matchmaking/join` | 必要 | 待機登録（2人揃ったら Game 作成 + WS 通知） |
| POST | `/matchmaking/cancel` | 必要 | マッチングキャンセル |

### トーナメント (`src/routes/tournaments.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/tournaments` | 必要 | トーナメント一覧 |
| POST | `/tournaments` | 必要 | トーナメント作成（name, maxParticipants: 4 or 8） |
| GET | `/tournaments/:id` | 必要 | トーナメント詳細（参加者・ブラケット） |
| POST | `/tournaments/:id/join` | 必要 | トーナメント参加（alias 指定可） |
| POST | `/tournaments/:id/start` | 必要 | トーナメント開始（ブラケット自動生成、作成者のみ） |
| POST | `/tournaments/:id/games/:gameId/result` | 必要 | 試合結果登録（次ラウンド自動生成） |

### 実績 (`src/routes/achievements.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/users/me/achievements` | 必要 | 自身の実績一覧（未解除は `unlockedAt: null`） |

### 2FA (`src/routes/twofa.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/users/me/2fa/setup` | 必要 | TOTP シークレット生成 + QR コード URL 返却 |
| POST | `/users/me/2fa/verify` | 必要 | TOTP コード検証 + 2FA 有効化 |
| DELETE | `/users/me/2fa` | 必要 | 2FA 無効化 |

---

## WebSocket エンドポイント (`src/routes/websocket.ts`)

WebSocket 接続は `?token=JWT文字列` クエリパラメータで認証する。

### WS `/ws/presence` — オンライン状態

```
接続時: { type: "presence_list", onlineUsers: [userId, ...] }
入室時: { type: "presence", userId: N, status: "online" }
退室時: { type: "presence", userId: N, status: "offline" }
```

### WS `/ws/matchmaking` — マッチング通知

```
接続時: { type: "waiting", message: "対戦相手を探しています..." }
成立時: { type: "matched", gameId: N, opponent: { id, nickname, avatarUrl } }
```

マッチング成立は `POST /matchmaking/join` が2人目を検出した時点で自動 push される。

### WS `/ws/game/:id` — ゲームリアルタイム同期

**クライアント → サーバー:**

| type | フィールド | 説明 |
|---|---|---|
| `paddle_move` | `paddleY: number` | パドル移動（相手に転送） |
| `game_over` | `winnerId: number` | ゲーム終了（スコア・実績を記録） |

**サーバー → クライアント:**

| type | フィールド | 説明 |
|---|---|---|
| `connected` | `gameId, userId` | 接続確認 |
| `game_start` | `gameId, players` | 両プレイヤー揃い次第 |
| `opponent_paddle` | `paddleY, from` | 相手パドル位置 |
| `game_finished` | `gameId, winnerId` | ゲーム終了通知 |
| `opponent_disconnected` | `userId` | 相手が切断 |

---

## 認証フロー

```
通常ログイン:
  POST /auth/login → JWT 発行

2FA 有効時のログイン（2ステップ）:
  1. POST /auth/login → { requires2fa: true, tempToken }
  2. POST /auth/2fa/challenge (tempToken + code) → JWT 発行

42 OAuth:
  GET /auth/42 → 42 認証ページへリダイレクト
  GET /auth/42/callback → JWT 発行 → フロントへリダイレクト

保護されたエンドポイント:
  Authorization: Bearer <token> ヘッダーで認証
  → middleware.ts の authenticate() が検証 → request.userId にセット
```

---

## 実績の自動解除ロジック

`checkAndUnlockAchievements(userId)` が以下タイミングで自動実行される：

| タイミング | 解除対象実績 |
|---|---|
| ゲーム終了時（WS `game_over` メッセージ） | `first_win`, `ten_wins`, `fifty_wins` |
| トーナメント試合結果登録時 | `first_win`, `ten_wins`, `fifty_wins` |
| フレンド追加後（friend routes 内） | `social` |
| 2FA 有効化後（twofa routes 内） | `two_fa` |

---

## トーナメント進行フロー

```
1. POST /tournaments            — 作成（status: pending）
2. POST /tournaments/:id/join   — 参加者が集まるまで繰り返し（最大4or8人）
3. POST /tournaments/:id/start  — ブラケット生成（status: ongoing）
   └─ ラウンド1の Games + PlayerScores を自動作成（シャッフル組み合わせ）
4. 各試合を WS /ws/game/:id でリアルタイム対戦
   または POST /tournaments/:id/games/:gameId/result で手動結果登録
   └─ そのラウンド全試合終了 → 次ラウンドを自動生成
   └─ 優勝者決定（勝者1人） → status: finished
```

---

## 実装済みパッケージ

| パッケージ | 用途 |
|---|---|
| `fastify` | HTTP サーバーフレームワーク |
| `@fastify/cors` | CORS 設定 |
| `@fastify/multipart` | ファイルアップロード |
| `@fastify/static` | `/uploads/` 静的ファイル配信 |
| `@fastify/websocket` | WebSocket サポート |
| `@prisma/client` | ORM |
| `bcryptjs` | パスワードハッシュ化 |
| `jsonwebtoken` | JWT 署名・検証 |
| `speakeasy` | TOTP (2FA) |
| `qrcode` | QR コード生成 |
| `axios` | 42 OAuth トークン取得 |
| `dotenv` | 環境変数読み込み |

---

## 未実装 / 今後の対応

| 機能 | 備考 |
|---|---|
| WebSocket オンライン状態の永続化 | 現状はメモリ上のみ。再起動でリセット |
| リフレッシュトークン | 現状は 7 日間有効の JWT のみ |
| レート制限 | `@fastify/rate-limit` 導入推奨 |
| ゲームロジックのサーバーサイド実装 | 現状は WS 中継のみ。不正防止のためサーバー計算推奨 |
