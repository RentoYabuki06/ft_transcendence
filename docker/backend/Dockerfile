FROM alpine:3.20

WORKDIR /app

RUN apk update && apk add --no-cache nodejs npm sqlite iputils vim python3 make g++ nginx

COPY backend/package.json .
RUN npm install

CMD [ "npm", "start" ]