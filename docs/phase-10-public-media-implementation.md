# Public media presentation — implementation

Implemented directly in the existing frontend, without rebuilding administrator media management. No database writes, imports, publication, server restart, authentication changes, payment changes or deployment.

## Visible changes

- Public gallery and approved accommodation galleries: editorial cover image and responsive thumbnails; full-size viewer with Previous/Next, arrow keys, Escape, Close, captions and original-post links where known.
- Room detail pages: existing category media order becomes the gallery order and cover. Room descriptions, rates, availability and booking actions remain unchanged.
- Homepage, accommodation cards, About and facilities: shared photographs decode asynchronously, retain lazy loading (hero retains eager/high priority), and keep their layout when files are missing. No invented image variants or unrelated photographs.
- Facilities: the existing approved hotel-tour placement can also render in an arrival/atmosphere section. It renders only when the public media API returns that approved video. Existing controls, pause and reduced-motion behavior are retained. No new media-placement schema or database setting is introduced.
- Gallery video thumbnails do not load video until opened. The full viewer retains native video controls; arrow keys on a focused video remain native controls.
- Reduced motion disables image zoom/transitions. Galleries use fixed proportions; full-size photographs use `object-fit: contain` to avoid cropping the original.

## Genuine assets integrated

**No new hotel photographs or videos.** The existing `southside-hotel-logo.jpg` and SVG mark remain in place. Workspace/public/build asset checks found no originals; the local private media store contains only the previous 69-byte technical fixture, which was not used. No Git metadata exists in either project directory, and no matching hotel backup archive was found among Downloads files. Other personal directories were not searched.

REA reached Instagram's SouthSide-named profile, but the visible content was a signup/login gate. TikTok browsing was blocked. Hyatt's public page describes lead imagery, accommodation groups and categorized galleries; its live browser returned E6020. Presentation patterns were adapted independently; no Hyatt media or code was copied. No social assets were downloaded, hotlinked into the website or treated as approved for reuse.

## Exact missing originals

Expected relative to `client/public/manus-storage/`. Supply hotel-owned originals with reuse permission and category/content confirmation; equivalent approved original files can instead use the existing administrator uploader.

1. `southside-hotel_4ed40881.jpg` — exterior/hero.
2. `southside-stay_ce1215c9.jpg` — interior/About.
3. `southside-tour_c1a0bee6.jpg` — arrival/tour poster.
4. `southside-classic_e037045c.jpg` — bathroom/detail.
5. `async-images/h4VsiYI2qsri3oj3gNW8em/image-1.webp` — Classic.
6. `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-1.webp` — Royal.
7. `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-2.webp` — Superior.
8. `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-3.webp` — Luxury 205.
9. `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-4.webp` — Luxury 208.
10. `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-5.webp` — Premium 306.
11. `async-images/X72BhlloLAVs2FvW5msYBR/image-1.webp` — Premium 308.
12. `async-images/X72BhlloLAVs2FvW5msYBR/image-2.webp` — Executive.
13. `southside-tour_c48569e3.mp4` — original tour/arrival video.

Original-specific compression, responsive encoding, video codec testing and content suitability cannot be completed without the original files. No thumbnails, fictional fixtures or AI-generated hotel photographs were substituted.

## Verification

Executed using pnpm 10.18 and existing installed dependencies:

```powershell
corepack pnpm check
corepack pnpm exec vitest run server/media/presentation.test.ts server/media/placements.test.ts
corepack pnpm test
corepack pnpm build
node scripts/local/phase10-presentation-browser.mjs
```

- Focused offline tests: 18 passed. Complete offline suite: 356 passed, 53 database-gated tests skipped. TypeScript and production build passed.
- Build warnings remain: platform script lacks module type; main bundle exceeds 500 kB. No dependency upgrades were made.
- Initial public browser test found Escape did not close the viewer through CDP keyboard input. Explicit Escape handling was added and the viewer was centered. The final browser run passed at 1440 and 390 px: homepage, accommodation, About, facilities and gallery had no horizontal overflow; gallery keyboard navigation, Escape, focus restoration, scroll restoration, missing-image handling, room gallery and reduced-motion behavior passed. The reduced-motion assertion allows the existing global 0.01 ms accessibility override rather than requiring a literal zero.
- Public browser checks use only existing public pages and read operations, never administrator authentication, booking submission or payment controls. Screenshots/results are ignored local files.

Changed files: `MediaGallery.tsx` (new), `WebsiteMedia.tsx`, `SouthsideShell.tsx`, `RoomDetail.tsx`, `ContentPages.tsx`, `media.css`, `server/media/presentation.test.ts`, `scripts/local/phase10-presentation-browser.mjs` (new), and this document. Built frontend files under ignored `dist/` were regenerated. Backend authorization, schema, booking and payment code were not changed.

Inspect locally at http://127.0.0.1:3001/gallery, http://127.0.0.1:3001/accommodation and http://127.0.0.1:3001/rooms/classic-room. Refresh existing tabs to load the rebuilt frontend. The already running static server reads updated files without a restart.
