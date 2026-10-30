# Missing original SouthSide media

All thirteen original references remain in their existing placements. None of these files exists in the checkout. No replacement hotel photograph or video has been invented, generated or downloaded. This list is a source-code inventory, not a claim that linked social posts have been fetched or that their media is licensed for reuse.

The URL prefix below is `/manus-storage/`. The expected original checkout location for each is `client/public/manus-storage/` followed by the exact key. The existing production build copies that public tree into `dist/public/manus-storage/`. The new independent uploader uses private storage and new `/hotel-media/<UUID>.<extension>` URLs instead; it does not overwrite these paths.

| # | Exact original key after `/manus-storage/` | Usage and known source lead |
| --- | --- | --- |
| 1 | `southside-hotel_4ed40881.jpg` | `hotelMedia[0]`: homepage hero/night exterior; gallery; facilities image collection. Source recorded in the repository: https://www.instagram.com/reel/C8W5KW8Nw4E/ |
| 2 | `southside-stay_ce1215c9.jpg` | `hotelMedia[1]`: homepage story/interior; about page; gallery; facilities image collection. Recorded source: https://www.instagram.com/p/DX-SphpDfKG/ |
| 3 | `southside-tour_c1a0bee6.jpg` | `hotelMedia[2]`: homepage video poster; gallery; facilities arrival image. Recorded source: https://www.instagram.com/reel/DMfVzISNlkD/ |
| 4 | `southside-classic_e037045c.jpg` | `hotelMedia[3]`: homepage facilities/bathroom detail; gallery. Recorded source: https://www.instagram.com/reel/DdFP69HtWUR/ |
| 5 | `async-images/h4VsiYI2qsri3oj3gNW8em/image-1.webp` | Classic Room representative: homepage room card, accommodation and Classic detail fallback. Original binary/source mapping must be exported by the hotel or former project owner. |
| 6 | `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-1.webp` | Royal Suite representative: catalogue, detail and applicable homepage card. Original source mapping unavailable locally. |
| 7 | `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-2.webp` | Superior Suite representative: catalogue, detail and applicable homepage card. Original source mapping unavailable locally. |
| 8 | `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-3.webp` | Luxury Room 205 representative: catalogue, detail and applicable homepage card. Original source mapping unavailable locally. |
| 9 | `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-4.webp` | Luxury Room 208 representative: catalogue/detail fallback. Original source mapping unavailable locally. |
| 10 | `async-images/WjRAYLaGwe6HRgK4pCqLMI/image-5.webp` | Premium Room 306 representative: catalogue/detail fallback. Original source mapping unavailable locally. |
| 11 | `async-images/X72BhlloLAVs2FvW5msYBR/image-1.webp` | Premium Room 308 representative: catalogue/detail fallback. Original source mapping unavailable locally. |
| 12 | `async-images/X72BhlloLAVs2FvW5msYBR/image-2.webp` | Executive Accommodation representative: catalogue/detail fallback. Original source mapping unavailable locally. |
| 13 | `southside-tour_c48569e3.mp4` | Homepage story video; poster is item 3. No exact original download URL or binary is present. Obtain the original export from the hotel/former project owner. |

References originate in `shared/hotel.ts`, the homepage video source, `ContentPages.tsx`, and category presentation defaults. The hotel logo is present and is not part of this missing set. Source leads do not establish ownership, commercial permission, authenticity of every frame, or an exact original-byte match.

## Restoration requirements

Obtain the thirteen exact originals from the hotel-owned export/backup, with permission and any relevant source mapping. Do not use production credentials or scrape social media as a substitute. Validate each supplied file, inspect actual content, record its checksum and ownership, and compare it to the intended placement. MP4 playback needs a real original clip; synthetic integration fixtures do not establish codec compatibility.

Before restoring any original path or binding a new upload to an existing placement, present the file-to-placement mapping for approval. Then restore only the approved originals without changing layout or category/reservation data. Until approved originals exist, the original URLs deliberately remain 404. New technical test uploads are not assigned to any original placement.
