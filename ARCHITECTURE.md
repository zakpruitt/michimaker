# Architecture

A map of the codebase for someone coming from Java/Spring. The app is a
single-page React app with no backend; everything below runs in the browser.

## The stack in Spring terms

| This project | Rough Spring/Java analogy |
|---|---|
| `src/types/` | Your DTOs / entities / records. Pure `interface` definitions, no logic. |
| `src/features/*/…Api.ts`, `…Codec.ts`, `storage.ts` | Your service layer: HTTP clients, serialization, persistence adapters. Plain functions, no React. |
| `src/features/binder/BinderContext.tsx` | A session-scoped `@Service` + DI container in one. Components "inject" what they need: `useBinderActions()` (the operations), `useBinderState()` (the binder), `useSelection()` (the current selection). |
| `src/features/binder/binderReducer.ts` | Command handlers: each action is a command object, applied immutably. |
| `src/features/binder/gridMath.ts` | A static utility class over the domain model. |
| `*.tsx` components | The view layer (think server-side templates, but reactive). |
| `*.module.css` | Component-scoped styles (class names are hashed per file, so no collisions). |
| `vite.config.ts` | Build config (your `pom.xml`, roughly). |
| `.env.local` / `import.meta.env` | `application-local.properties`, except values are baked in at build time. |

## Folder layout

```
src/
├── main.tsx                  # entry point (the "main method"): mounts <App/>
├── App.tsx                   # app shell: providers + page layout
├── appLinks.ts               # shared external URLs
├── domainCssVariables.ts     # domain constants → CSS variables (pocket size)
├── index.css                 # global design tokens (CSS variables) + base styles
├── types/                    # domain model, start reading here
│   ├── binder.ts             # Binder, GridRect, ArtPlacement, PocketRef + grid constants
│   ├── card.ts               # CardSummary (slimmed snapshot of an API card)
│   └── art.ts                # ArtPiece (gallery entry or upload)
├── data/
│   └── art-gallery.json      # curated art gallery, extend this by hand
├── components/
│   └── notices/              # app-wide inline notifications (replaces alert())
└── features/
    ├── binder/               # the binder grid and everything on it
    │   ├── BinderContext.tsx # state + operations ("service layer"), selection model
    │   ├── binderReducer.ts  # state transitions + page insert/delete planners
    │   ├── gridMath.ts       # span/occupancy/page-shift math (pure functions)
    │   ├── artSpanStyle.ts   # per-pocket background crop math for art spans
    │   ├── BinderSpreadList.tsx / BinderPageView.tsx / PocketView.tsx  # views
│   ├── BinderCover.tsx   # inside of the front cover, editable title
    │   └── SelectionBanner.tsx
    ├── card-search/          # PokeWallet card search panel
    │   ├── pokewalletApi.ts  # HTTP client (auth, sets/language map, images)
    │   └── CardSearchPanel.tsx  # search + client-side filters + pagination
    ├── art-gallery/          # upload + curated gallery panel
    │   ├── galleryData.ts    # loads/validates art-gallery.json
    │   └── ArtPanel.tsx
    ├── landing/              # touch-device gate
    │   ├── useIsDesktop.ts   # matchMedia hook: wide viewport + mouse present?
    │   └── MobileLandingPage.tsx  # feature showcase shown on phones/tablets
    ├── how-to/               # the "How to use" guide
    │   ├── useHashRoute.ts   # minimal hash router (#/how-to is the only route)
    │   └── HowToPage.tsx     # step-by-step guide with pure-CSS illustrations
    ├── sharing/              # persistence & interchange
    │   ├── binderCodec.ts    # JSON ⇄ deflate(pako) ⇄ base64url + validation
    │   ├── shareLink.ts      # ?binder=… URL read/write
    │   ├── storage.ts        # localStorage auto-save
    │   ├── fileTransfer.ts   # .json download/upload
    │   └── BinderToolbar.tsx
    └── print/
        ├── PrintContext.tsx  # print dialog + job state; mirrors options to body classes
        ├── PrintDialog.tsx   # options: pages, mode, connected strips
        ├── packArtSheets.ts  # pure packing math for the art-only mode
        ├── ArtOnlyPrintSheets.tsx  # print-only packed art layout
        └── print.css         # the printable cut guide (@media print rules)
```

## Key design decisions

**Coordinate system.** Pages pair into spreads exactly like a real binder:
opening the cover shows page 0 alone on the right (the inside of the front
cover, with the editable binder title, is on the left), then pages (1,2)
face each other, then (3,4), … Left pages are the odd-indexed ones. Pages
are 3 rows by `Binder.pocketColumns` columns (3 = 9-pocket, 4 = 12-pocket,
switchable per binder), so all page-edge math takes the column count. A
`GridRect` (an art span) is anchored to one page; its columns may overflow
past column 2 of a *left* page, which means it continues across the center
gutter onto the facing page. Page 0 has no left partner, so spans anchored
there never cross. `gridMath.listCoveredPockets` is the single source of
truth for which pockets a rect covers, and `spreadIndexOfPage`/`isLeftPage`
own the pairing rule.

**Cards vs. art occupancy.** Cards live inside their page
(`BinderPageData.pockets[9]`), so they move automatically when pages shift.
Art spans can cross pages, so they live in a separate `Binder.artPlacements`
list and are re-anchored (or dropped, with a notice) by
`gridMath.remapPlacements` whenever a page is inserted or deleted.

**Seamless art cropping.** Each pocket in a span renders its own slice of the
image using `background-size`/`background-position` percentages computed in
physical pocket units (63mm × 88mm); see `artSpanStyle.ts`. Because it's all
percentages, the same math works at any on-screen size *and* at true physical
size in the printed cut guide.

**State flow.** One `useReducer` holds the whole binder. The provider in
`BinderContext.tsx` validates operations (surfacing inline notices on
failure) before dispatching, auto-saves to `localStorage` (debounced, flushed
on tab close), and resolves the initial state with precedence: share-link URL
→ localStorage → empty binder. It exposes three contexts so components only
re-render for what they read: the actions object is stable for the app's
lifetime, so drag-selection re-renders the binder grid but not the search or
art panels. Decoded share links and imported files pass through the same
`validateRectShape` chokepoint as live placements.

**Print.** The toolbar's print button opens a dialog
(`features/print/PrintDialog.tsx`): choose pages, choose between the full
page guide and an ink-saving art-only mode (placements shelf-packed onto A4
sheets by `packArtSheets.ts`), and toggle whether side-by-side art on the
same page prints as one connected strip (the default) or every pocket is cut
apart. `PrintContext.tsx` mirrors the chosen options onto `<body>` classes
and hidden-page attributes, then calls `window.print()`; the `@media print`
rules in `features/print/print.css` do the rest. Components tag elements
with `data-print="…"` attributes so the print stylesheet can target them
despite CSS Modules' hashed class names. Everything prints at exactly
63mm × 88mm per pocket, with per-edge cut lines driven by each art cell's
`data-print-cut` attribute.
