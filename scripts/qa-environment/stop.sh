#!/bin/bash
#
# Stops the QA environment started by start.sh and drops its volumes: the data is gone.
#
#   scripts/qa-environment/stop.sh
#   scripts/qa-environment/stop.sh --calendar
#
set -euo pipefail

source "$(dirname "$0")/common.sh"

compose down --volumes --remove-orphans
echo "==> QA environment '$QA_PROJECT' stopped"
