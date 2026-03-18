# Project Notes — oam-vibe

## Current State (rewritable)
<!-- Any tool may rewrite this section to reflect the latest status. -->
- Status: Active development — significant Map.jsx refactor in progress (uncommitted)
- 3 files modified (uncommitted): `src/components/Map.jsx`, `vite.config.js`, `CLAUDE.md`
- Export of stuck session saved at: `2026-03-18-140150-this-session-is-being-continued-from-a-previous-co.txt` (can be deleted after context is recovered)
- Next: Continue testing TMS rendering consistency, then commit and deploy

### What changed this session (2026-03-18)

**Core fix: Removed corsproxy.io for thumbnails**
- Root cause of broken previews on live site: `corsproxy.io` returning 403
- Discovered S3 bucket already has CORS headers — thumbnails load directly
- Added `?x-map=1` query param to avoid browser cache conflicts (sidebar `<img>` caches non-CORS responses; different URL prevents MapLibre from getting stale cached versions)
- Removed Vite dev CORS proxy plugin from `vite.config.js`

**Dynamic TMS thresholds (large vs small images)**
- Large satellite images (>50 sq km): TMS tiles at z12+ (stretched thumbnails look bad at that scale)
- Small/drone images: thumbnails until z16, then TMS for all visible (max 8 layers)
- Selected images: TMS at z10+ (lower threshold so selection doesn't revert to blurry thumbnail)
- Added `nodata=0` to TiTiler tile URLs for transparent black borders

**TMS layer ordering fix**
- Layers were added in arbitrary order from `querySourceFeatures`
- Now sorted by bbox area: largest on bottom, smallest on top, selected always on top

**TMS bounds/panning fix**
- `getFullBbox` used `querySourceFeatures` which only returns loaded tile fragments
- Panning evicted tiles, causing `bounds` on TMS source to clip imagery
- Fix: selected images get no bounds constraint (accept 404s); non-selected images detect and update stale bounds
- `desiredTms` map now stores `{ url, bounds }` objects instead of plain URL strings

### Remaining issues
1. **TMS rendering inconsistency when panning** — some portions of images still not rendering at TMS zoom levels after panning. The bounds fix helped but user saw continued inconsistency in final screenshots before session crashed.
2. **Black edges on some TMS tiles** — `nodata=0` helps for most but some COGs have actual dark pixel data at edges (data-level, not code bug)
3. **CLAUDE.md partially updated** — Known Issues section was being updated when session crashed; may need review
4. **Live site outdated** — still has earlier TiTiler preview URLs; latest local code uses direct S3 thumbnails + dynamic TMS. Do NOT deploy until TMS panning issue is resolved.

### Key decisions
- Direct S3 for thumbnails (no proxy) — cleanest, most reliable
- TiTiler for full-res TMS tiles at high zoom only (not for low-zoom thumbnails — resource efficiency)
- Test locally first, get user confirmation before deploying (see `feedback_test_locally.md`)
- Max 8 TMS layers at a time, max 25 preview thumbnails

## Session Log (append-only)
<!-- Tools MUST only append new entries below. Never edit or delete existing entries. -->

### 2026-03-12 (Claude Code)
- Verified deployed site is working (initial cache issue resolved itself)
- Rehearsed demo using Chrome DevTools MCP: grid view → fly to Bogotá → footprints → image selection with full-res preview overlay → platform filter → basemap switching
- Discovered `window.__mainMap` reference trick via React fiber traversal for programmatic map control
- Session cut short due to Mac memory pressure from Chrome DevTools MCP interactions

### 2026-03-18 (Claude Code) — recovered from crashed session
- Major refactor of thumbnail/TMS display system in Map.jsx (148 insertions, 88 deletions)
- Removed corsproxy.io dependency — S3 bucket already has CORS, thumbnails load directly
- Removed Vite dev CORS proxy plugin (32 deletions from vite.config.js)
- Implemented dynamic TMS thresholds: z10 (selected), z12 (large images), z16 (all images)
- Fixed TMS layer ordering (sorted by bbox area, selected on top)
- Fixed TMS bounds clipping on pan (selected images unbounded, non-selected detect stale bounds)
- Session crashed due to "Request too large (max 20MB)" — accumulated Chrome DevTools screenshots exceeded API payload limit
- Context recovered from JSONL session file and `/export` output in separate meta session
