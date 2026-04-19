FROM alpine:3.20

WORKDIR /app

RUN apk update && apk add --no-cache \
    nodejs=20.15.1-r0 \
    npm=10.9.1-r0 \
    sqlite \
    iputils \
    vim \
    python3 \
    make \
    g++ \
    curl

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./

# Prisma Client生成
RUN npx prisma generate

# アップロードディレクトリ & SQLite データディレクトリ
RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

# マイグレーション → シード → サーバー起動
CMD sh -c "npx prisma migrate deploy && npm run seed && npm run dev"
