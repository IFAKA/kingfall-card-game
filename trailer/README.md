# Kingfall trailer

Two 33-second trailers made from real gameplay: `out/kingfall-trailer-tall.mp4` (9:16, for TikTok, Reels, Shorts and Reddit) and
`out/kingfall-trailer-wide.mp4` (16:9, for YouTube and itch.io).

## How it is made

1. **Recording** (`capture/`): a script plays the first-game deal (`../app/src/tutorial.ts`) by itself, following the app's own suggestions,
   and records it frame by frame at 1080x1920, 60 fps, with the game's own synthesized sounds in sync. Chrome only renders frame by frame
   on Linux, so it runs in Docker (Colima): `colima start --cpu 6 --memory 8`, `docker build -t kingfall-capture capture`, then
   `npx vite build --outDir ../trailer/app-build --emptyOutDir` in `../app`, then `capture/run.sh` (about 50 minutes) and `capture/mux.sh`.
   `node capture/moments.mjs` lists every fight, tower hit and last stand with its time.
2. **Music** (`music/make-music.ts`): an original 120 BPM track synthesized from scratch, laid out on the same beat plan as the edit (`src/plan.ts`).
3. **Edit** (`src/`, Remotion): `src/cuts.ts` picks the moments, `src/Trailer.tsx` the captions and sections. `npm run studio` previews it;
   `./master.sh` renders both trailers and masters their sound to -14 LUFS.

After a change to the game's look, record again (step 1) and check the times in `src/cuts.ts` against `node capture/moments.mjs`.
