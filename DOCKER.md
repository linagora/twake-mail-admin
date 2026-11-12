# Docker

## Build

```sh
docker build --pull -t linagora/twake-mail-admin .
```

`--pull` refreshes the `node:26-alpine` and `nginx:alpine` base images, and the serve
stage runs `apk upgrade` so that Alpine security fixes are applied even when the
upstream `nginx:alpine` tag lags behind them.

## Run

```sh
docker run -p 3333:80 linagora/twake-mail-admin
```

The SPA is served on `http://localhost:3333`. By default the app points to `http://localhost:8000`.

### Override the API URL

Pass the `VITE_API_BASE_URL` environment variable:

```sh
docker run -p 3333:80 -e VITE_API_BASE_URL=https://api.example.com linagora/twake-mail-admin
```

## Docker Compose

Set the API URL via the environment variable:

```yaml
services:
  twake-mail-admin:
    image: linagora/twake-mail-admin
    ports:
      - "3333:80"
    environment:
      - VITE_API_BASE_URL=https://api.example.com
```
