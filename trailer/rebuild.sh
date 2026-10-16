#!/bin/sh
# Rebuilds both trailers from the game as it is now, in one go (about an hour):
# builds the game, records a new first game in the Linux container, finds its moments, makes the music, renders and masters both videos.
# Run it after renaming the game (edit trailer.config.json first) or after any change to how the game looks.
set -e
cd "$(dirname "$0")"
echo "== $(node -p "require('./trailer.config.json').name") — $(node -p "require('./trailer.config.json').url")"

# the recording runs in Docker under Colima (Chrome renders frame by frame only on Linux); your default Docker context is left alone
mine=$(docker context show 2>/dev/null || true)
started=
if ! colima status >/dev/null 2>&1; then
  echo "== starting Colima"
  colima start --cpu 6 --memory 8
  started=1
  [ -n "$mine" ] && docker context use "$mine" >/dev/null # colima start switches the default context; put yours back
fi
export DOCKER_CONTEXT=colima
# on the way out (done or failed): stop Colima if this script started it, put your Docker context back, keep the exit status
finish() {
  status=$?
  if [ -n "$started" ]; then colima stop >/dev/null 2>&1 || true; [ -n "$mine" ] && env -u DOCKER_CONTEXT docker context use "$mine" >/dev/null 2>&1; fi
  exit $status
}
trap finish EXIT
docker build -q -t trailer-capture capture >/dev/null

echo "== building the game"
(cd ../app && npx vite build --outDir ../trailer/app-build --emptyOutDir --logLevel warn)
echo "== recording a game (about 50 minutes)"
capture/run.sh
capture/mux.sh
echo "== the moments the trailer cuts to"
node capture/moments.mjs | grep -E "ACE|×2|DOWN|FREE|crack|break" | head -20
echo "== rendering"
./master.sh
echo "== done"
