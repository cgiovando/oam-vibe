# OpenAerialMap Browser (oam-vibe)

## Overview
A React-based web app for browsing open aerial imagery from [OpenAerialMap](https://openaerialmap.org). Displays imagery on an interactive map with footprints at mid zooms and thumbnail previews at high zooms. Sidebar lists images with metadata, downloads, and editor integration (iD, JOSM). Data served from a static PMTiles vector tileset (~20k images) — no API calls needed.

**Live:** https://cgiovando.github.io/oam-vibe/
**Repo:** https://github.com/cgiovando/oam-vibe

## Tech Stack
- **React 19** + **Vite 7** (JSX, no TypeScript)
- **MapLibre GL JS** for map rendering
- **PMTiles** for vector tile access (static S3 file)
- **Tailwind CSS 3** for styling (via PostCSS)
- **Turf.js** for geospatial ops (bbox only)
- **Deployed** to GitHub Pages via `gh-pages` package

## Architecture

### State Management
All app state lives in `App.jsx` (~8 state variables). No external state library.

### Data Flow
1. Map.jsx loads PMTiles vector source from S3 (`images.pmtiles`)
2. On map `idle`, queries visible features via `querySourceFeatures`, de-duplicates, and sends to App via `onFeaturesUpdate` callback
3. Features passed to `Sidebar` for listing
4. Filters applied client-side via MapLibre `setFilter` (map) + JS matching (sidebar)
5. Selection state flows bidirectionally: click map footprint → selects in sidebar, click sidebar card → flies to map

### Data Source
- **PMTiles:** `s3://cgiovando-oam-api/images.pmtiles` — vector tiles with `images` layer
- **Meta JSON:** `s3://cgiovando-oam-api/meta/{image_id}` — individual image metadata
- **ETL:** `/Users/cristiano/coding/oam-api/etl.py` — fetches from OAM API, produces GeoJSON + PMTiles via tippecanoe
- Image thumbnails proxied through `corsproxy.io` for map preview layers

### Map Layers (bottom to top)
1. Basemap (raster: Carto Light / HOT OSM / Mapbox Satellite)
2. Grid cells with counts (source: `oam-grid` GeoJSON, maxzoom 10, click to zoom)
3. Footprints fill + line (source: `oam-tiles` PMTiles, minzoom 8)
4. Preview raster layers (thumbnail images, added/removed dynamically)
5. Hover highlight (blue line, filter by `_id`)
6. Selection highlight (red line, filter by `_id`)

### URL State
Persists `lat`, `lon`, `zoom`, and `selected_id` in query params via `history.replaceState`.

## Key Files
```
src/
├── App.jsx              # Root component, all state, receives features from Map
├── main.jsx             # Entry point (imports index.css + App)
├── index.css            # Tailwind directives + full-height reset
└── components/
    ├── Map.jsx           # MapLibre map, PMTiles source, layers, filters, events, previews
    ├── Sidebar.jsx       # Scrollable image list with lazy "Load More"
    ├── ImageCard.jsx     # Image card: thumbnail, metadata, actions (download, TMS copy, iD, JOSM)
    ├── MapFilterBar.jsx  # Dropdown filters on map (platform, date, license)
    ├── Toolbar.jsx       # Left-side map controls (search, basemap switcher, zoom)
    ├── MiniMap.jsx       # Bottom-right overview map with viewport box
    └── BurgerMenu.jsx    # Top-right hamburger menu with links
```

## Config
- `vite.config.js` — base path `/oam-vibe/`, dev proxy for TiTiler
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
- Switched from OAM API to PMTiles — all ~20k images available, no 50-result limit
- Zero API calls on map move — tiles cached by browser, instant panning
- Instant client-side filtering via MapLibre setFilter
- All features tested locally via Chrome DevTools MCP — zero console errors
- ETL updated to include `uuid` and `license` properties (needs re-run to take effect)

## Known Issues & Tech Debt
- **License field empty in current PMTiles:** ETL updated but needs re-run to populate `uuid`/`license`
- **CORS proxy still needed for thumbnails:** Preview overlay images use corsproxy.io
- **Silent error handling:** Fetch failures only logged to console
- **Map.jsx still large:** Could extract preview management and event handlers into hooks
