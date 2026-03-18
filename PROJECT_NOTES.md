# Project Notes — oam-vibe

## Current State (rewritable)
<!-- Any tool may rewrite this section to reflect the latest status. -->
- Status: Stable — TMS panning fix deployed to GitHub Pages
- All changes committed and pushed to `main`, deployed via `gh-pages`
- Session export file `2026-03-18-140150-this-session-is-being-continued-from-a-previous-co.txt` can be deleted

### Key decisions
- Direct S3 for thumbnails (no proxy) — cleanest, most reliable
- TiTiler `/cog/bounds` for actual COG extent (WGS84) — prevents 404 tile floods
- TiTiler for full-res TMS tiles at high zoom only (not for low-zoom thumbnails)
- Max 8 TMS layers at a time, max 25 preview thumbnails

### Known issues
1. **Black edges on some TMS tiles** — `nodata=0` helps for most but some COGs have actual dark pixel data at edges (data-level, not code bug)
2. **Vector footprint larger than COG extent** — some images in PMTiles have footprints bigger than the actual COG coverage; COG bounds fix handles this gracefully but the red outline may extend beyond where imagery exists

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

### 2026-03-18 (Claude Code) — TMS panning fix
- Root cause: selected TMS source had no `bounds`, causing MapLibre to request tiles outside COG extent → 404 floods
- Fix: fetch actual COG bounds from TiTiler `/cog/bounds` endpoint (always WGS84)
- Critical discovery: `/cog/info` returns bounds in native CRS (may be UTM), `/cog/bounds` always returns WGS84
- Tested with "Vantor 103001010C477F00" (3.44 GB, UTM-projected COG) — exact scenario from user's screen recording
- Also fixed `boundsMatch` logic so sources update when COG bounds arrive asynchronously
- Committed, pushed, and deployed to GitHub Pages
