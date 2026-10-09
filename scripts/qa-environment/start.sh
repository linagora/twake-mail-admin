#!/bin/bash
#
# Starts a long lived admin app + distributed tmail-backend stack for manual or agent driven
# exploratory QA. The backend configuration is the one baked in the image
# (tmail-backend/apps/distributed/src/main/conf), plus docker-configuration/redis.properties of
# TMAIL_BACKEND_DIR and the files generated under .generated/ (JWT keys, webadmin.properties with
# CORS, env.js of the admin app).
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#   scripts/qa-environment/start.sh
#   QA_USERS="frank grace" scripts/qa-environment/start.sh   # extra accounts
#
# WebAdmin has no authentication: the admin app never asks for a token. Seeded data: the domains
# example.com and example.org; alice, bob, brian, charlotte, david, emma @example.com and
# olivia, oscar @example.org (password = uid), plus QA_USERS @example.com; a few mails between
# them, a quota on bob, an alias and a forward.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GENERATED_DIR="$SCRIPT_DIR/.generated"

QA_PROJECT="${QA_PROJECT:-twake-mail-admin-qa}"
QA_USERS="${QA_USERS:-}"
export QA_ADMIN_PORT="${QA_ADMIN_PORT:-18500}"
export QA_WEBADMIN_PORT="${QA_WEBADMIN_PORT:-18501}"
export TMAIL_BACKEND_IMAGE="${TMAIL_BACKEND_IMAGE:-linagora/tmail-backend:distributed-branch-master}"
TMAIL_BACKEND_DIR="${TMAIL_BACKEND_DIR:-$HOME/Documents/tmail-backend/tmail-backend/apps/distributed}"
export TMAIL_BACKEND_DIR="${TMAIL_BACKEND_DIR/#\~/$HOME}"

ADMIN_URL="http://localhost:$QA_ADMIN_PORT"
WEBADMIN_URL="http://localhost:$QA_WEBADMIN_PORT"

compose() {
  docker compose -p "$QA_PROJECT" -f "$SCRIPT_DIR/docker-compose.yaml" "$@"
}

webadmin() {
  compose exec -T tmail-backend curl -s "$@"
}

# webadmin <expected status> <method> <path> [json body]
webadmin_expect() {
  local expected="$1" method="$2" path="$3" body="${4:-}" status
  if [ -n "$body" ]; then
    status="$(webadmin -o /dev/null -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' \
      -d "$body" "http://localhost:8000$path")"
  else
    status="$(webadmin -o /dev/null -w '%{http_code}' -X "$method" "http://localhost:8000$path")"
  fi
  if [ "$status" != "$expected" ]; then
    echo "tmail-backend answered HTTP $status to $method $path (expected $expected)" >&2
    exit 1
  fi
}

send_mail() {
  local from="$1" to="$2" subject="$3" body="$4"
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nMessage-ID: <%s@qa.example.com>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\r\n' \
    "$from" "$to" "$subject" "$(date -R)" "$(cat /proc/sys/kernel/random/uuid)" "$body" |
    compose exec -T tmail-backend curl -s --url smtp://localhost:25 --mail-from "$from" --mail-rcpt "$to" -T - >/dev/null
}

if ! docker image inspect twake-mail-admin-qa >/dev/null 2>&1; then
  echo "The twake-mail-admin-qa image is missing, build it first: scripts/qa-environment/build.sh" >&2
  exit 1
fi
if [ ! -f "$TMAIL_BACKEND_DIR/docker-configuration/redis.properties" ]; then
  echo "$TMAIL_BACKEND_DIR is not tmail-backend/apps/distributed: set TMAIL_BACKEND_DIR" >&2
  exit 1
fi

echo "==> Generating the configuration in $GENERATED_DIR"
mkdir -p "$GENERATED_DIR"
if [ ! -f "$GENERATED_DIR/jwt_privatekey" ]; then
  openssl genpkey -algorithm rsa -pkeyopt rsa_keygen_bits:4096 -out "$GENERATED_DIR/jwt_privatekey" 2>/dev/null
  openssl rsa -in "$GENERATED_DIR/jwt_privatekey" -pubout -out "$GENERATED_DIR/jwt_publickey" 2>/dev/null
fi
# The admin app calls WebAdmin from the browser, on another origin
cat > "$GENERATED_DIR/webadmin.properties" <<PROPERTIES
enabled=true
port=8000
host=0.0.0.0
https.enabled=false
cors.enable=true
cors.origin=*
PROPERTIES
cat > "$GENERATED_DIR/env.js" <<ENVJS
window.__ENV__ = {
  VITE_API_BASE_URL: "$WEBADMIN_URL",
  MODE: "GLOBAL",
  APPLICATION: "MAIL",
};
ENVJS

echo "==> Starting the stack as compose project '$QA_PROJECT' ($TMAIL_BACKEND_IMAGE)"
compose up -d

echo "==> Waiting for tmail-backend"
for _ in $(seq 1 120); do
  if compose logs tmail-backend 2>/dev/null | grep -qi "JAMES server started"; then
    ready=true
    break
  fi
  sleep 5
done
if [ "${ready:-false}" != "true" ]; then
  echo "tmail-backend did not start within 10 minutes, see: docker compose -p $QA_PROJECT logs" >&2
  exit 1
fi

echo "==> Provisioning"
if [ "$(webadmin -o /dev/null -w '%{http_code}' "http://localhost:8000/users/bob@example.com")" = "200" ]; then
  echo "    already provisioned"
else
  for domain in example.com example.org; do
    webadmin_expect 204 PUT "/domains/$domain"
  done
  for uid in alice bob brian charlotte david emma; do
    webadmin_expect 204 PUT "/users/$uid@example.com" "{\"password\":\"$uid\"}"
  done
  for uid in olivia oscar; do
    webadmin_expect 204 PUT "/users/$uid@example.org" "{\"password\":\"$uid\"}"
  done
  webadmin_expect 204 PUT "/quota/users/bob@example.com/size" "52428800"
  webadmin_expect 204 PUT "/quota/users/bob@example.com/count" "1000"
  webadmin_expect 204 PUT "/address/aliases/alice@example.com/sources/alice.alias@example.com"
  webadmin_expect 204 PUT "/address/forwards/brian@example.com/targets/charlotte@example.com"

  send_mail alice@example.com bob@example.com "Quarterly report" "Hi Bob, the report is attached to the wiki."
  send_mail charlotte@example.com bob@example.com "Lunch on Friday?" "Shall we have lunch on Friday?"
  send_mail bob@example.com alice@example.com "Re: Quarterly report" "Thanks Alice."
  send_mail olivia@example.org alice@example.com "Partnership" "Hello from example.org."
  send_mail david@example.com brian@example.com "Forwarded to Charlotte" "brian forwards to charlotte."
fi
for uid in $QA_USERS; do
  webadmin_expect 204 PUT "/users/$uid@example.com" "{\"password\":\"$uid\"}"
done

cat <<INFO

==> The QA environment is up

  Admin app: $ADMIN_URL  (global mode, no authentication)
  WebAdmin:  $WEBADMIN_URL  (e.g. $WEBADMIN_URL/healthcheck)

From a container (e.g. Playwright), join the network '${QA_PROJECT}_default' and use:
  --host-resolver-rules="MAP localhost:$QA_ADMIN_PORT admin:80,MAP localhost:$QA_WEBADMIN_PORT tmail-backend:8000"

Stop it with: scripts/qa-environment/stop.sh
INFO
