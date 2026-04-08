import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

/*
環境変数チェッカー（空かどうかのみを判定）
*/
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`環境変数 ${key} が正しく設定されていません`)
  }
  return value;
}

/*
各種環境変数の読み込み
*/
const host = requireEnv('VITE_HOST');
// parseInt(string, 10)で整数値としてパース
const port = parseInt(requireEnv('VITE_PORT'), 10);
const apiPath = requireEnv('VITE_API_PROXY_PATH');
const apiTarget = requireEnv('VITE_API_TARGET');

// ポート番号の妥当性チェック
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`環境変数に設定されたport番号 ${port} が正しくありません`);
}

/*
viteの設定オブジェクト
*/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: host,
    port: port,
    watch: {
      // ホストOSのファイルシステムイベントはDockerコンテナに届かない
      // イベントに頼らずチェックする必要がある
      usePolling: true,
    },
    proxy: {
      // []で囲うことで計算プロパティ名に（動的に決定）
      // []なしだと'apiPath'という文字列になってしまい, 変数値の'/api'などがが入らない
      [apiPath]: {
        target: apiTarget,
        // CORS回避
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  },
})
