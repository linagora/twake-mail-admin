#!/bin/bash
#
# Builds every docker image the e2e stacks need. Run it before `mvn test`, and again whenever
# the code under test changes: the suite drives the production image of the admin app, built
# from the working tree with the release Dockerfile.
#
#   ./pre-build.sh
#   ./pre-build.sh --skip-admin      # only the backend images, the admin image is up to date
#
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$E2E_DIR/.." && pwd)"
ADMIN_IMAGE="${ADMIN_IMAGE:-twake-mail-admin-e2e}"
TMAIL_BACKEND_IMAGE="${TMAIL_BACKEND_IMAGE:-linagora/tmail-backend:distributed-1.0.22}"

if [ "${1:-}" != "--skip-admin" ]; then
  echo "==> Building the admin app image $ADMIN_IMAGE from $REPO_DIR"
  docker build --quiet -t "$ADMIN_IMAGE" -f "$REPO_DIR/Dockerfile" "$REPO_DIR"
fi

echo "==> Mail backend: $TMAIL_BACKEND_IMAGE"
# A local only image (jib dockerBuild) is kept as is
docker pull --quiet "$TMAIL_BACKEND_IMAGE" || docker image inspect "$TMAIL_BACKEND_IMAGE" >/dev/null

echo "==> Calendar backend images"
docker build --quiet --pull -f "$E2E_DIR/docker/Dockerfile.tcalendar" -t twake-admin-e2e-tcalendar "$E2E_DIR"
docker build --quiet --pull -f "$E2E_DIR/docker/Dockerfile.ldap" -t twake-admin-e2e-ldap "$E2E_DIR"
docker build --quiet --pull -f "$E2E_DIR/docker/Dockerfile.sabre" -t twake-admin-e2e-sabre "$E2E_DIR"

echo "==> Playwright chromium"
(cd "$E2E_DIR" && mvn -q test-compile exec:java -Dexec.classpathScope=test \
  -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium")

echo "==> All e2e images built"
