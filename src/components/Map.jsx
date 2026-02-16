import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import bbox from '@turf/bbox';
import { polygon } from '@turf/helpers';
import 'maplibre-gl/dist/maplibre-gl.css';

// MAPBOX SATELLITE TOKEN (Provided)
const MB_TOKEN = 'pk.eyJ1Ijoib3BlbmFlcmlhbG1hcCIsImEiOiJjbWowaThzc2swOTVtM2NxMXA2Y2J3bDdzIn0.gmFG84efi2_zK6Yx5ot_5Q';

const PMTILES_URL = 'pmtiles://https://cgiovando-oam-api.s3.us-east-1.amazonaws.com/images.pmtiles';
const META_BASE = 'https://cgiovando-oam-api.s3.us-east-1.amazonaws.com/meta';

// Thumbnail proxy: local CORS proxy in dev, corsproxy.io in production
const thumbProxyUrl = (url) => {
  if (!url) return null;
  if (import.meta.env.DEV) return `/cors-proxy/?${encodeURIComponent(url)}`;
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
};

// Area threshold: features with bbox area above this are "large" (visible footprints at z8)
const LARGE_IMAGE_THRESHOLD_SQ_KM = 50;
const bboxAreaKm2 = (b) => {
  const avgLat = (b[1] + b[3]) / 2;
  const widthKm = (b[2] - b[0]) * 111.32 * Math.cos(avgLat * Math.PI / 180);
  const heightKm = (b[3] - b[1]) * 111.32;
  return Math.abs(widthKm * heightKm);
};

// --- TILE MATH HELPERS (for grid cells) ---
const lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
const lat2tile = (lat, zoom) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
const tile2long = (x, z) => (x / Math.pow(2, z) * 360 - 180);
const tile2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
};
const tileToGeoJSON = (x, y, z) => {
  const w = tile2long(x, z);
  const e = tile2long(x + 1, z);
  const n = tile2lat(y, z);
  const s = tile2lat(y + 1, z);
  return polygon([[[w, n], [e, n], [e, s], [w, s], [w, n]]], { x, y, z });
};

function OamMap({ selectedFeature, onMapInit, searchBbox, onSearchArea, onSelect, onFeaturesUpdate, previewsEnabled, setPreviewsEnabled, hoveredFeatureId, onHover, basemap, filters }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(null);
  const debounceTimer = useRef(null);
  const isProgrammaticMove = useRef(false);
  const onSearchRef = useRef(onSearchArea);
  const onSelectRef = useRef(onSelect);
  const selectedFeatureRef = useRef(selectedFeature);
  const onHoverRef = useRef(onHover);
  const onFeaturesUpdateRef = useRef(onFeaturesUpdate);
  const filtersRef = useRef(filters);

  const [isLoaded, setIsLoaded] = useState(false);
  const [idleTick, setIdleTick] = useState(0);
  const [mapZoom, setMapZoom] = useState(2);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { selectedFeatureRef.current = selectedFeature; }, [selectedFeature]);
  useEffect(() => { onSearchRef.current = onSearchArea; }, [onSearchArea]);
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
  useEffect(() => { onFeaturesUpdateRef.current = onFeaturesUpdate; }, [onFeaturesUpdate]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const getInitialViewState = () => {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lon = parseFloat(params.get('lon'));
    const zoom = parseFloat(params.get('zoom'));
    if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) return { center: [lon, lat], zoom: zoom };
    return { center: [0, 20], zoom: 2 };
  };

  const updateUrlView = () => {
    if (!map.current) return;
    const center = map.current.getCenter();
    const zoom = map.current.getZoom();
    const params = new URLSearchParams(window.location.search);
    params.set('lat', center.lat.toFixed(4));
    params.set('lon', center.lng.toFixed(4));
    params.set('zoom', zoom.toFixed(1));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // --- HELPER: Format raw PMTiles properties to match app schema ---
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const gb = 1073741824;
    const mb = 1048576;
    if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
    return `${Math.round(bytes / mb)} MB`;
  };

  const transformFeature = (mvtFeature) => {
    const p = mvtFeature.properties;
    return {
      type: 'Feature',
      geometry: mvtFeature.geometry,
      properties: {
        id: p._id,
        uuid: p.uuid || null,
        title: p.title || 'Untitled Image',
        provider: p.provider || 'Unknown',
        thumbnail: p.thumbnail || null,
        tms: p.tms || null,
        date: p.acquisition_end || 'Unknown Date',
        platform: (p.platform || 'unknown').toLowerCase(),
        sensor: p.sensor || 'Unknown Sensor',
        gsd: p.gsd ? `${Number(p.gsd).toFixed(2)} m` : 'N/A',
        file_size: formatFileSize(p.file_size),
        license: p.license || 'Unknown License',
        acquisition_end: p.acquisition_end,
      }
    };
  };

  // --- HELPER: Client-side filter match (mirrors buildFilter logic) ---
  const matchesFilters = (p, f) => {
    if (f.platform) {
      const plat = (p.platform || '').toLowerCase();
      if (f.platform === 'uav') {
        if (plat !== 'uav' && plat !== 'drone') return false;
      } else if (f.platform === 'aircraft') {
        if (plat === 'satellite' || plat === 'uav' || plat === 'drone') return false;
      } else {
        if (plat !== f.platform.toLowerCase()) return false;
      }
    }
    if (f.dateStart && p.acquisition_end && p.acquisition_end < f.dateStart) return false;
    if (f.dateEnd && p.acquisition_end && p.acquisition_end > f.dateEnd + 'T23:59:59.999Z') return false;
    if (f.license) {
      const target = f.license.replace(/[\s-]/g, '').toLowerCase();
      const actual = (p.license || '').replace(/[\s-]/g, '').toLowerCase();
      if (!actual.includes(target)) return false;
    }
    return true;
  };

  // --- HELPER: Get full bbox from ALL source tile fragments (handles tile-boundary clipping) ---
  const getFullBbox = (featureId) => {
    if (!map.current) return null;
    const allFrags = map.current.querySourceFeatures('oam-tiles', { sourceLayer: 'images' });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let firstFrag = null;
    for (const f of allFrags) {
      if (f.properties._id === featureId) {
        if (!firstFrag) firstFrag = f;
        try {
          const b = bbox(f);
          if (b[0] < minX) minX = b[0];
          if (b[1] < minY) minY = b[1];
          if (b[2] > maxX) maxX = b[2];
          if (b[3] > maxY) maxY = b[3];
        } catch (e) {}
      }
    }
    if (minX === Infinity) return null;
    return { bbox: [minX, minY, maxX, maxY], feature: firstFrag };
  };

  // --- HELPER: Close disambiguation popup ---
  const closePopup = () => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  // --- HELPER: Get TMS tile URL for MapLibre raster source ---
  // Rewrites tiles.openaerialmap.org → titiler.hotosm.org to avoid CORS-less 302 redirect
  const getTmsUrl = (p) => {
    let tmsUrl = p.tms || null;
    if (!tmsUrl && p.uuid) {
      const parts = p.uuid.split('/');
      const filename = parts[parts.length - 1].replace('.tif', '').replace('.tiff', '');
      const uploadId = parts[parts.length - 3];
      tmsUrl = `https://tiles.openaerialmap.org/${uploadId}/0/${filename}/{z}/{x}/{y}`;
    }
    if (!tmsUrl) return null;
    // tiles.openaerialmap.org 302-redirects to titiler.hotosm.org but the redirect lacks CORS headers.
    // Rewrite directly to TiTiler which has Access-Control-Allow-Origin: *
    const oamMatch = tmsUrl.match(/^https:\/\/tiles\.openaerialmap\.org\/(.+)\/{z}\/{x}\/{y}$/);
    if (oamMatch) {
      const s3Path = `https://oin-hotosm-temp.s3.us-east-1.amazonaws.com/${oamMatch[1]}.tif`;
      return `https://titiler.hotosm.org/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=${encodeURIComponent(s3Path)}`;
    }
    return tmsUrl;
  };

  // --- HELPER: Query visible features from PMTiles and send to App ---
  const emitVisibleFeatures = () => {
    if (!map.current || !onFeaturesUpdateRef.current) return;
    try {
      const raw = map.current.querySourceFeatures('oam-tiles', { sourceLayer: 'images' });
      const currentFilters = filtersRef.current;
      // Viewport bounds for filtering (only show features intersecting current view)
      const vb = map.current.getBounds();
      const vw = vb.getWest(), vs = vb.getSouth(), ve = vb.getEast(), vn = vb.getNorth();
      // De-duplicate by _id (tile boundary duplicates) and apply filters
      const seen = new Set();
      const unique = [];
      for (const f of raw) {
        const id = f.properties._id;
        if (id && !seen.has(id)) {
          seen.add(id);
          if (matchesFilters(f.properties, currentFilters)) {
            try {
              const fb = bbox(f);
              // Skip features that don't intersect the viewport
              if (fb[2] < vw || fb[0] > ve || fb[3] < vs || fb[1] > vn) continue;
            } catch (e) { /* include if bbox fails */ }
            unique.push(transformFeature(f));
          }
        }
      }
      // Sort by acquisition_end descending (most recent first)
      unique.sort((a, b) => {
        const da = a.properties.acquisition_end || '';
        const db = b.properties.acquisition_end || '';
        return db.localeCompare(da);
      });
      onFeaturesUpdateRef.current(unique);
    } catch (e) {
      console.error('Error querying source features:', e);
    }
  };

  // --- HELPER: Build MapLibre filter from app filters ---
  const buildFilter = (f) => {
    const conditions = ['all'];
    if (f.platform) {
      if (f.platform === 'uav') {
        conditions.push(['any', ['==', ['downcase', ['get', 'platform']], 'uav'], ['==', ['downcase', ['get', 'platform']], 'drone']]);
      } else if (f.platform === 'aircraft') {
        conditions.push(['all',
          ['!=', ['downcase', ['get', 'platform']], 'satellite'],
          ['!=', ['downcase', ['get', 'platform']], 'uav'],
          ['!=', ['downcase', ['get', 'platform']], 'drone']
        ]);
      } else {
        conditions.push(['==', ['downcase', ['get', 'platform']], f.platform.toLowerCase()]);
      }
    }
    if (f.dateStart) conditions.push(['>=', ['get', 'acquisition_end'], f.dateStart]);
    if (f.dateEnd) conditions.push(['<=', ['get', 'acquisition_end'], f.dateEnd + 'T23:59:59.999Z']);
    if (f.license) {
      const lic = f.license.toLowerCase();
      if (lic.includes('nc')) {
        conditions.push(['in', 'nc', ['downcase', ['to-string', ['get', 'license']]]]);
      } else if (lic.includes('sa')) {
        conditions.push(['in', 'sa', ['downcase', ['to-string', ['get', 'license']]]]);
      } else if (lic.includes('by')) {
        // CC BY but not NC or SA
        conditions.push(['all',
          ['in', 'by', ['downcase', ['to-string', ['get', 'license']]]],
          ['!', ['in', 'nc', ['downcase', ['to-string', ['get', 'license']]]]],
          ['!', ['in', 'sa', ['downcase', ['to-string', ['get', 'license']]]]]
        ]);
      }
    }
    return conditions.length > 1 ? conditions : null;
  };

  const applyFilters = (f) => {
    if (!map.current) return;
    const filter = buildFilter(f);
    ['footprint-fill', 'footprint-line'].forEach(id => {
      if (map.current.getLayer(id)) map.current.setFilter(id, filter);
    });
  };

  // --- GRID + FOOTPRINT VISIBILITY: Build grid cells and control footprint filter ---
  const updateGridSource = () => {
    if (!map.current || !map.current.getSource('oam-grid')) return;
    const currentZoom = map.current.getZoom();
    const currentFilters = filtersRef.current;
    const userFilter = buildFilter(currentFilters);

    // At z10+: all footprints visible, no grid needed
    if (currentZoom >= 10) {
      map.current.getSource('oam-grid').setData({ type: 'FeatureCollection', features: [] });
      ['footprint-fill', 'footprint-line'].forEach(id => {
        if (map.current.getLayer(id)) map.current.setFilter(id, userFilter);
      });
      return;
    }

    try {
      const raw = map.current.querySourceFeatures('oam-tiles', { sourceLayer: 'images' });
      if (raw.length === 0) {
        map.current.getSource('oam-grid').setData({ type: 'FeatureCollection', features: [] });
        if (currentZoom >= 8) {
          ['footprint-fill', 'footprint-line'].forEach(id => {
            if (map.current.getLayer(id)) map.current.setFilter(id, userFilter);
          });
        }
        return;
      }

      // First pass: collect combined bbox per unique feature from all tile fragments
      const featureBboxes = new Map();
      for (const f of raw) {
        const id = f.properties._id;
        if (!id) continue;
        try {
          const b = bbox(f);
          if (!featureBboxes.has(id)) {
            featureBboxes.set(id, { bbox: [b[0], b[1], b[2], b[3]], props: f.properties });
          } else {
            const prev = featureBboxes.get(id).bbox;
            prev[0] = Math.min(prev[0], b[0]);
            prev[1] = Math.min(prev[1], b[1]);
            prev[2] = Math.max(prev[2], b[2]);
            prev[3] = Math.max(prev[3], b[3]);
          }
        } catch (e) {}
      }

      // Second pass: classify features — large ones become footprints, small ones go to grid
      const largeIds = [];
      const centroids = [];
      for (const [id, data] of featureBboxes) {
        if (!matchesFilters(data.props, currentFilters)) continue;
        const isLarge = bboxAreaKm2(data.bbox) > LARGE_IMAGE_THRESHOLD_SQ_KM;
        if (currentZoom >= 8 && isLarge) {
          largeIds.push(id);
          continue; // Show as footprint, not in grid
        }
        const b = data.bbox;
        centroids.push([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, id]);
      }

      // At z8-z10: filter footprint layers to only show large features
      if (currentZoom >= 8) {
        if (largeIds.length > 0) {
          const sizeFilter = ['in', ['get', '_id'], ['literal', largeIds]];
          const combined = userFilter ? ['all', userFilter, sizeFilter] : sizeFilter;
          ['footprint-fill', 'footprint-line'].forEach(id => {
            if (map.current.getLayer(id)) map.current.setFilter(id, combined);
          });
        } else {
          ['footprint-fill', 'footprint-line'].forEach(id => {
            if (map.current.getLayer(id)) map.current.setFilter(id, ['==', '_id', '__none__']);
          });
        }
      }

      if (centroids.length === 0) {
        map.current.getSource('oam-grid').setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      // Choose grid zoom: map zoom + 4, clamped 2-14
      let gridZoom = Math.floor(currentZoom) + 4;
      if (gridZoom < 2) gridZoom = 2;
      if (gridZoom > 14) gridZoom = 14;

      // Bin centroids into grid cells, tracking combined image bbox per cell
      const cellCounts = {};
      const cellSingleId = {};
      const cellBbox = {}; // combined bbox of all images in cell
      for (const [lon, lat, id] of centroids) {
        const tx = lon2tile(lon, gridZoom);
        const ty = lat2tile(lat, gridZoom);
        const key = `${tx},${ty}`;
        cellCounts[key] = (cellCounts[key] || 0) + 1;
        cellSingleId[key] = id;
        // Merge image bbox into cell bbox
        const imgData = featureBboxes.get(id);
        if (imgData) {
          const ib = imgData.bbox;
          if (!cellBbox[key]) {
            cellBbox[key] = [ib[0], ib[1], ib[2], ib[3]];
          } else {
            const cb = cellBbox[key];
            cb[0] = Math.min(cb[0], ib[0]);
            cb[1] = Math.min(cb[1], ib[1]);
            cb[2] = Math.max(cb[2], ib[2]);
            cb[3] = Math.max(cb[3], ib[3]);
          }
        }
      }

      // Build grid GeoJSON
      const gridFeatures = [];
      for (const [key, count] of Object.entries(cellCounts)) {
        const [tx, ty] = key.split(',').map(Number);
        const cellPoly = tileToGeoJSON(tx, ty, gridZoom);
        const cb = cellBbox[key];
        cellPoly.properties = {
          count,
          ...(count === 1 ? { singleId: cellSingleId[key] } : {}),
          ...(cb ? { bboxW: cb[0], bboxS: cb[1], bboxE: cb[2], bboxN: cb[3] } : {})
        };
        gridFeatures.push(cellPoly);
      }

      map.current.getSource('oam-grid').setData({ type: 'FeatureCollection', features: gridFeatures });
    } catch (e) {
      console.error('Grid update error:', e);
    }
  };

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (map.current) return;

    // Register PMTiles protocol
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const { center, zoom } = getInitialViewState();

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'basemap-source': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          }
        },
        layers: [
          { id: 'basemap-layer', type: 'raster', source: 'basemap-source' }
        ]
      },
      center: center,
      zoom: zoom,
      attributionControl: false
    });

    if (onMapInit) onMapInit(map.current);
    map.current.addControl(new maplibregl.AttributionControl(), 'bottom-right');

    map.current.on('load', () => {
      setIsLoaded(true);
      updateUrlView();

      // PMTiles vector source
      map.current.addSource('oam-tiles', {
        type: 'vector',
        url: PMTILES_URL,
        promoteId: '_id'
      });

      // Grid source (GeoJSON, populated on idle at low zoom)
      map.current.addSource('oam-grid', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Grid layers (visible < z10)
      map.current.addLayer({
        id: 'grid-fill', type: 'fill', source: 'oam-grid', maxzoom: 10,
        paint: {
          'fill-color': ['interpolate', ['linear'], ['get', 'count'], 1, '#cceeff', 5, '#66b3ff', 20, '#0066cc', 50, '#003366'],
          'fill-opacity': 0.65
        }
      });
      map.current.addLayer({
        id: 'grid-count', type: 'symbol', source: 'oam-grid', maxzoom: 10,
        filter: ['>', ['get', 'count'], 0],
        layout: {
          'text-field': '{count}',
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false
        },
        paint: { 'text-color': '#003366', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
      });

      // Footprint layers (minzoom 8 — tippecanoe naturally drops small features at low zooms)
      map.current.addLayer({
        id: 'footprint-fill',
        type: 'fill',
        source: 'oam-tiles',
        'source-layer': 'images',
        minzoom: 8,
        paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.1 }
      });
      map.current.addLayer({
        id: 'footprint-line',
        type: 'line',
        source: 'oam-tiles',
        'source-layer': 'images',
        minzoom: 8,
        paint: { 'line-color': '#00B0FF', 'line-width': 2, 'line-opacity': 0.8 }
      });

      // Hover highlight (blue)
      map.current.addLayer({
        id: 'footprint-hover',
        type: 'line',
        source: 'oam-tiles',
        'source-layer': 'images',
        filter: ['==', '_id', ''],
        paint: { 'line-color': '#2196F3', 'line-width': 3, 'line-opacity': 0.9 }
      });

      // Selection highlight (red)
      map.current.addLayer({
        id: 'footprint-highlight',
        type: 'line',
        source: 'oam-tiles',
        'source-layer': 'images',
        filter: ['==', '_id', ''],
        paint: { 'line-color': '#FF0000', 'line-width': 3 }
      });

      // Apply any initial filters
      applyFilters(filtersRef.current);

      // --- EVENTS ---

      // Hover: use queryRenderedFeatures
      map.current.on('mousemove', (e) => {
        if (!selectedFeatureRef.current) {
          if (onHoverRef.current) onHoverRef.current(null);
          map.current.getCanvas().style.cursor = '';
          return;
        }
        const hits = map.current.queryRenderedFeatures(e.point, { layers: ['footprint-fill'] });
        const hoveredId = hits.length > 0 ? hits[0].properties._id : null;
        if (onHoverRef.current) onHoverRef.current(hoveredId);
        map.current.getCanvas().style.cursor = hoveredId ? 'pointer' : '';
      });

      // Click: use queryRenderedFeatures with disambiguation popup
      map.current.on('click', (e) => {
        closePopup();

        // Check footprints first
        const hits = map.current.queryRenderedFeatures(e.point, { layers: ['footprint-fill'] });
        if (hits.length > 0) {
          // De-duplicate by _id and build full features
          const uniqueMap = new Map();
          for (const h of hits) {
            const id = h.properties._id;
            if (id && !uniqueMap.has(id)) {
              const feature = transformFeature(h);
              const full = getFullBbox(id);
              if (full) {
                const b = full.bbox;
                feature.geometry = { type: 'Polygon', coordinates: [[[b[0],b[1]], [b[2],b[1]], [b[2],b[3]], [b[0],b[3]], [b[0],b[1]]]] };
              }
              uniqueMap.set(id, feature);
            }
          }
          const uniqueFeatures = [...uniqueMap.values()];

          // Single feature — select directly
          if (uniqueFeatures.length === 1) {
            if (onSelectRef.current) onSelectRef.current(uniqueFeatures[0]);
            return;
          }

          // Multiple features — show disambiguation popup
          if (uniqueFeatures.length > 1) {
            const container = document.createElement('div');
            container.className = 'oam-popup-container';

            const header = document.createElement('div');
            header.className = 'oam-popup-header';
            header.textContent = `${uniqueFeatures.length} images here`;
            container.appendChild(header);

            const items = document.createElement('div');
            items.className = 'oam-popup-items';

            for (const feat of uniqueFeatures) {
              const fp = feat.properties;
              const item = document.createElement('div');
              item.className = 'oam-popup-item';

              const title = document.createElement('div');
              title.className = 'oam-popup-item-title';
              title.textContent = fp.title || 'Untitled';
              item.appendChild(title);

              const meta = document.createElement('div');
              meta.className = 'oam-popup-item-meta';
              const dateStr = fp.date && fp.date !== 'Unknown Date'
                ? new Date(fp.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Unknown Date';
              meta.textContent = `${dateStr} · ${fp.provider || 'Unknown'}`;
              item.appendChild(meta);

              item.addEventListener('click', () => {
                if (onSelectRef.current) onSelectRef.current(feat);
                closePopup();
              });
              items.appendChild(item);
            }
            container.appendChild(items);

            popupRef.current = new maplibregl.Popup({
              closeButton: true,
              closeOnClick: true,
              maxWidth: '280px',
              className: 'oam-disambig-popup'
            })
              .setLngLat(e.lngLat)
              .setDOMContent(container)
              .addTo(map.current);
            return;
          }
        }

        // Check grid cells — zoom in on click
        const gridHits = map.current.queryRenderedFeatures(e.point, { layers: ['grid-fill'] });
        if (gridHits.length > 0 && gridHits[0].properties.count > 0) {
          const gridProps = gridHits[0].properties;
          // For single-image grid cells, select the image directly
          if (gridProps.count === 1 && gridProps.singleId) {
            const full = getFullBbox(gridProps.singleId);
            if (full) {
              const feature = transformFeature(full.feature);
              const b = full.bbox;
              feature.geometry = { type: 'Polygon', coordinates: [[[b[0],b[1]], [b[2],b[1]], [b[2],b[3]], [b[0],b[3]], [b[0],b[1]]]] };
              if (onSelectRef.current) onSelectRef.current(feature);
              return;
            }
          }
          // Use combined image bbox if available, otherwise fall back to cell polygon
          const gp = gridHits[0].properties;
          const imageBounds = (gp.bboxW != null) ? [gp.bboxW, gp.bboxS, gp.bboxE, gp.bboxN] : bbox(gridHits[0]);
          map.current.fitBounds(imageBounds, { padding: 20 });
          return;
        }

        // Click outside - deselect
        if (onSelectRef.current) onSelectRef.current(null);
      });

      ['footprint-fill', 'grid-fill'].forEach(layer => {
        map.current.on('mouseenter', layer, () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', layer, () => {
          if (!selectedFeatureRef.current) map.current.getCanvas().style.cursor = '';
        });
      });

      map.current.on('movestart', () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      });

      map.current.on('moveend', () => {
        updateUrlView();

        // Notify parent of new bounds/center for MiniMap & Search
        if (isProgrammaticMove.current) { isProgrammaticMove.current = false; return; }

        debounceTimer.current = setTimeout(() => {
          if (!map.current) return;
          const bounds = map.current.getBounds();
          const center = map.current.getCenter();
          const bboxArray = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
          if (onSearchRef.current) onSearchRef.current(bboxArray, [center.lng, center.lat], bboxArray);
        }, 500);
      });

      // Emit visible features, update grid, and trigger preview refresh on idle
      map.current.on('idle', () => {
        emitVisibleFeatures();
        updateGridSource();
        setMapZoom(map.current.getZoom());
        setIdleTick(t => t + 1);
      });
    });
  }, []);

  // 2. SEARCH
  useEffect(() => {
    if (!map.current || !isLoaded || !searchBbox) return;
    try { isProgrammaticMove.current = true; map.current.fitBounds(searchBbox, { padding: 50, maxZoom: 14 }); } catch(e) {}
  }, [searchBbox, isLoaded]);

  // 3. BASEMAP SWITCHER
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    let tiles = [];
    if (basemap === 'carto') {
      tiles = ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'];
    } else if (basemap === 'hot') {
      tiles = ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'];
    } else if (basemap === 'satellite') {
      tiles = [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=${MB_TOKEN}`];
    }
    const source = map.current.getSource('basemap-source');
    if (source) source.setTiles(tiles);
  }, [basemap, isLoaded]);

  // 4. FILTERS — update grid (which also sets footprint filters) and re-emit sidebar features
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    updateGridSource(); // handles both grid data and footprint layer filters
    emitVisibleFeatures();
  }, [filters, isLoaded]);

  // 5. SELECTION
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    closePopup();
    const mapInstance = map.current;
    const selectedId = selectedFeature?.properties?.id;

    // Red highlight filter
    mapInstance.setFilter('footprint-highlight', selectedId ? ['==', '_id', selectedId] : ['==', '_id', '']);

    // Zoom/pan to selected feature
    if (selectedFeature) {
      try {
        isProgrammaticMove.current = true;
        // Use full bbox from all tile fragments for accurate panning
        const full = selectedId ? getFullBbox(selectedId) : null;
        const bounds = full ? full.bbox : bbox(selectedFeature);
        mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 18, duration: 1500 });
      } catch (e) {}
    }

    // Update preview opacities and move selected preview to top
    const style = mapInstance.getStyle();
    const selectedLayerId = selectedId ? `preview-${selectedId}` : null;
    style?.layers?.forEach(layer => {
      if (layer.id.startsWith('preview-')) {
        const previewId = layer.id.replace('preview-', '');
        const opacity = selectedId ? (previewId === selectedId ? 1.0 : 0.3) : 0.95;
        mapInstance.setPaintProperty(layer.id, 'raster-opacity', opacity);
      }
    });
    // Move selected preview to top of preview stack (just below footprint-hover)
    if (selectedLayerId && mapInstance.getLayer(selectedLayerId)) {
      mapInstance.moveLayer(selectedLayerId, 'footprint-hover');
    }

    // Update footprint visibility
    const fillOpacity = selectedId ? 0 : 0.1;
    const lineOpacity = selectedId ? 0.15 : 0.8;
    if (mapInstance.getLayer('footprint-fill')) mapInstance.setPaintProperty('footprint-fill', 'fill-opacity', fillOpacity);
    if (mapInstance.getLayer('footprint-line')) mapInstance.setPaintProperty('footprint-line', 'line-opacity', lineOpacity);
  }, [selectedFeature, isLoaded]);

  // 6. PREVIEW MANAGEMENT
  const MAX_PREVIEWS = 25;
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const mapInstance = map.current;
    const zoom = mapInstance.getZoom();
    const selectedId = selectedFeature?.properties?.id;

    // Show previews at z8+ — determine which features are visible, then use getFullBbox for positioning
    const visibleIds = new Set();
    const featureThumbnails = new Map(); // id → thumbnail url
    if (previewsEnabled && zoom >= 8) {
      try {
        const raw = mapInstance.queryRenderedFeatures(undefined, { layers: ['footprint-fill'] });
        for (const f of raw) {
          const id = f.properties._id;
          if (!id || !f.properties.thumbnail) continue;
          if (!visibleIds.has(id)) {
            if (visibleIds.size >= MAX_PREVIEWS) continue;
            visibleIds.add(id);
            featureThumbnails.set(id, f.properties.thumbnail);
          }
        }
      } catch (e) {}
    }

    // Remove stale preview layers
    const style = mapInstance.getStyle();
    if (style && style.layers) {
      style.layers.forEach(layer => {
        if (layer.id.startsWith('preview-')) {
          const id = layer.id.replace('preview-', '');
          if (!visibleIds.has(id)) {
            mapInstance.removeLayer(layer.id);
            if (mapInstance.getSource(layer.id)) mapInstance.removeSource(layer.id);
          }
        }
      });
    }

    // Add or update preview layers — use getFullBbox for correct positioning across tile boundaries
    for (const id of visibleIds) {
      const layerId = `preview-${id}`;

      try {
        // Get full bbox from all source tile fragments (not just rendered/viewport)
        const full = getFullBbox(id);
        if (!full) continue;
        const b = full.bbox;
        const coords = [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];

        if (mapInstance.getLayer(layerId)) {
          // Update coordinates — more tiles may have loaded since preview was created
          const source = mapInstance.getSource(layerId);
          if (source) source.setCoordinates(coords);
          continue;
        }

        const proxyUrl = thumbProxyUrl(featureThumbnails.get(id));
        const opacity = selectedId ? (id === selectedId ? 1.0 : 0.3) : 0.95;

        mapInstance.addSource(layerId, { type: 'image', url: proxyUrl, coordinates: coords });
        mapInstance.addLayer({
          id: layerId,
          type: 'raster',
          source: layerId,
          paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 }
        }, 'footprint-hover');
      } catch (e) {}
    }
  }, [isLoaded, selectedFeature, previewsEnabled, idleTick]);

  // 7. TMS FULL-RESOLUTION LAYER (at z14+)
  const TMS_SOURCE_ID = 'tms-fullres';
  const TMS_LAYER_ID = 'tms-fullres-layer';
  const TMS_MIN_ZOOM = 14;

  const removeTmsLayer = (mapInstance) => {
    if (mapInstance.getLayer(TMS_LAYER_ID)) mapInstance.removeLayer(TMS_LAYER_ID);
    if (mapInstance.getSource(TMS_SOURCE_ID)) mapInstance.removeSource(TMS_SOURCE_ID);
  };

  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const mapInstance = map.current;
    const zoom = mapInstance.getZoom();
    const selectedId = selectedFeature?.properties?.id;

    // Remove TMS if no selection or below min zoom
    if (!selectedFeature || zoom < TMS_MIN_ZOOM) {
      removeTmsLayer(mapInstance);
      return;
    }

    const tmsUrl = getTmsUrl(selectedFeature.properties);
    if (!tmsUrl) {
      removeTmsLayer(mapInstance);
      return;
    }

    // If TMS source already exists for current selection, skip
    const existingSource = mapInstance.getSource(TMS_SOURCE_ID);
    if (existingSource) {
      // Check if it's the same image — tiles array matches
      const currentTiles = existingSource.tiles;
      if (currentTiles && currentTiles[0] === tmsUrl) return;
      // Different image — remove and re-add
      removeTmsLayer(mapInstance);
    }

    try {
      mapInstance.addSource(TMS_SOURCE_ID, {
        type: 'raster',
        tiles: [tmsUrl],
        tileSize: 256,
        minzoom: 12,
        maxzoom: 22
      });
      mapInstance.addLayer({
        id: TMS_LAYER_ID,
        type: 'raster',
        source: TMS_SOURCE_ID,
        paint: { 'raster-opacity': 1.0 }
      }, 'footprint-hover');
    } catch (e) {
      console.error('TMS layer error:', e);
    }
  }, [selectedFeature, isLoaded, idleTick]);

  // 8. HOVER HIGHLIGHT
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const selectedId = selectedFeature?.properties?.id;
    const showHover = selectedId && hoveredFeatureId && hoveredFeatureId !== selectedId;
    map.current.setFilter('footprint-hover', showHover ? ['==', '_id', hoveredFeatureId] : ['==', '_id', '']);
  }, [hoveredFeatureId, selectedFeature, isLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Preview Toggle - Bottom Left */}
      <div className="absolute bottom-8 left-4 z-10">
        <button
          onClick={() => setPreviewsEnabled(!previewsEnabled)}
          disabled={mapZoom < 8}
          className={`px-4 py-2 text-xs font-semibold rounded-md shadow-md border transition-all ${
            mapZoom < 8
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : previewsEnabled
                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {mapZoom < 8 ? 'Previews (zoom in)' : previewsEnabled ? 'Previews On' : 'Previews Off'}
        </button>
      </div>
    </div>
  );
}

export default OamMap;
