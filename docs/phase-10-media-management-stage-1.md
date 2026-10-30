# Phase 10, stage 1: administrative media management

## Scope and database decision

Implemented locally without importing real media, publishing fixtures, making a database connection, running migrations, restarting the server or deploying. No financial, reservation, inventory, staff or Paystack record/configuration was changed. All tests use mocks, in-memory data or existing temporary technical fixtures. No social platform downloads were attempted.

**No schema change or migration is needed.** Future authorized placement saves use one new dedicated `hotel_settings` key, `website_media_placements_v1`, and the existing audit table. No setting row has been created by this implementation work. Each save contains a revision, ordered asset IDs and up to five previous placement snapshots. A unique-key upsert and row lock serialize first/subsequent saves; expected-revision checks reject stale changes. Audit failure rolls back the setting update in the transaction. Only placement configuration and its audit entry are written by this future operation, never inventory, category prices or reservations. No media bytes are overwritten.

## Implemented behavior

- Existing private upload, file validation, rights acknowledgement, publication, administrator authorization, origin protections and audit behavior remain in place.
- The media panel now includes a visual library of private previews for uploaded photographs/videos. Private assets can be reviewed but cannot be selected for website placement.
- Administrators can select only approved published assets for homepage hero/story/detail, tour poster/video, hotel gallery, accommodation gallery, About and the existing image-bearing facilities positions.
- Each existing room category is a selectable image-gallery target. Category overrides affect only rendered media; existing category/inventory/reservation records are not edited. The existing room-detail renderer displays the ordered gallery and existing catalogue cards use its first image as cover.
- Ordering, make-cover, remove, selection previews, reasons, save feedback and undo are available. Undo restores the **last global placement snapshot**, up to five saves; it is not per-category unlimited version history. It refuses to restore assets that no longer pass approval/publication checks.
- Publication and placement are separate. Saving a placement never publishes an asset. Replacing an assignment retains previous media and records both before/after assignments in the audit. Existing publication controls remain explicit separate actions.
- Public media responses project only approved published local upload URLs and safe display metadata. Private/unapproved assets are filtered at read time, including pre-existing raw category image references to independent uploads. Public serving still applies the original permission and integrity checks.
- Original `/manus-storage/` references remain as legacy fallbacks; no missing original has been replaced with fictional or unrelated imagery. Failed/missing photographs show a neutral unavailable state. Assigned gallery fetch failures show a temporary-unavailability message.
- The public hotel tour and new gallery videos use native controls plus explicit Play/Pause, inline playback and `preload=none`. They do not autoplay. A change to reduced-motion preference pauses playback; manual playback remains available. Failed video playback produces an unavailable message. Existing administrator publication preview remains under administrator access.
- Layout uses existing SouthSide controls and colors with a responsive media-library grid; navigation, content sections and public booking routes are preserved. Approved asset alt descriptions are used for assigned images. No payment, booking, inventory or authentication source logic was changed.

## Files changed

New:

1. `shared/mediaPlacements.ts` — allowed targets, input validation, section cardinality/kind rules and safe public media type.
2. `server/media/placements.ts` — pure approved-asset projection, ordered changes, revision conflicts, bounded history and safe undo.
3. `server/media/placementRepository.ts` — existing-table reads, transactional saves/undo, category existence checks and auditing.
4. `server/media/placements.test.ts` — 14 domain/authorization cases.
5. `server/media/placementRepository.test.ts` — three mocked persistence/lock ordering, audit rollback and service-failure cases.
6. `server/media/presentation.test.ts` — two server-rendered video-control/missing-image checks.
7. `client/src/hooks/useWebsiteMedia.ts` — read-only public media query.
8. `client/src/components/MediaPlacementPanel.tsx` — visual selection, ordering, cover, target, reason and undo interface.
9. `client/src/components/WebsiteMedia.tsx` — assigned public image/video gallery.
10. `client/src/components/HotelVideo.tsx` — user-controlled, non-autoplay playback and reduced-motion handling.
11. `client/src/media.css` — scoped media-library/video/missing-image styles.
12. This report.

Modified:

13. `server/routers.ts` — protected placement read/save/undo procedures and safe public media query.
14. `server/management/categories.ts` — category media override resolution and published-only independent media filtering.
15. `server/admin-page.test.ts` — new procedure mocks in the existing dashboard-render regression.
16. `client/src/components/MediaPanel.tsx` — attaches the new placement library to existing upload/publication controls.
17. `client/src/components/SouthsideShell.tsx` — neutral failed-image handling and media stylesheet import.
18. `client/src/pages/Home.tsx` — existing homepage slots resolve assigned images/poster/video and use controlled video playback.
19. `client/src/pages/Accommodation.tsx` — optional assigned accommodation gallery.
20. `client/src/pages/ContentPages.tsx` — existing gallery, About and relevant facilities media resolve assignments.

Generated `dist` artifacts were also rebuilt. Room-detail source needed no modification because it already renders the ordered category images. No schema, lockfile, dependency, private credential or production configuration changed.

## Verification

Commands executed from the nested project using the existing pinned package manager:

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm check
corepack pnpm test
corepack pnpm build
corepack pnpm exec vitest run server/media/presentation.test.ts server/media/placementRepository.test.ts
corepack pnpm exec vitest run server/media/placementRepository.test.ts server/admin-page.test.ts server/media/presentation.test.ts
```

The full suite, typecheck and build were rerun after fixes. The first full suite failed one dashboard rendering test because its mock did not declare the new procedures. An initial additional test run also found a syntax error in the newly written mock repository fixture. Both were corrected; the focused rerun passed all 12 checks in its three files. A final content review caught character encoding damage in edited page text and restored the intended punctuation; typecheck and build were repeated afterward.

Final complete offline suite: **354 passed, 52 skipped; 32 passing files and three skipped database-gated files**. The skips are real-database suites; no real MySQL result is claimed. Existing upload/storage/authorization, category, booking, inventory, staff authentication and mocked payment regressions passed. Paystack was not contacted.

**Final TypeScript and production build both passed, exit 0**, including the repeat after the punctuation correction. Existing platform-script and large-bundle warnings remain nonfatal. No browser/mobile interaction or real-database transaction verification was executed. Server-rendered control tests do not prove native codec playback or actual reduced-motion events on devices.

## Remaining limits and approvals

- Existing library listing is limited to the newest 100 uploads; no pagination or search was added in this first stage.
- Up to eight assets per gallery/category, 64 configured targets, five undo snapshots and a bounded setting size. Large future media catalogues may warrant a separately reviewed media-only schema rather than increasing JSON indefinitely.
- Category placement overrides take precedence over the older category URL list. Administrators should manage the selected category through the placement target or undo its override; editing the old URL list alone will not supersede an active placement override.
- No transcoding, responsive image derivatives, new codecs, EXIF processing, unpublish/delete workflow or rights-document upload was added. Original validation/publication remains the foundation. Real original-media quality and licensing remain unresolved.
- Missing originals are still missing; no fictional hotel image or new upload was publicly published. Technical fixture IDs in mocked tests never enter the development database or filesystem media store.
- MySQL first-save concurrency, storage serving, real browser selection/drag-free ordering, playback, mobile layout and audit persistence still require isolated local integration/browser verification. Mock tests establish expected behavior, not real database concurrency guarantees.
- The server was not restarted, so current browser URLs continue to serve the previously loaded version. A controlled restart and local browser/database fixture exercise require separate approval. Genuine import, any public publication, future migration or deployment also requires separate approval. Paystack remains on hold; no payment initialization or verification is authorized by this stage.
