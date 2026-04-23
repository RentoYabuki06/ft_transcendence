# 役割分担 (4人構成)

ft_transcendence (v21.0) を **Backend 2 名 / Frontend 2 名** の 4 人で分担する際の責任範囲定義。採点面接で「自分の担当」を被りなく説明できるよう、ファイル/モジュール単位で境界を明確化している。

---

## 全体像

| 担当 | 領域 | キーワード |
| - | - | - |
| Backend A | 認証・アカウント・ソーシャル | 「誰が使うか」のレイヤー |
| Backend B | ゲームプレイ・リアルタイム・トーナメント | 「何をするか」のレイヤー |
| Frontend A | 認証・プロフィール・ソーシャル UI | ゲームに入る前のページ群 |
| Frontend B | ゲーム・マッチング・トーナメント UI | ゲームを遊ぶページ群 |

---

## 🔧 Backend A — 認証・アカウント・ソーシャル

### 担当ファイル

| カテゴリ | ファイル |
| - | - |
| 認証 | [backend/src/routes/auth.ts](../../backend/src/routes/auth.ts) |
|  | [backend/src/routes/twofa.ts](../../backend/src/routes/twofa.ts) |
|  | [backend/src/lib/mailer.ts](../../backend/src/lib/mailer.ts) |
|  | [backend/src/lib/auth.ts](../../backend/src/lib/auth.ts) |
|  | [backend/src/lib/middleware.ts](../../backend/src/lib/middleware.ts) |
| ユーザー | [backend/src/routes/users.ts](../../backend/src/routes/users.ts) |
|  | [backend/src/lib/userBuilder.ts](../../backend/src/lib/userBuilder.ts) |
| ソーシャル | [backend/src/routes/friends.ts](../../backend/src/routes/friends.ts) |
|  | [backend/src/routes/blocks.ts](../../backend/src/routes/blocks.ts) |
|  | [backend/src/routes/messages.ts](../../backend/src/routes/messages.ts) |
| 法務 | [backend/src/routes/legal.ts](../../backend/src/routes/legal.ts) |

### 機能スコープ
- signup / login / 2FA チャレンジ / 42 OAuth / JWT / bcrypt
- プロフィール CRUD / アバターアップロード
- GDPR: データエクスポート / アカウント匿名化削除
- ユーザー検索
- フレンド / ブロック / DM
- Privacy Policy / Terms of Service

### 担当 Prisma モデル
`Users`, `Accounts`, `Friendships`, `Messages`, `Blocks`, `Statuses(user系)`

### 語るべきトピック
- HTTPS / WSS 対応
- JWT の発行・検証フロー、`JWT_SECRET` の運用
- パスワードハッシュ (bcrypt cost 12)
- 入力バリデーション (クライアント + サーバー二重)
- 2FA (TOTP + メール OTP)
- 42 Intra OAuth 2.0

---

## ⚙️ Backend B — ゲームプレイ・リアルタイム・トーナメント

### 担当ファイル

| カテゴリ | ファイル |
| - | - |
| リアルタイム | [backend/src/routes/websocket.ts](../../backend/src/routes/websocket.ts) |
| ゲームエンジン | [backend/src/lib/gameEngine.ts](../../backend/src/lib/gameEngine.ts) |
| マッチメイキング | [backend/src/routes/matchmaking.ts](../../backend/src/routes/matchmaking.ts) |
| ゲーム記録 | [backend/src/routes/games.ts](../../backend/src/routes/games.ts) |
| トーナメント | [backend/src/routes/tournaments.ts](../../backend/src/routes/tournaments.ts) |
| 実績 | [backend/src/routes/achievements.ts](../../backend/src/routes/achievements.ts) |

### 機能スコープ
- presence / matchmaking WebSocket / game WebSocket
- 再接続制御 / 猶予タイマー (grace timer, room drop timer)
- サーバー権威 Pong (60Hz tick / 30Hz snapshot / sub-step 衝突判定)
- 先着ペアリング、進行中試合への復帰
- ブラケット自動生成・次ラウンド進行
- スコア記録、ランキング計算、実績アンロック

### 担当 Prisma モデル
`Games`, `PlayerScores`, `Tournaments`, `TournamentParticipants`, `WaitingRooms`, `WaitingRoomParticipants`, `Achievements`, `UserAchievements`, `GameTypes`

### 語るべきトピック
- サーバー権威モデルの設計理由（cheat 防止, 公平性, ネットワーク遅延耐性）
- トンネリング防止のための sub-step スイープ衝突
- 切断時の 2 段階タイマー設計 (60s player grace / room drop)
- マッチメイキングの race condition 対策 (P2002 吸収)
- トーナメント: 定員充足時のみ開始可 (奇数人ブラケット破綻を防止)

---

## 🎨 Frontend A — 認証・プロフィール・ソーシャル UI

### 担当ファイル

| カテゴリ | ファイル |
| - | - |
| 認証 | [frontend/src/pages/LandingPage.tsx](../../frontend/src/pages/LandingPage.tsx) |
|  | [frontend/src/pages/LoginPage.tsx](../../frontend/src/pages/LoginPage.tsx) |
|  | [frontend/src/pages/SignupPage.tsx](../../frontend/src/pages/SignupPage.tsx) |
| プロフィール | [frontend/src/pages/DashboardPage.tsx](../../frontend/src/pages/DashboardPage.tsx) |
|  | [frontend/src/pages/ProfileEditPage.tsx](../../frontend/src/pages/ProfileEditPage.tsx) |
|  | [frontend/src/pages/UserProfilePage.tsx](../../frontend/src/pages/UserProfilePage.tsx) |
| ソーシャル | [frontend/src/pages/FriendsPage.tsx](../../frontend/src/pages/FriendsPage.tsx) |
|  | [frontend/src/pages/ChatPage.tsx](../../frontend/src/pages/ChatPage.tsx) |
| 法務 | [frontend/src/pages/PrivacyPage.tsx](../../frontend/src/pages/PrivacyPage.tsx) |
|  | [frontend/src/pages/TermsPage.tsx](../../frontend/src/pages/TermsPage.tsx) |
| 共通 | `hooks/useAuth`, `components/UserAvatar` 等 |

### 機能スコープ
- ログイン / サインアップ / 2FA 入力 UI
- 42 OAuth リダイレクトハンドリング
- プロフィール表示・編集・アバター変更
- フレンド一覧 / 申請 / ブロック管理
- DM チャット
- アクセシビリティ (aria-label, フォーカスリング, コントラスト)
- レスポンシブ (keyboard / touch)
- `services/api.ts` の **Auth / User / Friends / Chat** セクション

### 語るべきトピック
- Single Page Application としてのルーティング
- 認証状態管理 (`sessionStorage` + `useAuth`)
- Tailwind CSS デザインシステム
- ブラウザ互換性 (Chrome / Firefox / Safari)

---

## 🕹️ Frontend B — ゲーム・マッチング・トーナメント UI

### 担当ファイル

| カテゴリ | ファイル |
| - | - |
| ローカル対戦 | [frontend/src/pages/PlayPage.tsx](../../frontend/src/pages/PlayPage.tsx) |
| リモート対戦 | [frontend/src/pages/MatchingPage.tsx](../../frontend/src/pages/MatchingPage.tsx) |
|  | [frontend/src/pages/GamePage.tsx](../../frontend/src/pages/GamePage.tsx) |
| トーナメント | [frontend/src/pages/TournamentListPage.tsx](../../frontend/src/pages/TournamentListPage.tsx) |
|  | [frontend/src/pages/TournamentDetailPage.tsx](../../frontend/src/pages/TournamentDetailPage.tsx) |
| 記録 | [frontend/src/pages/MatchHistoryPage.tsx](../../frontend/src/pages/MatchHistoryPage.tsx) |
|  | [frontend/src/pages/RankingPage.tsx](../../frontend/src/pages/RankingPage.tsx) |

### 機能スコープ
- Canvas 描画 / アニメーション / スナップショット補間
- WebSocket クライアント (接続・再接続・入力送信)
- キーボード / タッチ両対応の入力処理
- マッチング待機 UI / マッチ成立演出
- トーナメント作成・参加・ブラケット可視化
- 試合履歴 / ランキング表示
- `services/api.ts` の **Game / Match / Tournament / Ranking** セクション

### 語るべきトピック
- クライアント側補間とサーバー権威状態の整合
- WebSocket 切断→再接続のユーザー体験
- ゲーム UI のレスポンシブ / タッチ対応
- ブラケット UI のデータ構造と描画

---

## 量のバランス

| 担当 | ファイル数 | 特徴 |
| - | - | - |
| Backend A | 11 | ルート数多いが各ルート中規模 |
| Backend B | 6 | `websocket.ts` + `gameEngine.ts` が厚く、物理・ネットワーク知識要 |
| Frontend A | 10+ | ページ数多くロジック軽め |
| Frontend B | 7 | `GamePage.tsx` が巨大、Canvas・WS 知識要 |

ゲーム系 (Backend B + Frontend B) は **技術的に尖っている分、ページ/ルート数が少なく量が揃う**。非ゲーム系 (Backend A + Frontend A) は **広く浅く、ページ/ルート数で量を稼ぐ**。

---

## 境界の注意点

### 1. WebSocket 所有権
[websocket.ts](../../backend/src/routes/websocket.ts) は **Backend B 所有**。今後 DM をリアルタイム配信する場合は、Backend A の `messages.ts` から Backend B の WS ハブに emit する形で線引きする。

### 2. 共有ファイル
- [frontend/src/services/api.ts](../../frontend/src/services/api.ts) : Frontend A/B それぞれ担当セクションのみ編集
- [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) : マイグレーションは **PR ごとに必ず 1 本**、同時編集は避ける

### 3. インフラ担当
nginx / Docker / CI / README は **Backend A または B のどちらかに寄せる**。本プロジェクトでは README で明記。

### 4. Prisma モデル境界
| モデル | 所有 |
| - | - |
| Users / Accounts / Friendships / Messages / Blocks | Backend A |
| Games / PlayerScores / Tournaments / WaitingRooms / Achievements | Backend B |
| Statuses | 共有 (カテゴリで棲み分け) |

---

## 担当モジュール (採点対象) 対応表

| モジュール | 主担当 |
| - | - |
| Major: Backend framework (Fastify) | Backend A / B 共同 |
| Major: User Management (標準認証) | Backend A |
| Major: Remote authentication (42 OAuth) | Backend A |
| Major: Remote players | Backend B + Frontend B |
| Major: Live chat | Backend A + Frontend A |
| Major: 2FA + JWT | Backend A + Frontend A |
| Minor: Database (SQLite + Prisma) | Backend A / B 共同 |
| Minor: Support on all devices | Frontend A / B 共同 |
| Minor: Browser compatibility | Frontend A / B 共同 |
| Minor: Accessibility | Frontend A |
| Minor: GDPR | Backend A + Frontend A |
