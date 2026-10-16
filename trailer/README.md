# Trailer

Two 33-second trailers made from real gameplay: `out/<name>-trailer-tall.mp4` (9:16, for TikTok, Reels, Shorts and Reddit) and
`out/<name>-trailer-wide.mp4` (16:9, for YouTube and itch.io).

## Rename the game, or rebuild after the game changes

1. Put the new name and web address in `trailer.config.json` (one value each). Every title card, end card, caption logo, the file names
   and the videos' title metadata read them from there.
2. Run `npm run rebuild` here (about an hour). It builds the game from `../app`, records a new first game, finds the moments the
   trailer cuts to in that recording, makes the music and renders and masters both videos.

The recorded footage shows only the game board, which has no name on it, so the name in the game itself doesn't appear in the trailer.
`npm run master` re-renders from the last recording in about two minutes (enough when only `trailer.config.json` or the edit changed).

## How it is made

1. **Recording** (`capture/`): a script plays the first-game deal (`../app/src/tutorial.ts`) by itself, following the app's own
   suggestions, and records it frame by frame at 1080x1920, 60 fps, with the game's own synthesized sounds in sync. Chrome only renders
   frame by frame on Linux, so it runs in Docker under Colima (`rebuild.sh` starts Colima if needed, stops it after, and leaves your
   default Docker context alone). The app's storage keys and tip names are read from `../app/src/App.tsx`, so they can change freely.
2. **Moments** (`src/moments.ts`): the edit finds what it shows (the ace beating a king, the ×2 wins, towers breaking and falling, your
   last stand, the king falling) in `out/timeline.json` by what happened, not by time, so a new recording lines up by itself. If a
   recording lacks one, the render stops and names it. `node capture/moments.mjs` lists every fight and tower hit with its time.
3. **Music** (`music/make-music.ts`): an original 120 BPM track synthesized from scratch, on the same beat plan as the edit (`src/plan.ts`).
4. **Edit** (`src/`, Remotion): `src/cuts.ts` frames each moment, `src/Trailer.tsx` holds the sections and captions. `npm run studio`
   previews it in the browser.
