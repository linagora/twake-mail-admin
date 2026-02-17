# Docker

## Build

```sh
docker build -t linagora/twake-mail-admin .
```

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
