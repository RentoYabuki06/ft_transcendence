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
│   │   ├── auth.ts            # 認証 API
│   │   ├── users.ts           # ユーザー / プロフィール API
│   │   ├── friends.ts         # フレンド API
│   │   ├── games.ts           # ゲーム履歴 / ランキング API
│   │   ├── matchmaking.ts     # マッチメイキング API
│   │   ├── achievements.ts    # 実績 API
│   │   └── twofa.ts           # 2FA (TOTP) API
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
| `FRONTEND_URL` | フロントエンドの URL（OAuth リダイレクト先） | `http://localhost:5173` |

---

## 起動方法

```bash
# 初回セットアップ（マイグレーション + シードデータ投入）
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

### 主要テーブル

| テーブル | 役割 |
|---|---|
| `Statuses` | ステータスマスター（category + name で一意） |
| `Users` | ユーザー基本情報・プロフィール・2FA 設定 |
| `Accounts` | 認証プロバイダー情報（local / intra42 等）、ハッシュ済みパスワード |
| `Friendships` | ユーザー間フレンド関係（双方向で2レコード） |
| `Games` | 試合レコード |
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

---

## API エンドポイント一覧

> **注意**: フロントエンドからは `/api/*` で呼ぶが、バックエンド側のルートは `/api` なし。

### 認証 (`src/routes/auth.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/auth/signup` | 不要 | 新規ユーザー登録 |
| POST | `/auth/login` | 不要 | ログイン |
| POST | `/auth/logout` | 必要 | ログアウト |
| GET | `/auth/42` | 不要 | 42 OAuth 認証開始（302 リダイレクト） |
| GET | `/auth/42/callback` | 不要 | 42 OAuth コールバック処理 |

**signup / login レスポンス:**
```json
{
  "token": "JWT文字列",
  "user": {
    "id": 1,
    "nickname": "string",
    "email": "string",
    "avatarUrl": null,
    "isTwoFactorEnabled": false,
    "statusId": 1,
    "status": { "id": 1, "name": "active", "entityType": "user" },
    "wins": 0,
    "losses": 0,
    "rank": 1,
    "level": 1,
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
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
| GET | `/games/history` | 必要 | `page`, `limit`, `sort` (`date_desc`\|`date_asc`) | 自身の試合履歴 |
| GET | `/games/:id` | 必要 | — | 特定試合の詳細 |
| GET | `/ranking` | 必要 | `page`, `limit` | グローバルランキング |

### マッチメイキング (`src/routes/matchmaking.ts`)

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/matchmaking/join` | 必要 | マッチング待機登録（2人揃ったら Game レコード作成） |
| POST | `/matchmaking/cancel` | 必要 | マッチングキャンセル |

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

### システム

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/health` | 不要 | DB 接続確認・稼働状況 |
| GET | `/ping` | 不要 | 疎通確認 |

---

## 認証フロー

```
クライアント
  │
  ├─ POST /auth/signup  →  bcrypt ハッシュ → Users + Accounts(local) 作成 → JWT 発行
  ├─ POST /auth/login   →  bcrypt 検証 → JWT 発行
  └─ GET  /auth/42      →  42 OAuth → Users + Accounts(intra42) upsert → JWT → フロントへリダイレクト

保護されたエンドポイント
  │
  └─ Authorization: Bearer <token>
       │
       └─ src/lib/middleware.ts の authenticate() が検証
            → request.userId にセット
```

---

## 実装済みパッケージ

| パッケージ | 用途 |
|---|---|
| `fastify` | HTTP サーバーフレームワーク |
| `@fastify/cors` | CORS 設定 |
| `@fastify/multipart` | ファイルアップロード |
| `@fastify/static` | `/uploads/` 静的ファイル配信 |
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
| WebSocket (マッチング push) | `@fastify/websocket` を使用予定 |
| WebSocket (ゲームリアルタイム同期) | パドル操作・ゲーム状態の双方向通信 |
| オンライン状態 broadcast | WebSocket presence 実装後に対応 |
| 実績の自動解除ロジック | ゲーム終了時に PlayerScores を見て付与 |
| 2FA ログインフロー | login 後に `/auth/2fa/challenge` ステップ追加が必要 |
| リフレッシュトークン | 現状は 7 日間有効の JWT のみ |
