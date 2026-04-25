# ft_transcendence Backend 実装まとめ

## 技術スタック

| 項目 | 詳細 |
|------|------|
| Runtime | Node.js (>=20) |
| Framework | Fastify |
| Language | TypeScript (ESM) |
| ORM | Prisma |
| Database | SQLite |
| Auth | JWT (fast-jwt) + bcryptjs |
| 2FA | speakeasy (TOTP) + qrcode |
| WebSocket | @fastify/websocket |
| File Upload | @fastify/multipart |
| Static Files | @fastify/static |

## ディレクトリ構成

```
backend/
├── server.ts                 # エントリーポイント・プラグイン登録
├── prisma/
│   └── schema.prisma         # DBスキーマ定義
├── src/
│   ├── lib/
│   │   ├── auth.ts           # JWT sign/verify
│   │   ├── middleware.ts     # authenticate ミドルウェア
│   │   ├── prisma.ts         # Prismaクライアントシングルトン
│   │   └── userBuilder.ts    # ユーザーレスポンス組み立て
│   ├── routes/
│   │   ├── auth.ts           # 認証（ローカル・42 OAuth・2FA チャレンジ）
│   │   ├── users.ts          # プロフィール・アバター
│   │   ├── friends.ts        # フレンド管理
│   │   ├── twofa.ts          # 2FA 設定・検証・無効化
│   │   ├── games.ts          # ゲーム履歴・記録
│   │   ├── matchmaking.ts    # マッチメイキング
│   │   ├── tournaments.ts    # トーナメント管理
│   │   ├── achievements.ts   # 実績一覧・取得状況
│   │   ├── websocket.ts      # WebSocket ルート・実績自動解除
│   │   └── legal.ts          # プライバシーポリシー・利用規約
│   └── seed.ts               # マスターデータ投入
└── uploads/                  # アバター画像保存先
```

## データベーススキーマ

### テーブル一覧

| テーブル | 概要 |
|----------|------|
| `Statuses` | ステータスマスター（category + name でユニーク） |
| `Users` | ユーザー情報・2FA フラグ |
| `Accounts` | 認証プロバイダー連携（local / intra42） |
| `Friendships` | フレンド関係（双方向ペア） |
| `Games` | ゲーム記録（トーナメント戦・単独戦） |
| `PlayerScores` | プレイヤーごとのスコア・勝敗 |
| `GameTypes` | ゲーム種別マスター |
| `WaitingRooms` | マッチメイキング待機部屋 |
| `WaitingRoomParticipants` | 待機部屋参加者 |
| `Tournaments` | トーナメント（pending / ongoing / finished） |
| `TournamentParticipants` | トーナメント参加者・エイリアス |
| `Achievements` | 実績マスター |
| `UserAchievements` | 解除済み実績 |

### Statuses カテゴリ

| category | name の例 |
|----------|-----------|
| `user` | `active` |
| `game` | `pending`, `ongoing`, `finished` |
| `tournament` | `pending`, `ongoing`, `finished` |
| `waitroom` | `waiting`, `matched` |

---

## REST API エンドポイント

### システム

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/ping` | なし | 疎通確認 |
| GET | `/health` | なし | DB接続確認 |

---

### 認証 `/auth`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| POST | `/auth/signup` | なし | ローカル新規登録（nickname, email, password） |
| POST | `/auth/login` | なし | ローカルログイン。2FA有効時は `requires2fa: true` + `tempToken` を返す |
| POST | `/auth/2fa/challenge` | なし | `tempToken` + TOTP `code` で本トークン発行 |
| POST | `/auth/logout` | JWT | ログアウト（サーバー側は何もしない） |
| GET | `/auth/42` | なし | 42 OAuth 開始（リダイレクト） |
| GET | `/auth/42/callback` | なし | 42 OAuth コールバック → `?token=` 付きでフロントへリダイレクト |

#### ログインフロー（2FA あり）

```
POST /auth/login
  → { requires2fa: true, tempToken }

POST /auth/2fa/challenge  { tempToken, code }
  → { token, user }
```

---

### ユーザー `/users`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/users/me` | JWT | 自分のプロフィール取得 |
| PUT | `/users/me` | JWT | nickname・avatar 更新（multipart/form-data） |
| GET | `/users/:id` | JWT | 他ユーザーのプロフィール取得 |

アバター画像は `uploads/` に保存、`/uploads/<filename>` で静的配信。

---

### フレンド `/users/me/friends`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/users/me/friends` | JWT | フレンド一覧（nickname, avatarUrl, onlineStatus） |
| POST | `/users/me/friends/:userId` | JWT | フレンド追加（双方向レコード作成） |
| DELETE | `/users/me/friends/:userId` | JWT | フレンド削除（双方向レコード削除） |

フレンド追加後に実績チェック（`social` 実績）を自動実行。

---

### 2FA `/users/me/2fa`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| POST | `/users/me/2fa/setup` | JWT | TOTP シークレット生成・QRコード URL 返却 |
| POST | `/users/me/2fa/verify` | JWT | TOTP コード検証・2FA 有効化 |
| DELETE | `/users/me/2fa` | JWT | 2FA 無効化 |

2FA 有効化後に実績チェック（`two_fa` 実績）を自動実行。

---

### ゲーム `/games`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/games` | JWT | 自分のゲーム履歴一覧 |
| GET | `/games/:id` | JWT | ゲーム詳細（スコア・勝敗） |

---

### マッチメイキング `/matchmaking`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| POST | `/matchmaking/join` | JWT | マッチングキューに参加。対戦相手がいれば即マッチング成立 |
| POST | `/matchmaking/cancel` | JWT | キューからキャンセル |

マッチング成立時：
- `Games` レコード作成
- `PlayerScores` 2件作成
- WebSocket (`/ws/matchmaking`) で両者に `{ type: 'matched', gameId, opponent }` 送信

---

### トーナメント `/tournaments`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/tournaments` | JWT | トーナメント一覧 |
| POST | `/tournaments` | JWT | トーナメント作成（name, maxParticipants: 4 or 8） |
| GET | `/tournaments/:id` | JWT | 詳細（参加者・ブラケット・スコア） |
| POST | `/tournaments/:id/join` | JWT | 参加（alias 指定可） |
| POST | `/tournaments/:id/start` | JWT | 開始（作成者のみ、最低4名必要）。シャッフルしてラウンド1ブラケット生成 |
| POST | `/tournaments/:id/games/:gameId/result` | JWT | 試合結果登録。全試合終了で次ラウンド自動生成、決勝後はトーナメント終了 |

---

### 実績 `/achievements`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/achievements` | JWT | 全実績一覧（解除済みフラグ付き） |

#### 実績キーと解除条件

| key | 条件 |
|-----|------|
| `first_win` | 勝利1回以上 |
| `ten_wins` | 勝利10回以上 |
| `fifty_wins` | 勝利50回以上 |
| `social` | フレンド1人以上 |
| `two_fa` | 2FA 有効化済み |

実績チェックは `checkAndUnlockAchievements(userId)` を呼ぶ関数で一元管理。
ゲーム終了・フレンド追加・2FA 有効化のタイミングで自動実行。

---

### 法的 `/legal`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| GET | `/legal/privacy` | なし | プライバシーポリシー |
| GET | `/legal/terms` | なし | 利用規約 |

---

## WebSocket エンドポイント

接続時は `?token=<JWT>` でクエリ認証。

| パス | 概要 |
|------|------|
| `GET /ws/presence` | オンライン状態管理。接続時に `presence_list`、変更時に全員に `presence` broadcast |
| `GET /ws/matchmaking` | マッチング成立通知受信用。成立時に `{ type: 'matched', gameId, opponent }` |
| `GET /ws/game/:id` | ゲームリアルタイム同期。参加者のみ接続可。両者揃ったら `game_start` |

### WebSocket メッセージ型

#### `/ws/game/:id` — クライアント送信

| type | 内容 |
|------|------|
| `paddle_move` | `{ paddleY }` → 相手に `opponent_paddle` として転送 |
| `game_over` | `{ winnerId }` → スコア確定・実績チェック・`game_finished` broadcast |

#### `/ws/game/:id` — サーバー送信

| type | 内容 |
|------|------|
| `connected` | 接続確認 |
| `game_start` | 両プレイヤー揃った通知 |
| `opponent_paddle` | 相手のパドル位置 |
| `opponent_disconnected` | 相手切断通知 |
| `game_finished` | `{ gameId, winnerId }` |

---

## 環境変数

| 変数 | 説明 |
|------|------|
| `DATABASE_URL` | SQLite ファイルパス（例: `file:./data/db.sqlite`） |
| `JWT_SECRET` | JWT 署名シークレット |
| `PORT` | サーバーポート（デフォルト: 3000） |
| `HOST` | バインドアドレス（デフォルト: 0.0.0.0） |
| `FRONTEND_URL` | フロントエンド URL（CORS・OAuth リダイレクト先） |
| `INTRA42_CLIENT_ID` | 42 OAuth クライアント ID |
| `INTRA42_CLIENT_SECRET` | 42 OAuth クライアントシークレット |
| `INTRA42_REDIRECT_URI` | 42 OAuth コールバック URL |

---

## 起動手順

```bash
cd backend
npm install
npx prisma migrate deploy   # マイグレーション適用
npx tsx src/seed.ts          # マスターデータ投入
npm run dev                  # 開発サーバー起動（port 3000）
```
