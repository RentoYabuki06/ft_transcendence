FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache iputils vim

COPY frontend/package.json ./
# package-lock.json はホスト (macOS) 由来で platform-specific な rollup バイナリのみロックされており
# Linux コンテナで npm ci すると @rollup/rollup-linux-* が欠落する (npm optional deps bug)。
# npm install で解決するが、optional deps の巻き上げで esbuild の JS wrapper と native バイナリの
# バージョン不一致が出ることがあるので npm rebuild で整合させる。
RUN npm install \
 && rm -rf node_modules/esbuild/node_modules

COPY frontend/ ./

EXPOSE 5173

# Vite開発サーバ起動
CMD [ "npm", "run", "dev", "--", "--host" ]
