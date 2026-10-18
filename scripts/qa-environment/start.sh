#!/bin/bash
#
# Starts a long lived QA stack for manual or agent driven exploratory QA, under its own compose
# project, until stop.sh is called:
#   - by default, Twake Mail Admin (APPLICATION=MAIL) over a distributed tmail-backend. The backend
#     configuration is the one baked in the image (tmail-backend/apps/distributed/src/main/conf),
#     plus docker-configuration/redis.properties of TMAIL_BACKEND_DIR and the files generated
#     under .generated/ (JWT keys, webadmin.properties with CORS, env.js of the admin app).
#   - with --calendar, Twake Calendar Admin (APPLICATION=CALENDAR) over the twake-calendar side
#     service of the twake-calendar-frontend e2e stack (CALENDAR_REPO: Sabre, MongoDB, LDAP, Dex,
#     OpenSearch, RabbitMQ, Redis, mock SMTP), its WebAdmin with CORS.
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#   scripts/qa-environment/start.sh
#   QA_USERS="frank grace" scripts/qa-environment/start.sh   # extra accounts
#   scripts/qa-environment/build.sh --calendar && scripts/qa-environment/start.sh --calendar
#
# WebAdmin has no authentication: the admin app never asks for a token.
#
# Mail seeded data: the domains example.com and example.org; alice, bob, brian, charlotte, david,
# emma @example.com and olivia, oscar @example.org (password = uid), plus QA_USERS @example.com;
# a few mails between them, a quota on bob, an alias and a forward.
#
# Calendar seeded data: the domain open-paas.org (the only one the side service knows); alice,
# bob, charlotte, david, emma @open-paas.org (password "secret"), plus QA_USERS, in LDAP, in the
# users of WebAdmin (/users) and registered calendar users (/registeredUsers), each with a default
# calendar; frank@open-paas.org in /users only, not registered; ldap_user1 and ldap_user2 in LDAP
# only.
#
set -euo pipefail

source "$(dirname "$0")/common.sh"

QA_USERS="${QA_USERS:-}"

# curl on WebAdmin, at $WEBADMIN: from inside tmail-backend, or from the host through the
# published port of the side service (its image has no curl)
if [ "$APPLICATION" = "CALENDAR" ]; then
  WEBADMIN="$WEBADMIN_URL"
  webadmin() {
    curl -s "$@"
  }
else
  WEBADMIN=http://localhost:8000
  webadmin() {
    compose exec -T tmail-backend curl -s "$@"
  }
fi

# webadmin <expected status> <method> <path> [json body]
webadmin_expect() {
  local expected="$1" method="$2" path="$3" body="${4:-}" status
  if [ -n "$body" ]; then
    status="$(webadmin -o /dev/null -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' \
      -d "$body" "$WEBADMIN$path")"
  else
    status="$(webadmin -o /dev/null -w '%{http_code}' -X "$method" "$WEBADMIN$path")"
  fi
  if [ "$status" != "$expected" ]; then
    echo "WebAdmin answered HTTP $status to $method $path (expected $expected)" >&2
    exit 1
  fi
}

send_mail() {
  local from="$1" to="$2" subject="$3" body="$4"
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\nMessage-ID: <%s@qa.example.com>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\r\n' \
    "$from" "$to" "$subject" "$(date -R)" "$(cat /proc/sys/kernel/random/uuid)" "$body" |
    compose exec -T tmail-backend curl -s --url smtp://localhost:25 --mail-from "$from" --mail-rcpt "$to" -T - >/dev/null
}

start_mail() {
  BACKEND_SERVICE=tmail-backend
  echo "==> Starting the stack as compose project '$QA_PROJECT' ($TMAIL_BACKEND_IMAGE)"
  compose up -d

  wait_for tmail-backend "JAMES server started"

  echo "==> Provisioning"
  if [ "$(webadmin -o /dev/null -w '%{http_code}' "$WEBADMIN/users/bob@example.com")" = "200" ]; then
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
}

start_calendar() {
  BACKEND_SERVICE=twake-calendar-side-service
  echo "==> Starting the stack as compose project '$QA_PROJECT' (twake-calendar e2e stack of $CALENDAR_REPO)"
  compose up -d admin twake-calendar-side-service mock-smtp
  wait_for twake-calendar-side-service "StartUpChecks all succeeded"

  echo "==> Provisioning"
  local uid email id status
  webadmin_expect 204 PUT "/users/frank@open-paas.org" '{"password":"secret"}'
  for uid in alice bob charlotte david emma $QA_USERS; do
    email="$uid@open-paas.org"
    printf 'dn: uid=%s,ou=users,dc=open-paas.org,dc=lng\nobjectClass: inetOrgPerson\nuid: %s\ncn: %s\nsn: %s\ngivenName: %s\nmail: %s\nuserPassword: secret\n' \
        "$uid" "$uid" "$uid" "$uid" "$uid" "$email" \
      | compose exec -T ldap ldapadd -x -H ldap://localhost:389 \
          -D cn=admin,dc=open-paas.org,dc=lng -w admin >/dev/null 2>&1 \
      || true  # already in the directory
    webadmin_expect 204 PUT "/users/$email" '{"password":"secret"}'
    id="$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    status="$(webadmin -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d "{\"email\":\"$email\",\"firstname\":\"$uid\",\"lastname\":\"$uid\",\"id\":\"$id\"}" \
      "$WEBADMIN/registeredUsers")"
    case "$status" in
      201|409) ;;
      *) echo "The side service refused to register $email: HTTP $status" >&2; exit 1 ;;
    esac
  done
}

# waits for <service> to log <pattern>
wait_for() {
  local service="$1" pattern="$2"
  echo "==> Waiting for $service"
  for _ in $(seq 1 120); do
    if compose logs "$service" 2>/dev/null | grep -qi "$pattern"; then
      return
    fi
    sleep 5
  done
  echo "$service did not start within 10 minutes, see: docker compose -p $QA_PROJECT logs" >&2
  exit 1
}

if [ "$APPLICATION" = "CALENDAR" ]; then
  IMAGES=("$ADMIN_IMAGE" tcalendar-e2e ldap-e2e tcalendar-dex-e2e sabre-e2e)
else
  IMAGES=("$ADMIN_IMAGE")
fi
for image in "${IMAGES[@]}"; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "The $image image is missing, build it first: scripts/qa-environment/build.sh $*" >&2
    exit 1
  fi
done
if [ "$APPLICATION" = "MAIL" ] && [ ! -f "$TMAIL_BACKEND_DIR/docker-configuration/redis.properties" ]; then
  echo "$TMAIL_BACKEND_DIR is not tmail-backend/apps/distributed: set TMAIL_BACKEND_DIR" >&2
  exit 1
fi

echo "==> Generating the configuration in $GENERATED_DIR"
mkdir -p "$GENERATED_DIR"
if [ "$APPLICATION" = "MAIL" ] && [ ! -f "$GENERATED_DIR/jwt_privatekey" ]; then
  openssl genpkey -algorithm rsa -pkeyopt rsa_keygen_bits:4096 -out "$GENERATED_DIR/jwt_privatekey" 2>/dev/null
  openssl rsa -in "$GENERATED_DIR/jwt_privatekey" -pubout -out "$GENERATED_DIR/jwt_publickey" 2>/dev/null
fi
# The admin app calls WebAdmin from the browser, on another origin
cat > "$GENERATED_DIR/webadmin.properties" <<PROPERTIES
enabled=true
port=8000
host=0.0.0.0
https.enabled=false
password.generate=false
cors.enable=true
cors.origin=*
PROPERTIES
cat > "$GENERATED_DIR/env.js" <<ENVJS
window.__ENV__ = {
  VITE_API_BASE_URL: "$WEBADMIN_URL",
  MODE: "GLOBAL",
  APPLICATION: "$APPLICATION",
};
ENVJS

if [ "$APPLICATION" = "CALENDAR" ]; then
  start_calendar
else
  start_mail
fi

cat <<INFO

==> The QA environment is up

  Admin app: $ADMIN_URL  (global mode, APPLICATION=$APPLICATION, no authentication)
  WebAdmin:  $WEBADMIN_URL  (e.g. $WEBADMIN_URL/healthcheck)

From a container (e.g. Playwright), join the network '$NETWORK' and use:
  --host-resolver-rules="MAP localhost:$QA_ADMIN_PORT admin:80,MAP localhost:$QA_WEBADMIN_PORT $BACKEND_SERVICE:8000"

Stop it with: scripts/qa-environment/stop.sh $*
INFO

