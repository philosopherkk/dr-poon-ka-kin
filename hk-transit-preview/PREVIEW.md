# HK Transit v1.2.0 — preview (not published)

Staging copy of the fixed Hong Kong transit planner.

**Do not merge this into the doctor practice site root.** After approval, publish to `philosopherkk/hk-transit` and `philosopherkk.github.io/transit/` only.

## Live preview

https://temporary-fleet-mandolin-cjhyi4y.vercel.app

Claim (keeps the preview longer than ~60 minutes):

https://vercel.com/claim-deployment?code=4697e5c3-2e82-4f17-8a28-07712e889631

## What this fixes

- Live `/transit/` was broken (missing script chunks + JS syntax error)
- Single working `app.js` planner
- Footer: **Version v1.2.0** and **Updated** timestamp
- UX: light/dark theme, EN/中文, tips, auto-plan on chip/pick, Enter to plan
- Map tiles via OpenStreetMap (no Carto API-key watermark)

## Tested

Central → Mong Kok: shortest/cheapest ~14 min, $8.5
