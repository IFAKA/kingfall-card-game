# Kingfall

A one-player lane battle played with a standard 52-card deck, inspired by real-time lane games: spend elixir, send soldiers down two lanes, defend, counterattack, and take down the enemy king tower.

- `RULEBOOK.md`: the complete rules (the product).
- `app/`: the table guide web app that runs the enemy and walks you through each step. See `app/README.md`.
- `print/Kingfall-Rulebook.pdf`: the printable rulebook (2 pages, A4). Regenerate after any rules change with `python3 tools/rulebook_pdf.py` (needs Google Chrome).
- `PLAYTEST.md`: the playtest sheet and log template used to test the rules with real players.
- `sim/`: Python balance simulator (bots, deck curves, rule variants) used to tune the rules. `sim_v1_backup/` is an older copy of it.
