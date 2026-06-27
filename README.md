# World Cup 26 Tracker

A responsive, fully-interactive FIFA World Cup 2026 tracker — recreated from the
`design_handoff_worldcup_tracker` prototype as a real **React (Vite)** app, per the
handoff's instruction to recreate (not port) the design-component runtime.

## Features

- **Today** — purple hero with live tournament stats, featured live-match card,
  follow-a-team cards, today's results, and up-next fixtures.
- **Matches** — filter chips (All / Live / Upcoming / Group A–L), fixtures grouped by date,
  auto-scrolled to today on entry.
- **Groups** — 12 group cards with **runtime-computed** standings (P W D L GD Pts), rank
  color bands (top-2 green, 3rd amber). Click a team to open its profile; ★ to follow.
- **Bracket** — horizontally-scrolling Round of 32 → Final built from the live knockout
  schedule (teams + scores + kickoff times), plus a runtime-computed third-place race.
- **Stats** — multi-category leaderboards (goals, assists, shots, saves, cards, passes…).
- **Teams** — alphabetical list of all qualified teams with a **search box** (filter by
  name, 3-letter code, or group) and a ★ follow toggle on each row.
- **Team modal** — opens from any flag/crest or team name. **Squad** tab shows the full
  26-man roster (headshot, jersey, position, age, nationality, height, injury status, coach)
  from ESPN's per-team roster endpoint; **Schedule** tab lists every fixture and opens the
  match center on click.
- **Match modal** — a full match center: Summary (real goal timeline with assists), Lineups
  (real XIs on a pitch by formation), Stats (possession/shots/corners/fouls/saves), Form,
  head-to-head, and broadcasts. While a game is **live**, the modal refreshes itself every 30s.
- **Match alerts** — opt-in browser notifications 15 minutes before a followed team kicks off.
- **Theming & prefs** — light/dark theme and favorites, persisted to `localStorage`.

### Data — ESPN public API only

All data (fixtures, scores, standings, goalscorers, lineups, match stats, crests) comes
**live from ESPN's public API** (`soccer/fifa.world`). There is **no bundled sample data**
and **no API key or CORS proxy** — ESPN sends `Access-Control-Allow-Origin: *`, so the
browser calls it directly. The app shows a loading state on first paint, then renders live
data and polls scores every 30s; if ESPN can't be reached it shows an error screen with a
Retry button.

> ESPN's API is **undocumented/unofficial** and can change without notice. It was chosen
> because the football-data.org free tier omits per-match goal events, lineups, and stats
> (those require a paid tier), which are exactly what the match modal needs.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm start        # serve the built dist/ on $PORT (defaults to 3000)
```

`npm run build` emits a self-contained static bundle in `dist/`. Since the app talks to
ESPN directly from the browser (no backend, no env vars, no secrets), `dist/` can be served
by any static host or CDN. `npm start` (`serve -s dist -l $PORT`) is a simple production
server with SPA fallback if you prefer to run a Node process.

## Architecture

| Path | Role |
| --- | --- |
| `src/data/wc-espn.js` | The single data source — normalizes ESPN scoreboard/standings/leaders/summary/roster into the app's internal shape; provides `load()`, `refreshLive()`, `detail()`, `teamRoster()`. No key/proxy. |
| `src/store.jsx` | React context store: state, persistence, loading/error handling, 30s score polling, live match-detail polling, match alerts, and derived helpers (scores, standings, third-place race, goal events). |
| `src/theme.js` | Light/dark design tokens from the handoff. |
| `src/lib/` | Pure helpers — runtime standings/third-place computation, formation rows, color/date utils. |
| `src/components/` | Header, atoms (badge/star/pill), match row, match modal, team modal, icons. |
| `src/views/` | Today / Matches / Groups / Bracket / Stats / Teams. |

Standings and the third-place race are **never hardcoded** — they're computed from the
live match list on every render.

### ESPN endpoints used (all CORS-open, no key)

- `site.api.espn.com/.../fifa.world/scoreboard?dates=20260611-20260719` — all 104 fixtures, scores, status, venues, team colors/logos
- `site.api.espn.com/apis/v2/.../fifa.world/standings` — 12 groups + memberships
- `sports.core.api.espn.com/.../seasons/2026/types/1/leaders` — leaderboards (athlete names resolved via `$ref`)
- `site.api.espn.com/.../fifa.world/summary?event={id}` — per-match goal events (with assists), lineups, boxscore stats, form, head-to-head, broadcasts
- `site.api.espn.com/.../fifa.world/teams/{id}/roster` — full 26-man squad (jersey, position, age, nationality, height, injuries) + head coach
