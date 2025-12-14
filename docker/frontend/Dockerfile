FROM alpine:3.20

WORKDIR /app

RUN apk update && apk add --no-cache \
    nodejs=20.15.1-r0 \
    npm=10.9.1-r0 \
    iputils \
    vim

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

EXPOSE 5173

# Vite開発サーバ起動
CMD [ "npm", "run", "dev", "--", "--host" ]