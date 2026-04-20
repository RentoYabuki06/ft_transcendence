FROM nginx:1.27-alpine

RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -subj "/CN=localhost" \
      -keyout /etc/nginx/ssl/key.pem \
      -out /etc/nginx/ssl/cert.pem

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 443 80
