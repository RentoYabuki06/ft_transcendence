# ft_transcendence

42 Tokyo 最終課題 ft_transcendence — マルチプレイヤー Pong Web アプリケーション。

## 選択モジュール (Modules)

本プロジェクトで実装されたモジュール一覧（v21.0 準拠）。

### Major modules
- **Web: Use a framework to build the backend.** — Fastify (Node.js) を backend フレームワークとして使用。
- **User Management: Standard user management, authentication, users across tournaments.** — 独自の signup/login、nickname、アバター、プロフィール編集、トーナメント跨ぎの永続ユーザー。
- **User Management: Implementing a remote authentication.** — 42 Intra OAuth2 認証を実装。
- **Gameplay and UX: Remote players.** — WebSocket を用いた 2 拠点のリモート 1 vs 1 対戦。
- **Gameplay and UX: Live chat.** — Direct Message、リアルタイム WebSocket 配信、ブロック機能。
- **AI-Algo: Introduce an AI opponent.** *(未実装 — B-ranked)*
- **Cybersecurity: Implement Two-Factor Authentication (2FA) and JWT.** — TOTP (Google Authenticator 互換) による 2FA、`@fastify/jwt` による JWT 認証。
- **Devops: Infrastructure setup for log management.** *(未実装)*

### Minor modules
- **Web: Use a database for the backend.** — SQLite + Prisma ORM。
- **Gameplay and UX: Game customization options.** *(未実装)*
- **Gameplay and UX: Support on all devices.** — レスポンシブ対応、keyboard / touch 両対応。
- **Gameplay and UX: Expanding browser compatibility.** — Chrome / Firefox 対応確認。
- **Accessibility: Multiple language support.** *(未実装)*
- **Accessibility: Add accessibility for visually impaired users.** *(部分実装 — aria-label 等)*
- **Cybersecurity: GDPR compliance options with user anonymization, local data management, and Account Deletion.** — ユーザーデータ JSON エクスポート、アカウント匿名化削除 API を実装。

## 技術スタック

| 領域         | 技術                                           |
| ------------ | ---------------------------------------------- |
| Frontend     | React 18, Vite, TypeScript, Tailwind CSS       |
| Backend      | Fastify 5, TypeScript, Prisma 5                |
| DB           | SQLite                                         |
| Auth         | JWT (`@fastify/jwt`), bcryptjs (cost 12), TOTP |
| Real-time    | `@fastify/websocket`                           |
| Reverse proxy| nginx (HTTPS/WSS on 8443, self-signed)         |
| Container    | Docker Compose                                 |

## クイックスタート

### 前提
- Docker Desktop が起動していること

### 起動
```bash
docker compose up
```

- フロントエンド (HTTPS)： https://localhost:8443
- API エンドポイント: https://localhost:8443/api
- 開発用 HTTP フロントエンド： http://localhost:5173
- 開発用 HTTP バックエンド： http://localhost:3000

> 初回は自己署名証明書のため、ブラウザで「詳細設定 → 続行」してください。

### 停止
```bash
docker compose down
```

## 開発 (Docker 未使用)

```bash
# backend
cd backend
npm install
npm run setup   # migrate + seed
npm run dev     # tsx watch
```

```bash
# frontend
cd frontend
npm install
npm run dev
```

## E2E テスト

backend ディレクトリに E2E スクリプトが用意されています（サーバーを起動した状態で実行）。

```bash
cd backend
node e2e-match.mjs        # 1vs1 マッチング + スコア記録
node e2e-tournament.mjs   # 4人トーナメント
node e2e-chat.mjs         # DM リアルタイム配信
node e2e-friends.mjs      # フレンド + プレゼンス
node e2e-2fa.mjs          # 2FA セットアップ + チャレンジログイン
```

## ディレクトリ構成

```
.
├── backend/           # Fastify + Prisma + SQLite
│   ├── prisma/        # スキーマ + マイグレーション
│   ├── src/routes/    # HTTP / WebSocket ルート
│   └── e2e-*.mjs      # E2E テストスクリプト
├── frontend/          # React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       └── services/
├── docker/            # Dockerfile / nginx.conf
└── docker-compose.yml
```

## セキュリティ

- パスワードは bcryptjs (cost 12) でハッシュ化し保存。
- JWT secret は `.env` で管理（.gitignore 済み）。
- 2FA (TOTP, speakeasy) をユーザー任意で有効化可能。
- nginx 経由で HTTPS / WSS のみを外部公開。
- GDPR: データエクスポート + アカウント匿名化削除に対応。
- ブロック機能: 相互 DM・フレンド追加をブロック時に遮断。

## ドキュメント

- [Git 運用ルール](./docs/00_git-rules/README.md)
- [要件定義](./docs/01_requirements/README.md)
- [Backend 詳細](./BACKEND.md)
