#!/bin/bash
#
# Builds the admin image start.sh runs, from the working tree, with the release Dockerfile, and
# pulls the distributed tmail-backend image.
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#   TMAIL_BACKEND_IMAGE=linagora/tmail-backend-distributed scripts/qa-environment/build.sh
#                                      # a local build of tmail-backend/apps/distributed (jib)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

TMAIL_BACKEND_IMAGE="${TMAIL_BACKEND_IMAGE:-linagora/tmail-backend:distributed-branch-master}"

docker build -t twake-mail-admin-qa -f "$REPO_DIR/Dockerfile" "$REPO_DIR"

# branch-master moves: pull it on every build. A local only image (jib dockerBuild) is kept as is.
docker pull "$TMAIL_BACKEND_IMAGE" || docker image inspect "$TMAIL_BACKEND_IMAGE" >/dev/null
