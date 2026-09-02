# HK Transit

Hong Kong public transport planner: MTR, bus and minibus — shortest & cheapest trips with live ETAs.

## Preview / live

- Intended live URL: https://philosopherkk.github.io/transit/
- Source of truth: this repo (`app.js`)

Do **not** copy this app onto the root of `philosopherkk.github.io` — that breaks the other sites. Keep it under `/transit/` only.

## Version

See the in-app footer (`Version` · `Updated`).

## Local

Open `index.html` via any static server (required for module-less fetches of `./data/…`):

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080
