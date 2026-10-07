# MichiMaker

Plan a 9- or 12-pocket Pokémon card binder before you buy, print, or cut anything, including
"Michi method" spreads where one piece of art is cut into card-sized pieces across several pockets.

Live at https://zakpruitt.github.io/michimaker/. Everything stays in your browser: the binder
auto-saves to localStorage and uploaded art to IndexedDB. There's no server or account.

- **Two-page spreads**: pages sit side by side like an open binder, so art across the middle lines up.
- **Card search**: [TCGdex](https://tcgdex.dev) by name, set code, or number. English and Japanese
  printings come back together, with filters for language, rarity, and type. Click or drag a result
  onto a pocket.
- **Michi art**: drag across pockets to select any block, then fill it with gallery art or your own
  uploads. Crop and zoom after placing; cards can sit on top.
- **Owned or needed**: select a card and press `O` to mark it owned. Page headers show what's left to get.
- **Print & export**: true-size sheets (63 × 88 mm per pocket) on US Letter or A4 with dashed cut lines.
  Print the art cut-outs, proxy cards (choose how many of each, optionally in black and white), or
  whole-page guides. You can also download 300 DPI images, including the full art sized for Canva.
- **Sharing**: undo/redo, share links that hold the whole binder in the URL, and `.json` export/import.

Desktop only; phones get a landing page instead.

## Printing

- Print at 100% ("Actual size", not "Fit to page"), then measure one pocket to check it's 63 × 88 mm.
- Matte photo paper or ~300 gsm cardstock feels closest to a real card.
- Binder pages have a ~7 mm seam between pockets. Art sheets print each piece whole with a thin
  strip between pockets; cut out each pocket, throw the strips away, and the picture lines up across
  the seams. Change the gap in the print dialog to match your pages.

## Develop

```
npm install
npm run dev
npm run lint
npm test
npm run build    # type-check + build to dist/
```

Pushing to `master` runs lint, tests, and the build, then deploys to GitHub Pages. Card search uses
the public TCGdex API, so there are no keys to set up.

## Gallery art

Add entries to `src/data/art-gallery.json`. New categories show up as filter chips automatically.

```json
{
  "id": "unique-id",
  "title": "Shown under the thumbnail",
  "category": "Pokémon",
  "sourceUrl": "https://link-to-the-artist",
  "imageUrl": "https://direct-link-to-the-image.png"
}
```

The shipped entries are placeholders. Only use art you're allowed to, from hosts that allow
hotlinking; `sourceUrl` keeps the credit one click away.

## License

[Apache 2.0](LICENSE)

<!-- portfolio
section: featured
name: MichiMaker
year: 2026
tags: React, TypeScript, TCGdex API, GitHub Pages
summary: Plans Pokémon card binders before you print or cut anything, including "Michi method" fan-art
  spreads that span several pockets. It has live TCGdex search across English and Japanese printings,
  true-size cut-out sheets and proxy cards for the cards you still need, and share links that keep the
  whole binder in a compressed URL. No server needed.
-->
