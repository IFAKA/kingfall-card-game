# Trailer

Two 33-second trailers made from real gameplay: `out/<name>-trailer-tall.mp4` (9:16, for TikTok, Reels, Shorts and Reddit) and
`out/<name>-trailer-wide.mp4` (16:9, for YouTube and itch.io).

## Rename the game, or rebuild after the game changes

1. Put the new name and web address in `trailer.config.json` (one value each). Every title card, end card, caption logo, the file names
   and the videos' title metadata read them from there.
2. Run `npm run rebuild` here (about 6 minutes). It builds the game from `../app`, records a new first game, finds the moments the
   trailer cuts to in that recording, makes the music and renders and masters both videos.

The recorded footage shows only the game board, which has no name on it, so the name in the game itself doesn't appear in the trailer.
`npm run master` (`trailer-kit master`) re-renders from the last recording in about two minutes (enough when only `trailer.config.json` or the edit changed).

## How it is made

The engine lives in [trailer-kit](https://github.com/IFAKA/trailer-kit) (a sibling folder, `../../../trailer-kit`); this folder is Suitkeep's part of it:

- `trailer.config.json`: name, web address, how to build the game, the music and moments commands.
- `driver.mjs`: plays the first-game deal (`../app/src/tutorial.ts`) by itself, following the app's own suggestions; reads the app's storage keys and tip names from `../app/src/App.tsx`. The only code that touches the game.
- `src/moments.ts`: finds what the edit shows (the ace beating a king, the ×2 wins, a small card running and its tower hit, towers breaking and falling, your last stand, the king falling) in `out/timeline.json` by what happened, not by time. `node moments.mjs` lists every fight and tower hit with its time.
- `music/make-music.ts`: an original 120 BPM track synthesized from scratch, on the same beat plan as the edit (`src/plan.ts`).
- `src/cuts.ts`, `src/Trailer.tsx`: how each moment is framed, and the sections and captions. `npm run studio` previews it in the browser.
