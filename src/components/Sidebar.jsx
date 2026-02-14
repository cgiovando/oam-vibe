import React, { useState, useEffect, useRef } from 'react';
import ImageCard from './ImageCard';

const ITEMS_PER_PAGE = 10;

function Sidebar({ features, onSelect, selectedFeature, isLoading, limit }) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const listRef = useRef(null);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [features]);

  useEffect(() => {
    if (selectedFeature) {
      const index = features.findIndex(f => f.properties.id === selectedFeature.properties.id);
      if (index >= visibleCount) {
        setVisibleCount(index + 5);
      }
    }
  }, [selectedFeature, features, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, features.length));
  };

  const getHeaderText = () => {
    if (isLoading) return 'Loading...';
    if (features.length === 0) return 'No images found in view';
    if (features.length >= limit) return `Showing most recent ${limit} images`;
    return `${features.length} image${features.length !== 1 ? 's' : ''} in view`;
  };

  const visibleFeatures = features.slice(0, visibleCount);

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto bg-gray-50 relative scroll-smooth font-sans">
      <div className="p-5 border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
        
        {/* LOGO HEADER */}
        <div className="flex items-center gap-3 mb-2">
            <img 
              src="https://map.openaerialmap.org/static/media/oam-logo-h-pos.a507b97d.svg" 
              alt="OpenAerialMap" 
              className="h-8"
            />
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-gray-300 animate-pulse' : 'bg-cyan-500'}`}></span>
           {getHeaderText()}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {isLoading && features.length === 0 ? (
          <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-700"></div>
          </div>
        ) : features.length > 0 ? (
          <>
            {visibleFeatures.map((feature) => (
              <ImageCard
                key={feature.properties.id}
                feature={feature}
                onSelect={onSelect}
                isSelected={selectedFeature && selectedFeature.properties.id === feature.properties.id}
              />
            ))}
            
            {visibleCount < features.length && (
              <button 
                onClick={handleLoadMore}
                className="w-full py-3 bg-white border border-gray-300 text-gray-600 font-semibold rounded hover:bg-gray-50 hover:text-cyan-600 transition-colors shadow-sm"
              >
                Load More ({features.length - visibleCount} remaining)
              </button>
            )}
          </>
        ) : !isLoading && (
          <p className="text-center text-gray-500 py-8">Try moving the map or changing filters.</p>
        )}
      </div>

       {isLoading && features.length > 0 && (
          <div className="absolute inset-0 bg-white/50 z-30 pointer-events-none flex items-start justify-center pt-20">
              <div className="bg-white p-2 rounded-full shadow-md">
                 <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-700"></div>
              </div>
          </div>
       )}
    </div>
  );
}

export default Sidebar;