# 🐧 MichiMaker

Plan a 9- or 12-pocket Pokémon card binder before you buy, print, or cut
anything, including **"Michi method"** fan-art spreads, where one large image
is printed, cut into card-pocket-sized pieces, and arranged across multiple
pockets (most often across the two facing pages of an open binder).

100% client-side: no server, no database, no accounts. Your binder lives in
your browser, in shareable URLs, and in `.json` files you export.

**Live app:** https://zakpruitt.github.io/pokemon-binder-planner

## Features

- **Two-page spreads**: pages render side by side like a real open binder,
  so gutter-crossing art makes visual sense. Add/delete pages anywhere, and
  switch any binder between 9-pocket and 12-pocket pages with the toolbar
  toggle (12-pocket cut guides print on A4 landscape).
- **Card search**: search [PokeWallet](https://www.pokewallet.io) by card
  name, set code, or card number, then narrow results by language, rarity,
  and card type. Click a pocket then a result to place it, or just drag a
  result onto a pocket. Hover a placed card for its market price; each page
  header shows the page's total value.
- **Michi method art spans**: drag across empty pockets (spreadsheet-style)
  to select a rectangular region (a 2-wide gutter pair, a full 3×6 spread, a
  vertical 3-stack, anything contiguous), then pick an image to fill it. The
  image is cropped `cover`-style so the slices line up seamlessly across
  pocket boundaries. Click any part of a span to select/remove it as one unit.
- **Art search and sources**: upload your own images (they never leave the
  browser) or search/filter the curated gallery bundled with the app.
- **Print cut guide**: pick the pages to print, render everything at true
  physical size (63mm × 88mm per pocket) with dashed cut lines over the art,
  and choose whether side-by-side art on the same page stays connected as one
  uncut strip. An ink-saving "art only" mode packs just the art pieces onto
  as few A4 sheets as possible.
- **Share by URL**: the whole binder is compressed (gzip via pako) and
  base64-encoded into a `?binder=…` link. Anyone opening the link sees your
  binder. File export/import is the backup for very large binders.
- **Auto-save**: every change is saved to `localStorage` and restored on the
  next visit. A share link in the URL takes precedence over the auto-save.

> **Desktop only:** the planner is built around mouse drag-selection, so
> phones and tablets get a landing page describing the app instead. Narrow
> desktop windows work; below ~960px the side panel stacks under the binder.

## Getting started

```bash
npm install
npm run dev        # local dev server (Vite)
```

### PokeWallet API key (required for card search)

Card search is backed by the [PokeWallet API](https://www.pokewallet.io/api-docs).
Get a key (free keys allow 100 requests/hour) and put it in a `.env.local`
file (git-ignored, so your key never gets committed):

```bash
cp .env.example .env.local
# then edit .env.local:
VITE_POKEWALLET_API_KEY=your-key-here
```

Restart `npm run dev` after changing env files (values are baked in at build
time).

## Adding art to the gallery

Edit `src/data/art-gallery.json`, one entry per piece:

```json
{
  "id": "unique-id",
  "title": "Shown under the thumbnail",
  "category": "Pokémon",
  "sourceUrl": "https://link-to-the-artist-or-source",
  "imageUrl": "https://direct-link-to-the-image.png"
}
```

New categories appear as filter chips automatically. The shipped entries are
placeholder photos; replace them with art you've sourced (and are allowed to
use) yourself. Only hotlink images from sites that permit it; `sourceUrl`
keeps the attribution one click away.

## The Michi method workflow

1. Drag across empty pockets to select the span, e.g. the right column of
   the left page + the left column of the right page for a gutter-crossing
   piece.
2. Open the **Art** tab and click an image (or upload one) to fill the span.
3. When the layout is final, hit **Print cut guide** and pick your options:
   which pages, whole pages or just the packed art (to save ink), and whether
   side-by-side pieces stay connected. Everything prints at exactly 63mm ×
   88mm per pocket with dashed cut lines, so the pieces drop straight into
   real pockets.

Note: art spans are anchored to their spread. If you insert or delete pages
so that a span's two halves would land on different spreads, the app removes
that span and tells you; re-place it where it now belongs.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run deploy` | Build and publish `dist/` to GitHub Pages (`gh-pages` branch) |

## Tech

Vite + React 19 + TypeScript, CSS Modules, `pako` for share-link compression.
No UI framework, no state library, no backend. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for a tour of the codebase (written for
Java/Spring folks).
