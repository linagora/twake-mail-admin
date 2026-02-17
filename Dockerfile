# Stage 1: Build
FROM oven/bun:latest AS build

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

ENV VITE_API_BASE_URL="http://localhost:8000"

EXPOSE 80

CMD ["/bin/sh", "-c", "echo \"window.__ENV__ = { VITE_API_BASE_URL: \\\"${VITE_API_BASE_URL}\\\" };\" > /usr/share/nginx/html/env.js && nginx -g 'daemon off;'"]
