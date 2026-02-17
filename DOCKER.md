# Docker

## Build

```sh
docker build -t linagora/twake-mail-admin .
```

## Run

```sh
docker run -p 3333:80 linagora/twake-mail-admin
```

The SPA is served on `http://localhost:3333`. By default the app points to `http://127.0.0.1:8000`.

### Override the API URL

Create an `env.js` file (see `env.js.example`) and volume-mount it:

```sh
docker run -p 3333:80 -v ./env.js:/usr/share/nginx/html/env.js linagora/twake-mail-admin
```

## Docker Compose

Copy the example config and adjust the API URL:

```sh
cp env.js.example env.js
# edit env.js as needed
docker compose up
```

This binds port 3333 and mounts your local `env.js` into the container.
