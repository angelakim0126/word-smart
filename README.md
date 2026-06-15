# Word Smart

A vocabulary battle game built for George and Dad to compete on. Two modes:

- **Duel** — turn-based, first to 10/15/20 wins. Wrong answer passes the turn. Streak bonuses on 3+ correct in a row.
- **Beat-the-Clock** — 60 seconds each, side-by-side score compared.

## How the word list works

Ships with ~250 college / SAT-tier vocabulary words and plain-language definitions (written for this game, not copied from any source).

For the actual *Word Smart* book words, use the **Edit word list** button on the home screen:
- Paste lines like `obstreperous: noisy and difficult to control`
- Or use a dash/em-dash/tab as the separator
- Toggle "Use only my custom words" to play with just the book's list

Saved to `localStorage` per device.

## Run locally

```bash
python3 -m http.server 8774
```

or via `~/code/ds-agent/.claude/launch.json` entry `word-smart`.

## Tech

Pure HTML/CSS/JS. No build step. `localStorage` for names, history, custom words. Confetti via `<canvas>`. Personal project — not affiliated with Princeton Review or the *Word Smart* book series.
