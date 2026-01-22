import React, { useRef, useEffect, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import bbox from '@turf/bbox';
import center from '@turf/center';
import { featureCollection, polygon } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import 'maplibre-gl/dist/maplibre-gl.css';

// MAPBOX SATELLITE TOKEN (Provided)
const MB_TOKEN = 'pk.eyJ1Ijoib3BlbmFlcmlhbG1hcCIsImEiOiJjbWowaThzc2swOTVtM2NxMXA2Y2J3bDdzIn0.gmFG84efi2_zK6Yx5ot_5Q';

function Map({ features, selectedFeature, onMapInit, searchBbox, onSearchArea, onSelect, layerMode, setLayerMode, previewedIds, hiddenIds, basemap }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const debounceTimer = useRef(null);
  const gridTimer = useRef(null);
  const isProgrammaticMove = useRef(false);
  const onSearchRef = useRef(onSearchArea);
  
  const onSelectRef = useRef(onSelect);
  const selectedFeatureRef = useRef(selectedFeature);
  
  const [isLoaded, setIsLoaded] = useState(false); 
  const [gridVersion, setGridVersion] = useState(0); 
  const [zoomMsg, setZoomMsg] = useState('');

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { selectedFeatureRef.current = selectedFeature; }, [selectedFeature]);
  useEffect(() => { onSearchRef.current = onSearchArea; }, [onSearchArea]);

  const { largeFeatures, smallFeatures } = useMemo(() => {
    const large = features.filter(f => f.properties.is_large);
    const small = features.filter(f => !f.properties.is_large);
    return { largeFeatures: large, smallFeatures: small };
  }, [features]);

  // --- TILE MATH HELPERS ---
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

  // --- CORE GRID GENERATOR ---
  const updateGridSource = (currentFeatures) => {
      if (!map.current || !map.current.getSource('oam-grid')) return;
      if (!currentFeatures || currentFeatures.length === 0) {
          map.current.getSource('oam-grid').setData({ type: 'FeatureCollection', features: [] });
          return;
      }

      try {
          const points = currentFeatures.map(f => center(f));
          const totalBounds = bbox(featureCollection(points)); 
          const currentZoom = map.current.getZoom();
          
          let gridZoom = Math.floor(currentZoom) + 4; 
          if (gridZoom < 2) gridZoom = 2; 
          if (gridZoom > 14) gridZoom = 14;

          let minX = lon2tile(totalBounds[0], gridZoom);
          let maxX = lon2tile(totalBounds[2], gridZoom);
          let minY = lat2tile(totalBounds[3], gridZoom);
          let maxY = lat2tile(totalBounds[1], gridZoom);

          while ((maxX - minX + 1) * (maxY - minY + 1) > 2500 && gridZoom > 0) {
              gridZoom--;
              minX = lon2tile(totalBounds[0], gridZoom);
              maxX = lon2tile(totalBounds[2], gridZoom);
              minY = lat2tile(totalBounds[3], gridZoom);
              maxY = lat2tile(totalBounds[1], gridZoom);
          }

          const gridFeatures = [];
          const largePolygons = largeFeatures.map(f => f.geometry); 
          const isHybridZone = currentZoom >= 8 && currentZoom < 10;

          for (let x = minX; x <= maxX; x++) {
              for (let y = minY; y <= maxY; y++) {
                  const tilePoly = tileToGeoJSON(x, y, gridZoom);
                  let count = 0;
                  
                  let overlapsLargeFootprint = false;
                  if (isHybridZone) { 
                      for (const largePoly of largePolygons) {
                          if (booleanPointInPolygon(center(tilePoly), largePoly)) {
                              overlapsLargeFootprint = true;
                              break;
                          }
                      }
                  }
                  
                  for (const pt of points) {
                      if (booleanPointInPolygon(pt, tilePoly)) count++;
                  }
                  
                  if (count > 0 && !(isHybridZone && overlapsLargeFootprint)) {
                      tilePoly.properties = { count: Number(count) };
                      gridFeatures.push(tilePoly);
                  }
              }
          }

          map.current.getSource('oam-grid').setData({ type: 'FeatureCollection', features: gridFeatures });
      } catch (e) { console.error("Grid update error:", e); }
  };

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (map.current) return;
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
      attributionControl: false // We will move this or let it default
    });

    // Pass map instance back to parent for Toolbar control
    if (onMapInit) onMapInit(map.current);

    // Add Attribution manually if needed, or keep default bottom-right
    map.current.addControl(new maplibregl.AttributionControl(), 'bottom-right');

    map.current.on('load', () => {
      setIsLoaded(true);
      updateUrlView();

      map.current.addSource('oam-imagery', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.current.addSource('oam-large-imagery', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.current.addSource('oam-small-imagery', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.current.addSource('oam-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // Grid Layers
      map.current.addLayer({
          id: 'grid-fill', type: 'fill', source: 'oam-grid', maxzoom: 10, 
          paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'count'], 1, '#cceeff', 5, '#66b3ff', 20, '#0066cc', 50, '#003366'], 'fill-opacity': 0.65 }
      });
      map.current.addLayer({
        id: 'grid-count', type: 'symbol', source: 'oam-grid', maxzoom: 10,
        filter: ['>', ['get', 'count'], 0],
        layout: { 'text-field': '{count}', 'text-size': 12, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': false },
        paint: { 'text-color': '#003366', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
      });

      // Split Footprints
      map.current.addLayer({ id: 'oam-large-fill', type: 'fill', source: 'oam-large-imagery', minzoom: 8, maxzoom: 22, paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.1 } });
      map.current.addLayer({ id: 'oam-large-line', type: 'line', source: 'oam-large-imagery', minzoom: 8, maxzoom: 22, paint: { 'line-color': '#00B0FF', 'line-width': 2, 'line-opacity': 0.8 } });
      
      map.current.addLayer({ id: 'oam-small-fill', type: 'fill', source: 'oam-small-imagery', minzoom: 10, maxzoom: 22, paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.1 } });
      map.current.addLayer({ id: 'oam-small-line', type: 'line', source: 'oam-small-imagery', minzoom: 10, maxzoom: 22, paint: { 'line-color': '#00B0FF', 'line-width': 2, 'line-opacity': 0.8 } });
      
      // Highlight
      map.current.addLayer({ id: 'oam-highlight', type: 'line', source: 'oam-imagery', filter: ['==', 'id', ''], paint: { 'line-color': '#FF0000', 'line-width': 3 } });

      // --- EVENTS ---
      map.current.on('click', ['oam-large-fill', 'oam-small-fill'], (e) => {
        if (e.features && e.features.length > 0) {
          isProgrammaticMove.current = true; 
          const feature = { type: 'Feature', geometry: e.features[0].geometry, properties: e.features[0].properties };
          if (onSelectRef.current) onSelectRef.current(feature);
        }
      });

      map.current.on('click', 'grid-fill', (e) => {
        if (e.features[0].properties.count > 0) {
            const bounds = bbox(e.features[0]);
            map.current.fitBounds(bounds, { padding: 20 });
        }
      });

      map.current.on('click', (e) => {
        const hits = map.current.queryRenderedFeatures(e.point, { layers: ['oam-large-fill', 'oam-small-fill', 'grid-fill'] });
        if (hits.length === 0 && onSelectRef.current) onSelectRef.current(null);
      });

      const interactiveLayers = ['oam-large-fill', 'oam-small-fill', 'grid-fill'];
      interactiveLayers.forEach(layer => {
          map.current.on('mouseenter', layer, () => { map.current.getCanvas().style.cursor = 'pointer'; });
          map.current.on('mouseleave', layer, () => { map.current.getCanvas().style.cursor = ''; });
      });

      map.current.on('movestart', () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); });
      
      map.current.on('moveend', () => {
        updateUrlView(); 
        
        // 1. Regenerate Grid on Zoom Change
        if (gridTimer.current) clearTimeout(gridTimer.current);
        gridTimer.current = setTimeout(() => { setGridVersion(v => v + 1); }, 300);

        // 2. AUTO-DESELECT LOGIC
        const currentZoom = map.current.getZoom();
        const activeFeature = selectedFeatureRef.current;
        if (activeFeature) {
            const isLarge = activeFeature.properties.is_large;
            if ((!isLarge && currentZoom < 10) || (isLarge && currentZoom < 8)) {
                if (onSelectRef.current) onSelectRef.current(null);
            }
        }

        // Notify parent of new bounds/center for MiniMap & Search
        if (isProgrammaticMove.current) { isProgrammaticMove.current = false; return; }
        
        debounceTimer.current = setTimeout(() => {
           if (!map.current) return;
           const bounds = map.current.getBounds();
           const center = map.current.getCenter();
           const bboxArray = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
           if (onSearchRef.current) onSearchRef.current(bboxArray, [center.lng, center.lat], [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
        }, 1500); 
      });
    });
  }, []);

  // 2. DATA UPDATE
  useEffect(() => {
    if (!map.current || !isLoaded || !map.current.getSource('oam-imagery')) return;
    
    map.current.getSource('oam-imagery').setData(featureCollection(features)); 
    if (map.current.getSource('oam-large-imagery')) map.current.getSource('oam-large-imagery').setData(featureCollection(largeFeatures));
    if (map.current.getSource('oam-small-imagery')) map.current.getSource('oam-small-imagery').setData(featureCollection(smallFeatures));
    
    updateGridSource(features);
  }, [features, isLoaded, gridVersion, largeFeatures, smallFeatures]);

  // 4. SEARCH
  useEffect(() => {
    if (!map.current || !isLoaded || !searchBbox) return;
    try { isProgrammaticMove.current = true; map.current.fitBounds(searchBbox, { padding: 50, maxZoom: 14 }); } catch(e) {}
  }, [searchBbox, isLoaded]);

  // 5. BASEMAP SWITCHER
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
    if (source) {
        source.setTiles(tiles);
    }
  }, [basemap, isLoaded]);

  // 6. SELECTION
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const mapInstance = map.current;
    if (mapInstance.getLayer('selected-thumbnail')) mapInstance.removeLayer('selected-thumbnail');
    if (mapInstance.getSource('selected-thumbnail-source')) mapInstance.removeSource('selected-thumbnail-source');
    
    if (!selectedFeature) {
      mapInstance.setFilter('oam-highlight', ['==', 'id', '']);
      return;
    }
    
    const id = selectedFeature.properties.id; 
    const rawThumbnail = selectedFeature.properties.thumbnail;
    mapInstance.setFilter('oam-highlight', ['==', 'id', id]);
    
    try {
      const bounds = bbox(selectedFeature);
      if (!isProgrammaticMove.current) { mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 18, duration: 1500 }); }
      
      if (rawThumbnail) {
        const proxyThumbnail = `https://corsproxy.io/?${encodeURIComponent(rawThumbnail)}`;
        const coords = [[bounds[0], bounds[3]], [bounds[2], bounds[3]], [bounds[2], bounds[1]], [bounds[0], bounds[1]]];
        mapInstance.addSource('selected-thumbnail-source', { type: 'image', url: proxyThumbnail, coordinates: coords });
        mapInstance.addLayer({ id: 'selected-thumbnail', type: 'raster', source: 'selected-thumbnail-source', paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 } }, 'oam-highlight'); 
      }
    } catch(e) {}
  }, [selectedFeature, isLoaded]);

  // 7. LAYER MODES
  useEffect(() => {
    if (!map.current || !isLoaded) return;
    const mapInstance = map.current;
    
    const idsToShow = new Set(); 
    const isGlobalPreviewOn = layerMode === 'previews';
    const zoom = mapInstance.getZoom();

    if (isGlobalPreviewOn) {
        if (zoom < 8) {
            setZoomMsg('Zoom in to see images');
        } else {
            setZoomMsg('');
            features.forEach(f => {
              if (!hiddenIds.has(f.properties.id)) idsToShow.add(f.properties.id);
            });
        }
    } else {
        setZoomMsg(''); 
    }

    previewedIds.forEach(id => idsToShow.add(id));

    const style = mapInstance.getStyle();
    if (style && style.layers) {
      style.layers.forEach(layer => {
        if (layer.id.startsWith('preview-')) {
          const id = layer.id.replace('preview-', '');
          if (!idsToShow.has(id)) {
             mapInstance.removeLayer(layer.id);
             if (mapInstance.getSource(layer.id)) mapInstance.removeSource(layer.id);
          }
        }
      });
    }

    idsToShow.forEach(id => {
       const layerId = `preview-${id}`;
       if (mapInstance.getLayer(layerId)) return; 

       const feature = features.find(f => f.properties.id === id);
       if (feature && feature.properties.thumbnail) {
           try {
              const bounds = bbox(feature);
              const coords = [[bounds[0], bounds[3]], [bounds[2], bounds[3]], [bounds[2], bounds[1]], [bounds[0], bounds[1]]];
              const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(feature.properties.thumbnail)}`;
              mapInstance.addSource(layerId, { type: 'image', url: proxyUrl, coordinates: coords });
              mapInstance.addLayer({ id: layerId, type: 'raster', source: layerId, paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 } }, 'oam-highlight'); 
           } catch(e) { console.error("Error adding layer", id, e); }
       }
    });

    if (mapInstance.getLayer('oam-large-fill')) {
      const footprintFillOpacity = 0.1;
      mapInstance.setPaintProperty('oam-large-fill', 'fill-opacity', footprintFillOpacity);
      mapInstance.setPaintProperty('oam-small-fill', 'fill-opacity', footprintFillOpacity);
      
      if (mapInstance.getLayer('grid-fill')) {
          mapInstance.setLayoutProperty('grid-fill', 'visibility', 'visible');
          mapInstance.setLayoutProperty('grid-count', 'visibility', 'visible');
      }
    }
  }, [layerMode, features, isLoaded, previewedIds, hiddenIds]); 

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Layer Mode Toggle */}
      <div className="absolute bottom-8 left-4 z-10 bg-white rounded-md shadow-md border border-gray-200 flex flex-col overflow-hidden">
        <button onClick={() => setLayerMode('none')} className={`px-4 py-2 text-xs font-semibold text-left hover:bg-gray-50 border-b border-gray-100 ${layerMode === 'none' ? 'bg-gray-100 text-cyan-700' : 'text-gray-600'}`}>Footprints Only</button>
        <button onClick={() => setLayerMode('previews')} className={`px-4 py-2 text-xs font-semibold text-left hover:bg-gray-50 ${layerMode === 'previews' ? 'bg-cyan-50 text-cyan-700' : 'text-gray-600'}`}>Live Previews</button>
      </div>

      {layerMode === 'previews' && zoomMsg && (
        <div className="absolute bottom-8 left-36 z-30 bg-black/80 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in pointer-events-none whitespace-nowrap">
          {zoomMsg}
        </div>
      )}
    </div>
  );
}

export default Map;