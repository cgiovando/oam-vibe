import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Map from './components/Map';
import MapFilterBar from './components/MapFilterBar';
import Toolbar from './components/Toolbar';
import MiniMap from './components/MiniMap';
import BurgerMenu from './components/BurgerMenu';

function App() {
  const [features, setFeatures] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [mapBbox, setMapBbox] = useState(null);

  // Track Map State for Controls/MiniMap
  const [mapInstance, setMapInstance] = useState(null);
  const [mapCenter, setMapCenter] = useState([0, 20]);
  const [mapBounds, setMapBounds] = useState(null);

  const initialUrlSelectionDone = useRef(false);

  // --- STATE ---
  const [previewsEnabled, setPreviewsEnabled] = useState(true);
  const [hoveredFeatureId, setHoveredFeatureId] = useState(null);
  const [basemap, setBasemap] = useState('carto');

  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      dateStart: params.get('dateStart') || '',
      dateEnd: params.get('dateEnd') || '',
      platform: params.get('platform') || '',
      license: params.get('license') || ''
    };
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

  // Called by Map on idle with visible features from PMTiles
  const handleFeaturesUpdate = (newFeatures) => {
    setFeatures(newFeatures);
  };

  // Restore selection from URL once features first arrive
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
    const params = new URLSearchParams(window.location.search);
    ['dateStart', 'dateEnd', 'platform', 'license'].forEach(key => {
      if (newFilters[key]) params.set(key, newFilters[key]);
      else params.delete(key);
    });
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleLocationSelect = (bbox) => {
    setMapBbox(bbox);
  };

  // --- MAP SYNC HANDLER (MiniMap only — do NOT set mapBbox here to avoid fitBounds loop) ---
  const handleMapMoveEnd = (bbox, center, exactBounds) => {
    setMapCenter(center);
    setMapBounds(exactBounds);
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-gray-100 font-sans">

      {/* 1. SIDEBAR (Left) */}
      <div className="flex flex-col w-96 h-full bg-white border-r border-gray-200 shadow-xl z-20 relative">
        <Sidebar
          features={features}
          onSelect={handleSelectFeature}
          selectedFeature={selectedFeature}
        />
      </div>

      {/* 2. MAIN MAP AREA */}
      <div className="flex-1 h-full relative">

        {/* TOP LEFT: Filters */}
        <div className="absolute top-4 left-4 z-30 w-full max-w-2xl">
            <MapFilterBar filters={filters} onChange={handleFilterChange} />
        </div>

        {/* TOP RIGHT: Burger Menu */}
        <BurgerMenu />

        {/* BOTTOM RIGHT: MiniMap */}
        <div className="absolute bottom-12 right-4 z-30">
           <MiniMap center={mapCenter} bounds={mapBounds} />
        </div>

        {/* BOTTOM LEFT: Toolbar */}
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
          selectedFeature={selectedFeature}
          onSelect={handleSelectFeature}
          onFeaturesUpdate={handleFeaturesUpdate}
          searchBbox={mapBbox}
          onSearchArea={handleMapMoveEnd}
          previewsEnabled={previewsEnabled}
          setPreviewsEnabled={setPreviewsEnabled}
          hoveredFeatureId={hoveredFeatureId}
          onHover={setHoveredFeatureId}
          basemap={basemap}
          filters={filters}
        />
      </div>
    </div>
  );
}

export default App;
