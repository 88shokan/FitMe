# FitMe

**See it on you before you order.** Built at Temple Owl Hacks — sustainability track.

---

## What FitMe does

### The problem

Around a quarter of clothes bought online get sent back, and **fit is the single
biggest reason** — not colour, not quality, not shipping speed. People order two
sizes intending to return one, or guess wrong and return the lot.

Every one of those returns is a physical event, not a digital one: a parcel moves
back through the network, gets inspected, repackaged, and reshipped — and a
meaningful share never gets resold at all, going to liquidation, landfill or
incineration instead. The emissions are real, and they're caused by a problem
that's fundamentally about *information*: the shopper couldn't tell whether it
would fit.

### The fix

FitMe closes that information gap before the order is placed.

1. **Upload one full-body photo.** No measuring tape, no body scan, no app.
2. **Pick a garment** — from the catalog, by uploading a product image, or by
   pasting a product link from a store.
3. **Get three things back:**
   - a generated image of **you wearing that specific garment**
   - a **recommended size with a confidence score**, reasoned from the garment's
     real size chart and fabric
   - an **estimate of the CO₂e avoided** by not making a return

### What makes it more than a novelty

**The garment is the actual garment.** FitMe uses a purpose-built virtual try-on
model, not a general image generator. A general model would *invent* something
resembling a description — pattern, logo and cut all drift. Here the real product
photo is composited onto the real person, so what you see is what ships.

**The size advice reasons about the specific garment.** It isn't a generic
"you're a medium." The same shopper — 5'10", 165lb, usually wears M — gets
genuinely different answers:

| Garment | Recommendation | Reasoning |
|---|---|---|
| Oversized Crewneck | **S** (90% confidence) | runs 6.5" roomier than a standard M |
| Leather Moto Jacket | **L** (55% confidence) | runs 2.0" tighter, and leather has no give |
| Wide-Leg Trousers | **M** (79% confidence) | cut close to standard |

**The impact number shows its work.** Tap "show our assumptions" and all five
inputs are listed with their sources. A stated assumption is more honest — and
more persuasive — than a confident magic number.

### What's real and what's estimated

Being precise about this matters more than overselling it:

| Component | Status |
|---|---|
| Try-on image | Real model inference, ~8–35s per generation |
| Size recommendation | Real logic over real size-chart structure |
| Size chart *values* | **Plausible placeholders** — not scraped from retailers |
| CO₂e figure | **An estimate** from five stated assumptions |
| Body measurements | Self-reported, never inferred from the photo |

---

## Tech stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | **Next.js** (App Router) | 16.3.6 | One repo, one deploy target. Route handlers are the backend — no separate API server |
| UI | **React** | 19.2.8 | — |
| Language | **TypeScript** | 5.9.3 | Shared types between client and API kept the team unblocked working in parallel |
| Styling | **Tailwind CSS** | 4.3.3 | v4's CSS-first `@theme` maps our denim design tokens straight to utilities |
| Try-on model | **FASHN Virtual Try-On v1.6** via `@fal-ai/client` | 1.10.1 | Purpose-built VTON. Takes person + garment images, preserves pose and identity |
| Fit reasoning | **Claude Opus 5** via `@anthropic-ai/sdk` | 0.128.0 | Turns the rule-based size call into a rationale a shopper would actually read |
| Validation | **Zod** | 4.6.5 | Every API input is schema-validated at the boundary |
| Runtime | **Node.js** | 24.21.0 | — |
| Linting | **ESLint** | 9.39.5 | — |
| Fonts | Barlow Condensed / Barlow / Source Sans 3 | — | Workwear typography for the denim design system |

### Deliberately not used

The absences are design decisions, not gaps:

- **No database.** Nothing is persisted server-side. Photos go straight to the
  model and only the result URL comes back. Less to build, and it doubles as the
  privacy story.
- **No authentication.** Accounts would add hours and buy the demo nothing.
- **No body-measurement CV.** Estimating measurements from a photo is unreliable,
  and chasing it would have consumed the entire hackathon. Self-reported usual
  size is a stronger signal anyway.
- **No self-hosted diffusion.** A hosted API meant we spent the weekend on the
  product instead of on CUDA.

---

## Setup

```bash
npm install
cp .env.local.example .env.local   # then paste your FAL_KEY
npm run dev
```

Only `FAL_KEY` is required — get one at <https://fal.ai/dashboard/keys>.
`ANTHROPIC_API_KEY` is optional; without it the size recommendation falls back to
the deterministic rule-based path, which always works.

To populate the catalog images, put product-image URLs in `garments.txt` and run:

```bash
npm run garments
```

Each teammate needs **their own** `FAL_KEY`. `.env.local` is gitignored, so keys
never sync between you — that's intentional.

---

## How it works

```
Browser                Next.js route handler              fal.ai
  │
  ├─ photo (File) ────▶ POST /api/tryon
  │                      ├─ upload person image ──────────▶ fal storage
  │                      ├─ resolve garment (upload / catalog / URL)
  │                      ├─ tryOn() ──────────────────────▶ FASHN v1.6
  │                      │                           ◀───── generated image
  │                      ├─ recommendFit()  (rules, then Claude)
  │                      └─ avoidedKgCo2e()
  │  ◀── { tryOn, fit, impactKgCo2e } ──┘
  │
  └─ render; nothing persisted server-side
```

### Layout

| Path | What it does |
|---|---|
| `src/lib/tryon.ts` | Try-on provider adapter. **All** model-specific code lives here |
| `src/lib/fit.ts` | Size recommendation: deterministic rules, then optional Claude refinement |
| `src/lib/impact.ts` | CO₂e math. Every assumption is named and needs a real citation |
| `src/lib/catalog.ts` | Seeded garments and their size charts |
| `src/lib/net.ts` | SSRF guards and bot-wall detection for user-supplied URLs |
| `src/app/api/tryon/route.ts` | Main endpoint: upload → generate → size → impact |
| `src/app/api/product/route.ts` | Resolves a product URL to a garment image |
| `scripts/fetch-garments.mjs` | `npm run garments` — downloads catalog images |

---

## Key decisions

**A purpose-built try-on model, not a general image generator.** If the garment
in the output isn't genuinely the garment from the product page, the fit claim is
fiction. `src/lib/tryon.ts` is a thin adapter, so swapping providers is a
five-minute job.

**Deterministic size logic first, LLM second.** `deterministicFit()` always
returns an answer with no network call; Claude only rewrites the rationale. The
demo cannot be broken by a rate limit or dead wifi.

**Catalog images are uploaded, never linked.** Handing the model a URL built from
the request origin yields `http://localhost:3000/...`, which the model's servers
cannot reach. That bug would have worked in production and never in local dev.

**Assumptions are visible.** The impact number expands to show all five inputs.

---

## Garment sources — read this before demoing

The three ways to supply a garment are **not** equally reliable:

| Path | Reliability | Use it for |
|---|---|---|
| Upload a garment image | Always works | **The live demo** |
| Paste a direct image URL | Works nearly always | Demoing a specific real product |
| Paste a product page URL | Store-dependent | Nice when it works |

Large retailers (Lululemon, Nike, Zara, Uniqlo, H&M) sit behind Akamai or
Cloudflare bot protection. Their product pages sometimes resolve on a first
request and then get blocked — **worse than failing outright**, because it works
while you're testing and fails on stage. Shopify-backed stores (Allbirds,
UNTUCKit, most indie brands) work consistently.

Their image CDNs are usually *not* protected, so for a blocked store you can
still right-click the product photo, copy the image address, and paste that.
`/api/product` detects the bot wall and tells the user exactly this.

---

## Before you present

- [ ] Replace every `CITE` placeholder in `src/lib/impact.ts` with a real source
- [ ] Copy real size charts off the product pages into `src/lib/catalog.ts`
- [ ] Set `FAL_TRYON_MODE=quality` for the demo build
- [ ] Cache 2–3 known-good results so a wifi failure can't kill the demo
- [ ] Raise `MAX_PER_WINDOW` in `api/tryon/route.ts` before deploying — the whole
      team on one venue wifi shares a public IP and one rate-limit bucket
- [ ] Rehearse the demo end to end, three times
- [ ] Don't claim photos are "deleted immediately" — uploads live on fal's CDN
      unless you add an explicit delete call (see the note in the try-on route)
