#!/bin/bash
#
# Stops the QA environment started by start.sh and drops its volumes: the data is gone.
#
#   scripts/qa-environment/stop.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

QA_PROJECT="${QA_PROJECT:-twake-mail-admin-qa}"

# compose interpolates the whole file even to stop it
export TMAIL_BACKEND_IMAGE=unused TMAIL_BACKEND_DIR=/nonexistent QA_ADMIN_PORT=0 QA_WEBADMIN_PORT=0
docker compose -p "$QA_PROJECT" -f "$SCRIPT_DIR/docker-compose.yaml" down --volumes --remove-orphans
echo "==> QA environment '$QA_PROJECT' stopped"
