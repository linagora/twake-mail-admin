# Shared by build.sh, start.sh and stop.sh. Not meant to be run on its own.
#
# Two flavours of the QA environment:
#   (default)   Twake Mail Admin: the admin app over a distributed tmail-backend (APPLICATION=MAIL)
#   --calendar  Twake Calendar Admin: the admin app over the twake-calendar side service
#               (APPLICATION=CALENDAR). This repository has no calendar backend stack of its
#               own: it borrows the e2e one of twake-calendar-frontend (CALENDAR_REPO).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

APPLICATION=MAIL
for arg in "$@"; do
  case "$arg" in
    --calendar) APPLICATION=CALENDAR ;;
    *) echo "Unknown argument: $arg (usage: $(basename "$0") [--calendar])" >&2; exit 1 ;;
  esac
done

if [ "$APPLICATION" = "CALENDAR" ]; then
  QA_PROJECT="${QA_PROJECT:-twake-calendar-admin-qa}"
  export ADMIN_IMAGE="${ADMIN_IMAGE:-twake-calendar-admin-qa}"
  export QA_ADMIN_PORT="${QA_ADMIN_PORT:-18510}"
  export QA_WEBADMIN_PORT="${QA_WEBADMIN_PORT:-18511}"
  export GENERATED_DIR="$SCRIPT_DIR/.generated/calendar"
  NETWORK="${QA_PROJECT}_tcalendar-e2e"

  CALENDAR_REPO="${CALENDAR_REPO:-$REPO_DIR/../twake-calendar-frontend}"
  CALENDAR_REPO="${CALENDAR_REPO/#\~/$HOME}"
  if [ ! -f "$CALENDAR_REPO/e2e/src/test/resources/docker-twake-calendar-e2e.yml" ]; then
    echo "No twake-calendar-frontend checkout at $CALENDAR_REPO" >&2
    echo "    clone https://github.com/linagora/twake-calendar-frontend there, or set CALENDAR_REPO" >&2
    exit 1
  fi
  CALENDAR_REPO="$(cd "$CALENDAR_REPO" && pwd)"
  CALENDAR_E2E_DIR="$CALENDAR_REPO/e2e"

  compose() {
    docker compose -p "$QA_PROJECT" \
      -f "$CALENDAR_E2E_DIR/src/test/resources/docker-twake-calendar-e2e.yml" \
      -f "$SCRIPT_DIR/docker-compose.calendar.yaml" "$@"
  }
else
  QA_PROJECT="${QA_PROJECT:-twake-mail-admin-qa}"
  export ADMIN_IMAGE="${ADMIN_IMAGE:-twake-mail-admin-qa}"
  export QA_ADMIN_PORT="${QA_ADMIN_PORT:-18500}"
  export QA_WEBADMIN_PORT="${QA_WEBADMIN_PORT:-18501}"
  export GENERATED_DIR="$SCRIPT_DIR/.generated"
  NETWORK="${QA_PROJECT}_default"

  export TMAIL_BACKEND_IMAGE="${TMAIL_BACKEND_IMAGE:-linagora/tmail-backend:distributed-1.0.22}"
  TMAIL_BACKEND_DIR="${TMAIL_BACKEND_DIR:-$HOME/Documents/tmail-backend/tmail-backend/apps/distributed}"
  export TMAIL_BACKEND_DIR="${TMAIL_BACKEND_DIR/#\~/$HOME}"

  compose() {
    docker compose -p "$QA_PROJECT" -f "$SCRIPT_DIR/docker-compose.yaml" "$@"
  }
fi

ADMIN_URL="http://localhost:$QA_ADMIN_PORT"
WEBADMIN_URL="http://localhost:$QA_WEBADMIN_PORT"
