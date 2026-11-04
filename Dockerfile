# Stage 1: Build, with the same npm and package-lock.json as the CI
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# env.js must be bind-mounted at runtime — see env.js.example
CMD ["/bin/sh", "-c", "\
  ENV_JS=/usr/share/nginx/html/env.js; \
  DIR_DEV=$(stat -c %d /usr/share/nginx/html); \
  FILE_DEV=$(stat -c %d \"$ENV_JS\" 2>/dev/null || echo ''); \
  if [ \"$FILE_DEV\" = \"$DIR_DEV\" ]; then \
    echo 'ERROR: env.js must be bind-mounted. Example:'; \
    echo '  -v /path/to/your/env.js:/usr/share/nginx/html/env.js:ro'; \
    echo 'See env.js.example for reference.'; \
    exit 1; \
  fi; \
  exec nginx -g 'daemon off;'"]
