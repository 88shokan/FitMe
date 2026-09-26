# FitMe

Cut apparel returns by letting shoppers see a garment on themselves before they
order. Built at Temple Owl Hacks, sustainability track.

Roughly a quarter of clothes bought online get returned, and fit is the leading
reason. Every avoided return is a shipping round trip — and sometimes a
landfilled garment — that never happens.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then paste your FAL_KEY
npm run dev
```

Only `FAL_KEY` is required. Get one at <https://fal.ai/dashboard/keys>.
`ANTHROPIC_API_KEY` is optional — without it the size recommendation falls back
to the deterministic rule-based path, which always works.

Then save eight product photos into `public/garments/` (see the README in that
folder for the exact filenames).

## How it works

```
Browser                Next.js route handler              fal.ai
  │
  ├─ photo (File) ────▶ POST /api/tryon
  │                      ├─ upload person image ──────────▶ fal storage
  │                      ├─ garment: catalog or scraped URL
  │                      ├─ tryOn() ──────────────────────▶ FASHN v1.6
  │                      │                           ◀───── generated image
  │                      ├─ recommendFit()  (rules, then Claude)
  │                      └─ avoidedKgCo2e()
  │  ◀── { tryOn, fit, impactKgCo2e } ──┘
  │
  └─ render; nothing persisted server-side
```

No accounts, no database, no ORM. That absence is deliberate — it keeps the
build small and doubles as the privacy story.

## Layout

| Path | What it does |
|---|---|
| `src/lib/tryon.ts` | Try-on provider adapter. **All** model-specific code lives here |
| `src/lib/fit.ts` | Size recommendation: deterministic rules, then optional Claude refinement |
| `src/lib/impact.ts` | CO₂e math. Every assumption is named and needs a real citation |
| `src/lib/catalog.ts` | The eight seeded garments and their size charts |
| `src/app/api/tryon/route.ts` | Main endpoint: upload → generate → size → impact |
| `src/app/api/product/route.ts` | Scrapes `og:image` so you can try on any store's product URL |

## Key decisions

**A purpose-built try-on model, not a general image generator.** A general model
invents a garment resembling a description — pattern, logo and cut all drift. If
the shirt in the output isn't genuinely the shirt from the product page, the fit
claim is fiction. `src/lib/tryon.ts` is a thin adapter so a provider swap is a
five-minute job.

**Deterministic size logic first, LLM second.** `deterministicFit()` always
returns an answer with no network call. Claude only rewrites the rationale. The
demo cannot be broken by a rate limit or dead wifi.

**No body measurement from photos.** Unreliable, and it would eat the whole
hackathon. Self-reported usual size is a stronger signal anyway.

**Assumptions are visible.** The impact number expands to show all five inputs.
Judges trust stated assumptions far more than a confident magic number.

## Before you present

- [ ] Replace every `CITE` placeholder in `src/lib/impact.ts` with a real source
- [ ] Save real product images into `public/garments/`
- [ ] Set `FAL_TRYON_MODE=quality` for the demo build
- [ ] Cache 2–3 known-good results so a wifi failure can't kill the demo
- [ ] Rehearse the demo end to end, three times
- [ ] Don't claim photos are "deleted immediately" — uploads live on fal's CDN
      unless you add an explicit delete call (see the note in the try-on route)
