# ft_transcendence

42 Tokyo 最終課題 ft_transcendence — マルチプレイヤー Pong Web アプリケーション (v21.0 準拠)。

---

## 概要

ブラウザ上で遊べるリアルタイム Pong。ローカル対戦 / リモート対戦 / トーナメント / フレンド / チャット / ランキング / 実績を備える Single Page Application。

## クイックスタート

### 前提
- Docker Desktop が起動していること
- `backend/.env` を `backend/.env.example` からコピーし、`JWT_SECRET` を 32 文字以上のランダム値に置き換えること
  ```bash
  cp backend/.env.example backend/.env
  # JWT_SECRET を openssl rand -base64 48 などで生成した値に差し替え
  ```

### 起動 / 停止

```bash
docker compose up        # 全サービス起動
docker compose down      # 停止
```

- フロントエンド (HTTPS, 必須) : <https://localhost:8443>
- API エンドポイント : <https://localhost:8443/api>

> 自己署名証明書のため、初回はブラウザの警告を「詳細設定 → 続行」で回避してください。

---

## 選択モジュール (実装済のみ)

ft_transcendence v21.0 の採点対象モジュール。**実装済のもののみ** を掲載しています。

### Major modules (= 2pt 各)
| # | モジュール | 実装内容 |
| - | - | - |
| M1 | Web: Use a framework to build the backend | Fastify 5 (Node.js / TypeScript) |
| M2 | User Management: Standard user management, authentication, users across tournaments | signup / login / nickname / avatar / トーナメント跨ぎの永続ユーザー |
| M3 | User Management: Remote authentication | 42 Intra OAuth 2.0 |
| M4 | Gameplay and UX: Remote players | WebSocket (`@fastify/websocket`) による 2 拠点リモート 1v1、サーバー権威モデル |
| M5 | Gameplay and UX: Live chat | DM、リアルタイム WebSocket 配信、ブロック機能、ゲーム招待 |
| M6 | Cybersecurity: Two-Factor Authentication (2FA) and JWT | TOTP (メール OTP) + `@fastify/jwt` |

### Minor modules (= 1pt 各)
| # | モジュール | 実装内容 |
| - | - | - |
| m1 | Web: Use a database for the backend | SQLite + Prisma ORM |
| m2 | Gameplay and UX: Support on all devices | レスポンシブ UI / keyboard + touch 操作 |
| m3 | Gameplay and UX: Expanding browser compatibility | Chrome / Firefox / Safari 動作確認 |
| m4 | Accessibility: Accessibility for visually impaired users | `aria-label`, フォーカスリング, コントラスト対応 |
| m5 | Cybersecurity: GDPR compliance (匿名化・データエクスポート・アカウント削除) | `GET /users/me/export`, `DELETE /users/me` (匿名化) |

**合計: Major 6 × 2 + Minor 5 × 1 = 17pt** (規定 14pt を充足)

---

## 必須要件 (Chapter III) との対応

| 要件 | 対応 |
| - | - |
| Single Page Application | React (Vite) で実装、ブラウザ Back/Forward 対応 |
| HTTPS / WSS 必須 | nginx (self-signed) を front-proxy として終端 |
| フォーム入力バリデーション (クライアント + サーバー両方) | signup / login / profile / message / tournament で二重検証 |
| 強いパスワードハッシュ | bcryptjs cost 12 |
| SQL Injection / XSS 保護 | Prisma (prepared statements) + React 自動エスケープ |
| 認証情報・環境変数の秘匿 | `.env` は `.gitignore` 済 |
| Pong ゲーム | サーバー権威 60Hz / 30Hz スナップショット、スイープ衝突判定 |
| 同一キーボードでのローカル対戦 | `/play` ページで 1 台 2 プレイヤー対戦可 |
| トーナメントシステム | 4 / 8 人対応、ブラケット自動生成 + 次ラウンド自動進行 |
| マッチメイキング | `/matchmaking` WebSocket + 先着ペアリング + 切断復帰 |

---

## ドキュメント

- [Backend 仕様](./BACKEND.md)
- [Git 運用ルール](./docs/00_git-rules/README.md)
- [要件定義](./docs/01_requirements/README.md)

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

## E2E テスト

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
