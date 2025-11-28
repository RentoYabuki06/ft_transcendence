import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
	plugins: [
		tailwindcss(),
	],
	server: {
		// コンテナ外からもアクセス可能に
		host: true,
		port: 5173,
		watch: {
			// ホストOSのファイルシステムイベントはDockerコンテナに届かない
			// イベントに頼らずチェックする必要がある
			usePolling: true,	
		},
		proxy: {
			'/api': {
				// ホスト名はdocker-composeのサービス名と一致させる
				target: 'http://backend:3000',
				// CORS回避
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			}
		}
	},
})