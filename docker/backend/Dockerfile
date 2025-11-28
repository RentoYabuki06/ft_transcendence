FROM alpine:3.20

WORKDIR /app

RUN apk update && apk add --no-cache nodejs npm sqlite iputils vim python3 make g++

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./

# sqlite data-dir
RUN mkdir -p /app/data

EXPOSE 3000

CMD [ "npm", "run", "dev" ]