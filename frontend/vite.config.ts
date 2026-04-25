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

  // nginx 越しに HMR を通す場合は VITE_HMR_BEHIND_PROXY=true を設定
  const useProxyHmr = env.VITE_HMR_BEHIND_PROXY === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: host,
      port: port,
      // nginx リバースプロキシ越しのアクセスを許可
      allowedHosts: true,
      ...(useProxyHmr && {
        hmr: { clientPort: 8443, protocol: 'wss' as const },
      }),
      watch: {
        // ホストOSのファイルシステムイベントはDockerコンテナに届かない
        // イベントに頼らずチェックする必要がある
        usePolling: true,
      },
      proxy: {
        // []で囲うことで計算プロパティ名に（動的に決定）
        [apiPath]: {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // backend が配信する静的ファイル（アップロード画像など）
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
