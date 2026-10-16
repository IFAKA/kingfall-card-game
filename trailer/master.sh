#!/bin/sh
# Renders both trailers and masters their sound: -14 LUFS (what YouTube, TikTok and Instagram play at), peaks kept under -1.5 dBFS.
# Output: out/kingfall-trailer-tall.mp4 (9:16, TikTok/Reels/Shorts/Reddit) and out/kingfall-trailer-wide.mp4 (16:9, YouTube/itch.io).
set -e
cd "$(dirname "$0")"
node music/make-music.ts
for pair in Tall:tall Wide:wide; do
  C=${pair%:*} c=${pair#*:}
  npx remotion render src/index.ts $C out/raw-$c.mp4 --crf=16 --concurrency=6
  ffmpeg -v error -y -i out/raw-$c.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" -c:a aac -b:a 256k -movflags +faststart out/kingfall-trailer-$c.mp4
  rm out/raw-$c.mp4
done
