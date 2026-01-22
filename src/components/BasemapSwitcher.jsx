import React, { useState } from 'react';

function BasemapSwitcher({ current, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const styles = [
    { id: 'carto', label: 'Carto Light', preview: 'bg-gray-100' },
    { id: 'hot', label: 'Humanitarian OSM', preview: 'bg-red-50' },
    { id: 'satellite', label: 'Mapbox Satellite', preview: 'bg-green-900' },
  ];

  return (
    <div className="absolute bottom-8 right-12 z-20 flex flex-col items-end gap-2 font-sans" onMouseLeave={() => setIsOpen(false)}>
      
      {/* Expanded List */}
      {isOpen && (
        <div className="bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden mb-2 animate-fade-in-up">
          {styles.map(style => (
            <button
              key={style.id}
              onClick={() => { onChange(style.id); setIsOpen(false); }}
              className={`flex items-center gap-3 px-4 py-2 w-48 text-left hover:bg-gray-50 transition-colors
                ${current === style.id ? 'bg-cyan-50 text-cyan-700 font-bold' : 'text-gray-700'}
              `}
            >
              <span className={`w-8 h-8 rounded border ${style.preview}`}></span>
              <span className="text-xs">{style.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Button */}
      <button 
        onMouseEnter={() => setIsOpen(true)}
        className="w-10 h-10 bg-white rounded shadow-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-600"
        title="Change Basemap"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.447-.894L15 7m0 13V7" />
        </svg>
      </button>
    </div>
  );
}

export default BasemapSwitcher;