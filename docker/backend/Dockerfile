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

# sqlite data-dir
RUN mkdir -p /app/data

EXPOSE 3000

CMD [ "npm", "run", "dev" ]