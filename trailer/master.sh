#!/bin/sh
# Renders both trailers from the current recording and masters their sound: -14 LUFS (what YouTube, TikTok and Instagram play at),
# peaks under -1.5 dBFS. The file names and the video title come from trailer.config.json:
# out/<name>-trailer-tall.mp4 (9:16, TikTok/Reels/Shorts/Reddit) and out/<name>-trailer-wide.mp4 (16:9, YouTube/itch.io).
set -e
cd "$(dirname "$0")"
NAME=$(node -p "require('./trailer.config.json').name")
SLUG=$(node -p "require('./trailer.config.json').name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')")
node music/make-music.ts
for pair in Tall:tall Wide:wide; do
  C=${pair%:*} c=${pair#*:}
  npx remotion render src/index.ts $C out/raw-$c.mp4 --crf=16 --concurrency=6 --log=error
  ffmpeg -v error -y -i out/raw-$c.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" -c:a aac -b:a 256k \
    -metadata title="$NAME trailer" -movflags +faststart "out/$SLUG-trailer-$c.mp4"
  rm out/raw-$c.mp4
  echo "out/$SLUG-trailer-$c.mp4"
done
