#!/bin/sh
# Records the gameplay inside the Linux container (Chrome can't render frame by frame on macOS). Usage: capture/run.sh [MAX_ROUNDS]
set -e
cd "$(dirname "$0")/../.."
docker run --rm -e MAX_ROUNDS="${1:-99}" -v "$PWD":/k -w /k/trailer trailer-capture node capture/capture.mjs
