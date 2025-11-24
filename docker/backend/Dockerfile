FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache nodejs npm sqlite iputils vim python3 make g++
RUN npm install fastify fastify-sqlite

COPY . .

# CMD [ "npm", "start" ]
ENTRYPOINT ["sleep", "infinity"]