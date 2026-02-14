# OpenAerialMap Browser (oam-vibe)

## Overview
A React-based web app for browsing open aerial imagery from [OpenAerialMap](https://openaerialmap.org). Displays imagery on an interactive map with grid clustering at low zooms, footprints at mid zooms, and thumbnail previews at high zooms. Sidebar lists images with metadata, downloads, and editor integration (iD, JOSM).

**Live:** https://cgiovando.github.io/oam-vibe/
**Repo:** https://github.com/cgiovando/oam-vibe

## Tech Stack
- **React 19** + **Vite 7** (JSX, no TypeScript)
- **MapLibre GL JS** for map rendering
- **Tailwind CSS 3** for styling (via PostCSS)
- **Turf.js** for geospatial ops (bbox, area, center, point-in-polygon)
- **Deployed** to GitHub Pages via `gh-pages` package

## Architecture

### State Management
All app state lives in `App.jsx` (~10 state variables). No external state library.

### Data Flow
1. `App.jsx` fetches from OAM API (`/meta`) on load and on map moveend (1500ms debounce)
2. Results processed into GeoJSON features with computed properties (`is_large`, formatted fields)
3. Features passed down to `Map` (for rendering) and `Sidebar` (for listing)
4. Selection state flows bidirectionally: click map footprint → selects in sidebar, click sidebar card → flies to map

### API
- **Dev:** Vite proxy at `/api` → `https://api.openaerialmap.org`
- **Prod:** CORS proxy via `corsproxy.io` (temporary until deployed on OAM domain)
- **Result limit:** 50 (constrained by CORS proxy response size)
- Image thumbnails also proxied through `corsproxy.io` for map preview layers

### Map Layers (bottom to top)
1. Basemap (raster: Carto Light / HOT OSM / Mapbox Satellite)
2. Grid cells with counts (visible < z10)
3. Large footprints (fill + line, visible z8-22)
4. Small footprints (fill + line, visible z10-22)
5. Preview raster layers (thumbnail images, added/removed dynamically)
6. Hover highlight (blue line)
7. Selection highlight (red line)

### URL State
Persists `lat`, `lon`, `zoom`, and `selected_id` in query params via `history.replaceState`.

## Key Files
```
src/
├── App.jsx              # Root component, all state, API fetch logic
├── main.jsx             # Entry point (imports index.css + App)
├── index.css            # Tailwind directives + full-height reset
└── components/
    ├── Map.jsx           # MapLibre map, layers, grid, previews, events (largest file ~484 lines)
    ├── Sidebar.jsx       # Scrollable image list with lazy "Load More"
    ├── ImageCard.jsx     # Image card: thumbnail, metadata, actions (download, TMS copy, iD, JOSM)
    ├── MapFilterBar.jsx  # Dropdown filters on map (platform, date, license)
    ├── Toolbar.jsx       # Left-side map controls (search, basemap switcher, zoom)
    ├── MiniMap.jsx       # Bottom-right overview map with viewport box
    └── BurgerMenu.jsx    # Top-right hamburger menu with links
```

## Config
- `vite.config.js` — base path `/oam-vibe/`, dev proxy for API + TiTiler
- `tailwind.config.js` — scans `index.html` + `src/**/*.{js,jsx}`
- Mapbox satellite token is a public OAM-owned key (not secret)

## Commands
```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run deploy   # Build + push to gh-pages branch
npm run lint     # ESLint
```

## Current Status (2026-02-13)
- All features tested and working locally — zero console errors
- Local has uncommitted improvements over deployed version:
  - Simplified preview system (`previewsEnabled` toggle replaces old `layerMode`/`previewedIds`/`hiddenIds`)
  - Hover highlight (blue outline on non-selected features when one is selected)
  - Unified click handler in Map.jsx
  - Cleaned up ImageCard (removed per-image preview toggle)

## Known Issues & Tech Debt
- **No fetch abort:** Rapid map pans queue concurrent API requests with potential stale data race
- **Expensive mousemove:** When image selected, hover handler iterates all features with Turf bbox on every mouse move
- **No meaningful bbox change check:** Every moveend triggers API fetch even for tiny pans
- **Silent error handling:** Fetch failures only logged to console
- **Map.jsx is large:** Grid math, preview management, and event handling could be extracted
