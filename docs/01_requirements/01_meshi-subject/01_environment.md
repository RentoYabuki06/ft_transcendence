# Environment

## frontend
### OS
- Alpine
### 開放ポート（ホスト側ポート:Docker側のポート）
- "3000:3000"
### 使用フレームワーク・ライブラリ・コマンド
- React（UIライブラリ）
- ping（バックエンドとの疎通確認のため）
- vi（エディタ）

## backend
### OS:
- Alpine
### 開放ポート（ホスト側ポート:Docker側のポート）
- API : "8000:8000"
- websocket : "8081:8081"
### database
組み込み型であるSQLiteを使用
### 使用フレームワーク・ライブラリ・コマンド
- SQLite（組み込み型データベース）
- Fastify（HTTPサーバフレームワーク）
- Fastify SQLite Typed Plugin（SQLite操作用）
- ping（フロントエンドとの疎通確認）
- vi（エディタ）

### docker立ち上げ確認
#### docker build（イメージの作成）
`docker build -t ft_backend -f Dockerfile .`
#### docker run（コンテナの起動）
`docker run --rm -p 3000:3000 ft_backend`
 - `--rm` : 停止時に自動でコンテナ削除
 - `-p <ホストPort>:<コンテナPort>` : 