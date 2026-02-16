# OpenAerialMap Browser

A modern, responsive web application for browsing and discovering open aerial imagery from [OpenAerialMap](https://openaerialmap.org). Built with React, MapLibre GL, and Tailwind CSS.

**Live Demo:** [https://cgiovando.github.io/oam-vibe/](https://cgiovando.github.io/oam-vibe/)

> **Note:** This is an experimental pilot application and does not yet fully replace the official [OAM Browser](https://map.openaerialmap.org/). This app was built primarily with AI assistance—see the [AI Disclaimer](#ai-generated-code-disclaimer) for details. See also [Limitations](#known-limitations).

## Features

- **Interactive Map Browser** - Pan and zoom to explore aerial imagery worldwide
- **Cloud-Native Data** - Powered by PMTiles vector tiles from the new OAM API — all ~20k images available with zero API calls on map move
- **Grid Clustering** - Image counts aggregated into grid cells at low zoom, footprints at mid zoom, thumbnail previews at high zoom
- **Full-Resolution Imagery** - TMS tile overlay from TiTiler at zoom 14+ for crisp, full-resolution viewing of selected images
- **Overlapping Image Picker** - Click where multiple footprints overlap to get a disambiguation popup listing all images
- **Filters** - Client-side filtering by platform (UAV, Satellite, Aircraft), date range, and license — instant, no server round-trip
- **Image Details** - View metadata including provider, sensor, resolution (GSD), and file size
- **Direct Downloads** - Download GeoTIFF files directly from the interface
- **Editor Integration** - Open imagery in iD or JOSM, copy TMS URLs for use in any editor
- **Show on Map** - Click to fly to any image's location on the map
- **Layer Modes** - Toggle between footprints only and live image previews
- **Basemap Switcher** - Switch between Carto Light, HOT OSM, and Mapbox Satellite basemaps
- **Mini Map** - Overview map showing current viewport location
- **Location Search** - Search for places to quickly navigate the map
- **URL State** - Lat, lon, zoom, and selected image persisted in the URL for easy sharing
- **Responsive Design** - Works on desktop and tablet devices

## Data Source

This application uses the **new cloud-native OAM API** — a static [PMTiles](https://protomaps.com/docs/pmtiles) vector tileset hosted on S3:

- **PMTiles:** `s3://cgiovando-oam-api/images.pmtiles` — vector tiles with an `images` layer containing ~20k image footprints and metadata
- **TMS Tiles:** Full-resolution imagery served via [TiTiler](https://developmentseed.org/titiler/) at `titiler.hotosm.org`
- **ETL:** Image metadata fetched from the OAM API, converted to GeoJSON, and tiled with [tippecanoe](https://github.com/felt/tippecanoe)

This replaces the previous architecture that relied on per-request API calls with a 50-result limit and CORS proxy workarounds. With PMTiles, tiles are cached by the browser and panning/zooming is instant.

## Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **MapLibre GL JS** - Map rendering
- **PMTiles** - Vector tile access (static S3 file)
- **Tailwind CSS 3** - Styling
- **Turf.js** - Geospatial analysis (bbox)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/cgiovando/oam-vibe.git
cd oam-vibe

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/oam-vibe/`

### Development

```bash
# Run development server with hot reload
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Deployment

The app is configured for GitHub Pages deployment:

```bash
# Build and deploy to GitHub Pages
npm run deploy
```

This runs `vite build` and pushes the `dist/` folder to the `gh-pages` branch.

## Project Structure

```
src/
├── App.jsx              # Main app component, all state management
├── main.jsx             # Entry point
├── index.css            # Tailwind directives + popup styles
└── components/
    ├── Map.jsx          # MapLibre map: PMTiles source, layers, grid, previews, TMS, events
    ├── Sidebar.jsx      # Scrollable image list with lazy loading
    ├── ImageCard.jsx    # Image card: thumbnail, metadata, actions (download, TMS, iD, JOSM)
    ├── MapFilterBar.jsx # Dropdown filters (platform, date, license)
    ├── Toolbar.jsx      # Left-side map controls (search, basemap, zoom)
    ├── MiniMap.jsx      # Bottom-right overview map with viewport box
    └── BurgerMenu.jsx   # Top-right hamburger menu with links
```

## Known Limitations

This is an **experimental pilot application** and does not yet fully replace the official [OAM Browser](https://map.openaerialmap.org/):

- **Missing Features:**
  - Image uploader (available at [upload.openaerialmap.org](https://upload.openaerialmap.org/))
  - User authentication
  - Image management in user pages

- **Technical Limitations:**
  - **Thumbnail CORS:** Preview overlays use `corsproxy.io` to load thumbnails from S3, which can be unreliable. A CORS policy on the S3 bucket would eliminate this dependency.
  - **Static Data:** The PMTiles file is regenerated periodically via ETL — newly uploaded images won't appear until the next ETL run.
  - **License field:** Some images may show "Unknown License" until the ETL is re-run with the updated schema.

## Future Plans

This project is being developed in alignment with the [OpenAerialMap Roadmap](https://github.com/hotosm/OpenAerialMap?tab=readme-ov-file#roadmap), which outlines the strategic direction for OAM's development.

The project also aims to eventually align with the [HOT Development Guide](https://docs.hotosm.org/dev-guide/intro/) standards for integration into the broader Humanitarian OpenStreetMap Team ecosystem.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## AI-Generated Code Disclaimer

> **IMPORTANT NOTICE:** The majority of this application's code was generated with assistance from AI tools.

This application was developed primarily using AI-assisted coding tools:
- **Claude** (Anthropic) - Code generation, debugging, and documentation
- **Gemini** (Google) - Code generation and problem-solving

**What this means:**
- The codebase was largely generated by AI based on requirements and prompts
- All functionality has been tested and verified to work as intended
- Features and user experience have been reviewed and approved by the product owner
- The application has been tested by humans for usability and correctness

**What this does NOT mean:**
- This is not a traditional hand-coded application
- Not every line of code has been manually reviewed by a professional developer

This disclosure follows emerging best practices for transparency in AI-assisted software development. We believe in being upfront about how this software was created.

## License

This project is open source and available under the MIT License.

### Third-Party Licenses

This project uses the following open-source packages, each under their respective licenses:

**Runtime Dependencies:**
| Package | License |
|---------|---------|
| [React](https://github.com/facebook/react) | MIT |
| [React DOM](https://github.com/facebook/react) | MIT |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-3-Clause |
| [PMTiles](https://github.com/protomaps/PMTiles) | BSD-3-Clause |
| [Turf.js](https://github.com/Turfjs/turf) (@turf/bbox, @turf/helpers) | MIT |

**Development Dependencies:**
| Package | License |
|---------|---------|
| [Vite](https://github.com/vitejs/vite) | MIT |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT |
| [ESLint](https://github.com/eslint/eslint) | MIT |
| [PostCSS](https://github.com/postcss/postcss) | MIT |
| [Autoprefixer](https://github.com/postcss/autoprefixer) | MIT |
| [gh-pages](https://github.com/tschaub/gh-pages) | MIT |

**Data & Services:**
- Imagery data is provided by [OpenAerialMap](https://openaerialmap.org) contributors under various open licenses (see individual image metadata)
- Full-resolution tiles served by [TiTiler](https://developmentseed.org/titiler/) hosted by [HOT](https://www.hotosm.org/)
- Basemap tiles by [CARTO](https://carto.com/) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- Map data by [OpenStreetMap](https://www.openstreetmap.org/) contributors under [ODbL](https://opendatacommons.org/licenses/odbl/)

## Acknowledgments

- [OpenAerialMap](https://openaerialmap.org) - Open imagery platform
- [Humanitarian OpenStreetMap Team (HOT)](https://www.hotosm.org/) - OAM maintainers
- [MapLibre](https://maplibre.org/) - Open-source map rendering
- [CARTO](https://carto.com/) - Basemap tiles
- [OpenStreetMap](https://www.openstreetmap.org/) - Map data
