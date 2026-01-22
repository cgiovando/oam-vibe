import React, { useState } from 'react';

function SearchBar({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const bbox = [
          parseFloat(result.boundingbox[2]), // minLon
          parseFloat(result.boundingbox[0]), // minLat
          parseFloat(result.boundingbox[3]), // maxLon
          parseFloat(result.boundingbox[1])  // maxLat
        ];
        
        onLocationSelect(bbox, result.display_name);
      } else {
        alert('Location not found');
      }
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed');
    }
    setIsSearching(false);
  };

  return (
    <div className="p-4 border-b border-gray-200 bg-white">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search location (e.g. Haiti)..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-500"
        />
        <button 
          type="submit" 
          disabled={isSearching}
          className="bg-cyan-500 text-white px-4 py-2 rounded text-sm font-bold hover:bg-cyan-600 disabled:bg-gray-300 transition-colors"
        >
          {isSearching ? '...' : 'Go'}
        </button>
      </form>
    </div>
  );
}

export default SearchBar;