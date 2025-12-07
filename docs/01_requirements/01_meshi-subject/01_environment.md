# Environment

## frontend

### OS
- Alpine

<br>

### 開放ポート（ホスト側ポート:Docker側のポート）
- "3000:3000"

<br>

### 使用フレームワーク・ライブラリ・コマンド
- React（UIライブラリ）
- ping（バックエンドとの疎通確認のため）
- vi（エディタ）

## backend

### OS:
- Alpine

<br>

### 開放ポート（ホスト側ポート:Docker側のポート）
- API : "8000:8000"
- websocket : "8081:8081"

<br>

### database
組み込み型であるSQLiteを使用

### 使用フレームワーク・ライブラリ・コマンド
- SQLite（組み込み型データベース）
- Fastify（HTTPサーバフレームワーク）
- Fastify SQLite Typed Plugin（SQLite操作用）
- ping（フロントエンドとの疎通確認）
- vi（エディタ）

### docker コマンドを用いた立ち上げ方

<br>

#### docker build（イメージの作成）
`docker build -t ft_backend -f Dockerfile .`

<br>

#### docker run（コンテナの起動）
`docker run --rm -p 3000:3000 ft_backend`
 - `--rm` : 停止時に自動でコンテナ削除
 - `-p <ホストPort>:<コンテナPort>` : 