import 'maplibre-gl/dist/maplibre-gl.css'; 
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Map from './components/Map';
import MapFilterBar from './components/MapFilterBar'; 
import Toolbar from './components/Toolbar';
import MiniMap from './components/MiniMap';
import BurgerMenu from './components/BurgerMenu';
import area from '@turf/area';

const RESULT_LIMIT = 50;
const LARGE_IMAGE_THRESHOLD_SQ_KM = 25; 

function App() {
  const [features, setFeatures] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [mapBbox, setMapBbox] = useState(null);
  
  // Track Map State for Controls/MiniMap
  const [mapInstance, setMapInstance] = useState(null);
  const [mapCenter, setMapCenter] = useState([0, 20]);
  const [mapBounds, setMapBounds] = useState(null);

  const [loading, setLoading] = useState(false);
  const initialUrlSelectionDone = useRef(false);

  // --- STATE ---
  const [layerMode, setLayerMode] = useState('none');
  const [previewedIds, setPreviewedIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [basemap, setBasemap] = useState('carto');

  const [filters, setFilters] = useState({
    dateStart: '', dateEnd: '', platform: '', license: ''
  });

  const updateUrlSelection = (feature) => {
    const params = new URLSearchParams(window.location.search);
    if (feature) params.set('selected_id', feature.properties.id);
    else params.delete('selected_id');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleSelectFeature = (feature) => {
    setSelectedFeature(feature);
    updateUrlSelection(feature);
  };

  const handleTogglePreview = (id) => {
    if (layerMode === 'previews') {
      setHiddenIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    } else {
      setPreviewedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const gb = 1073741824; 
    const mb = 1048576;
    if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
    return `${Math.round(bytes / mb)} MB`;
  };

  const fetchOamData = async (bbox = null, currentFilters = filters) => {
    setLoading(true);
    // Note: We don't reset previewedIds here to allow persistence during panning
    
    try {
      const API_BASE = import.meta.env.DEV ? '/api' : 'https://corsproxy.io/?https://api.openaerialmap.org';
      let url = `${API_BASE}/meta?limit=${RESULT_LIMIT}&order_by=acquisition_end&sort=desc`;
      
      if (bbox) url += `&bbox=${bbox.join(',')}`;
      if (currentFilters.dateStart) url += `&acquisition_from=${currentFilters.dateStart}`;
      if (currentFilters.dateEnd)   url += `&acquisition_to=${currentFilters.dateEnd}`;
      
      if (currentFilters.platform) {
         const apiPlatform = currentFilters.platform === 'other' ? 'aircraft' : currentFilters.platform;
         url += `&platform=${apiPlatform}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        let processedFeatures = data.results.map(image => {
          const rawPlatform = image.platform || image.properties?.platform || 'unknown';
          const featureAreaSqM = image.geojson ? area(image.geojson) : 0;
          return {
            type: 'Feature',
            geometry: image.geojson,
            properties: {
              id: image._id,
              uuid: image.uuid,
              title: image.title || 'Untitled Image',
              provider: image.provider,
              thumbnail: image.properties?.thumbnail || null,
              date: image.acquisition_end || 'Unknown Date',
              is_large: featureAreaSqM / 1000000 >= LARGE_IMAGE_THRESHOLD_SQ_KM, 
              platform: rawPlatform.toLowerCase(),
              sensor: image.sensor || image.properties?.sensor || 'Unknown Sensor',
              gsd: image.gsd ? `${(image.gsd).toFixed(2)} m` : 'N/A',
              file_size: formatFileSize(image.file_size),
              license: image.license || image.properties?.license || 'Unknown License',
              tags: image.tags ? image.tags.join(', ') : 'None'
            }
          };
        });

        // Client-side Filtering
        if (currentFilters.platform) {
          processedFeatures = processedFeatures.filter(f => {
            const p = f.properties.platform;
            if (currentFilters.platform === 'satellite') return p === 'satellite';
            if (currentFilters.platform === 'uav') return p === 'uav' || p === 'drone';
            if (currentFilters.platform === 'aircraft') return p !== 'satellite' && p !== 'uav' && p !== 'drone';
            return true;
          });
        }
        if (currentFilters.license) {
           const target = currentFilters.license.replace(/[\s-]/g, '').toLowerCase(); 
           processedFeatures = processedFeatures.filter(f => {
             const actual = (f.properties.license || '').replace(/[\s-]/g, '').toLowerCase();
             return actual.includes(target);
           });
        }
        setFeatures(processedFeatures);
      } else {
        setFeatures([]);
      }
    } catch (error) { console.error("Fetch error:", error); }
    setLoading(false);
  };

  useEffect(() => { fetchOamData(); }, []);

  useEffect(() => {
    if (features.length > 0 && !initialUrlSelectionDone.current) {
        const params = new URLSearchParams(window.location.search);
        const urlSelectedId = params.get('selected_id');
        if (urlSelectedId) {
            const feature = features.find(f => f.properties.id === urlSelectedId);
            if (feature) setSelectedFeature(feature);
        }
        initialUrlSelectionDone.current = true;
    }
  }, [features]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    fetchOamData(mapBbox, newFilters);
  };

  const handleLocationSelect = (bbox, name) => {
    setMapBbox(bbox);
    fetchOamData(bbox);
  };

  // --- MAP SYNC HANDLER ---
  const handleMapMoveEnd = (bbox, center, exactBounds) => {
    setMapBbox(bbox); 
    setMapCenter(center);
    setMapBounds(exactBounds); 
    
    // RESTORED: Trigger fetch when map moves to update Sidebar count & list
    fetchOamData(bbox); 
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-gray-100 font-sans">
      
      {/* 1. SIDEBAR (Left) */}
      <div className="flex flex-col w-96 h-full bg-white border-r border-gray-200 shadow-xl z-20 relative">
        <Sidebar 
          features={features} 
          onSelect={handleSelectFeature}
          selectedFeature={selectedFeature} 
          isLoading={loading}
          limit={RESULT_LIMIT}
          layerMode={layerMode}
          previewedIds={previewedIds}
          hiddenIds={hiddenIds}
          onTogglePreview={handleTogglePreview}
        />
      </div>

      {/* 2. MAIN MAP AREA */}
      <div className="flex-1 h-full relative">
        
        {/* TOP LEFT: Filters (Restored position) */}
        <div className="absolute top-4 left-4 z-30 w-full max-w-2xl">
            <MapFilterBar filters={filters} onChange={handleFilterChange} />
        </div>

        {/* TOP RIGHT: Burger Menu */}
        <BurgerMenu />

        {/* BOTTOM RIGHT: MiniMap (Aligned with Burger Menu) */}
        <div className="absolute bottom-8 right-4 z-30">
           <MiniMap center={mapCenter} bounds={mapBounds} />
        </div>

        {/* BOTTOM LEFT: Toolbar (Stacked above Footprints Switcher) */}
        {/* Adjusted bottom value to sit nicely above the layer toggle */}
        <Toolbar 
            className="absolute bottom-36 left-4 z-30"
            mapInstance={mapInstance} 
            onLocationSelect={handleLocationSelect}
            basemap={basemap}
            setBasemap={setBasemap}
        />

        {/* THE MAP */}
        <Map 
          onMapInit={setMapInstance} 
          features={features} 
          selectedFeature={selectedFeature}
          onSelect={handleSelectFeature}
          searchBbox={mapBbox} 
          onSearchArea={handleMapMoveEnd}
          layerMode={layerMode}
          setLayerMode={setLayerMode}
          previewedIds={previewedIds}
          hiddenIds={hiddenIds}
          basemap={basemap}
        />
      </div>
    </div>
  );
}

export default App;