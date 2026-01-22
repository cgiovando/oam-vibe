# OpenAerialMap Browser

A modern, responsive web application for browsing and discovering open aerial imagery from [OpenAerialMap](https://openaerialmap.org). Built with React, MapLibre GL, and Tailwind CSS.

**Live Demo:** [https://cgiovando.github.io/oam-vibe/](https://cgiovando.github.io/oam-vibe/)

> **Note:** This is an experimental pilot application and does not yet fully replace the official [OAM Browser](https://map.openaerialmap.org/). This app was built primarily with AI assistance—see the [AI Disclaimer](#ai-generated-code-disclaimer) for details. See also [Limitations](#known-limitations).

## Features

- **Interactive Map Browser** - Pan and zoom to explore aerial imagery worldwide
- **Image Grid** - Browse the most recent images with thumbnails and metadata
- **Bounding Box Search** - Automatically fetches images within the current map view
- **Filters** - Filter by platform (UAV, Satellite, Aircraft), date range, and license
- **Image Details** - View metadata including provider, sensor, resolution (GSD), and file size
- **Direct Downloads** - Download GeoTIFF files directly from the interface
- **Show on Map** - Click to fly to any image's location on the map
- **Layer Modes** - Toggle between footprints only and live image previews
- **Basemap Switcher** - Switch between different basemap styles
- **Mini Map** - Overview map showing current viewport location
- **Location Search** - Search for places to quickly navigate the map
- **Responsive Design** - Works on desktop and tablet devices

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **MapLibre GL JS** - Map rendering
- **Tailwind CSS** - Styling
- **Turf.js** - Geospatial analysis

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

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

The app will be available at `http://localhost:5173`

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

## Configuration

### API Proxy

The app uses the OpenAerialMap API (`api.openaerialmap.org`).

**Why a CORS proxy is needed:** This application is currently deployed as an external pilot project outside the official OpenAerialMap domain. Since browsers enforce same-origin policies, direct API calls from `cgiovando.github.io` to `api.openaerialmap.org` are blocked by CORS. Once this application is integrated into the official OAM infrastructure and deployed under the `openaerialmap.org` domain, the CORS proxy will no longer be necessary, and the result limit can be increased significantly.

Current setup:
- **Development:** Vite proxies API requests locally to avoid CORS issues
- **Production:** Uses `corsproxy.io` as a CORS proxy (temporary solution)

The proxy configuration is in `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'https://api.openaerialmap.org',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

### Result Limit

The number of images fetched per request is controlled by `RESULT_LIMIT` in `src/App.jsx`. Currently set to 50 to stay within the CORS proxy's response size limits. This limit can be raised (to 500+) once the app is deployed within the OAM stack without needing an external proxy.

## Project Structure

```
src/
├── App.jsx              # Main app component, state management, API calls
├── main.jsx             # Entry point
└── components/
    ├── Sidebar.jsx      # Image list sidebar
    ├── Map.jsx          # MapLibre map component
    ├── ImageCard.jsx    # Individual image card in sidebar
    ├── MapFilterBar.jsx # Filter controls (platform, date, license)
    ├── Toolbar.jsx      # Map controls (search, basemap, zoom)
    ├── MiniMap.jsx      # Overview mini map
    ├── SearchBar.jsx    # Location search
    ├── BasemapSwitcher.jsx # Basemap style switcher
    ├── FilterPanel.jsx  # Filter panel component
    └── BurgerMenu.jsx   # Navigation menu
```

## API Reference

This app uses the [OpenAerialMap API](https://api.openaerialmap.org):

- `GET /meta` - Fetch image metadata
  - `limit` - Number of results (default: 50)
  - `bbox` - Bounding box filter (minLon,minLat,maxLon,maxLat)
  - `order_by` - Sort field (e.g., `acquisition_end`)
  - `sort` - Sort direction (`asc` or `desc`)
  - `acquisition_from` / `acquisition_to` - Date filters
  - `platform` - Platform filter (satellite, uav, aircraft)

## Known Limitations

This is an **experimental pilot application** and does not yet fully replace the official [OAM Browser](https://map.openaerialmap.org/):

- **Missing Features:**
  - Image uploader (available at [upload.openaerialmap.org](https://upload.openaerialmap.org/))
  - User authentication
  - Image management in user pages
  - Full imagery catalog browsing (currently limited to 50 results)

- **Technical Limitations:**
  - **CORS Proxy Limits:** The production build uses `corsproxy.io` which has a 1MB response limit on the free tier. This is a temporary workaround until the app is deployed within the OAM infrastructure.
  - **Result Limit:** Currently limited to 50 images per request to avoid hitting proxy limits.
  - **No Pagination UI:** While the API supports pagination, the UI doesn't yet have "Load More" functionality.

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
| [Turf.js](https://github.com/Turfjs/turf) (@turf/area, @turf/bbox, @turf/boolean-point-in-polygon, @turf/center, @turf/helpers) | MIT |

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
- Basemap tiles by [CARTO](https://carto.com/) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- Map data by [OpenStreetMap](https://www.openstreetmap.org/) contributors under [ODbL](https://opendatacommons.org/licenses/odbl/)

## Acknowledgments

- [OpenAerialMap](https://openaerialmap.org) - Open imagery platform
- [Humanitarian OpenStreetMap Team (HOT)](https://www.hotosm.org/) - OAM maintainers
- [MapLibre](https://maplibre.org/) - Open-source map rendering
- [CARTO](https://carto.com/) - Basemap tiles
- [OpenStreetMap](https://www.openstreetmap.org/) - Map data
