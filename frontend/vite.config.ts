import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  function requireEnv(key: string): string {
    const value = env[key]
    if (!value) {
      throw new Error(`環境変数 ${key} が正しく設定されていません`)
    }
    return value
  }

  const hostRaw = requireEnv('VITE_HOST')
  const host: string | boolean = hostRaw === 'true' ? true : hostRaw
  const port = parseInt(requireEnv('VITE_PORT'), 10)
  const apiPath = requireEnv('VITE_API_PROXY_PATH')
  const apiTarget = requireEnv('VITE_API_TARGET')

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`環境変数に設定されたport番号 ${port} が正しくありません`)
  }

  return {
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
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
