# Project Notes — oam-vibe

## Current State (rewritable)
<!-- Any tool may rewrite this section to reflect the latest status. -->
- Status: Deployed site at https://cgiovando.github.io/oam-vibe/ confirmed working
- Demo rehearsal done via Chrome DevTools MCP — walked through grid overview, footprints, image selection with preview overlay, filters, and basemap switching
- Mac had memory issues during demo session with Chrome DevTools MCP
- Next: Complete live demo when machine resources allow

## Session Log (append-only)
<!-- Tools MUST only append new entries below. Never edit or delete existing entries. -->

### 2026-03-12 (Claude Code)
- Verified deployed site is working (initial cache issue resolved itself)
- Rehearsed demo using Chrome DevTools MCP: grid view → fly to Bogotá → footprints → image selection with full-res preview overlay → platform filter → basemap switching
- Discovered `window.__mainMap` reference trick via React fiber traversal for programmatic map control
- Session cut short due to Mac memory pressure from Chrome DevTools MCP interactions
