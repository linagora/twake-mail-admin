#!/bin/bash
#
# Builds the admin image start.sh runs, from the working tree, with the release Dockerfile, and
# the backend images: the distributed tmail-backend one (pulled), or with --calendar those of the
# twake-calendar e2e stack (built from CALENDAR_REPO).
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#   TMAIL_BACKEND_IMAGE=linagora/tmail-backend-distributed scripts/qa-environment/build.sh
#                                      # a local build of tmail-backend/apps/distributed (jib)
#   scripts/qa-environment/build.sh --calendar
#   CALENDAR_REPO=/path/to/twake-calendar-frontend scripts/qa-environment/build.sh --calendar
#
set -euo pipefail

source "$(dirname "$0")/common.sh"

docker build -t "$ADMIN_IMAGE" -f "$REPO_DIR/Dockerfile" "$REPO_DIR"

if [ "$APPLICATION" = "CALENDAR" ]; then
  # The calendar SPAs are not needed: only the backend images of the e2e stack
  echo "==> Building the calendar backend images from $CALENDAR_E2E_DIR"
  docker build --quiet --pull -f "$CALENDAR_E2E_DIR/docker/Dockerfile.tcalendar" -t tcalendar-e2e "$CALENDAR_E2E_DIR"
  docker build --quiet --pull -f "$CALENDAR_E2E_DIR/docker/Dockerfile.ldap" -t ldap-e2e "$CALENDAR_E2E_DIR"
  docker build --quiet --pull -f "$CALENDAR_E2E_DIR/docker/Dockerfile.dex" -t tcalendar-dex-e2e "$CALENDAR_E2E_DIR"
  docker build --quiet --pull -f "$CALENDAR_E2E_DIR/docker/Dockerfile.sabre" -t sabre-e2e "$CALENDAR_E2E_DIR"
else
  # branch-master moves: pull it on every build. A local only image (jib dockerBuild) is kept as is.
  docker pull "$TMAIL_BACKEND_IMAGE" || docker image inspect "$TMAIL_BACKEND_IMAGE" >/dev/null
fi
