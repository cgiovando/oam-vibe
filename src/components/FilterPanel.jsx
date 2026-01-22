import React, { useState } from 'react';

function FilterPanel({ filters, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);

  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const applyDatePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    onChange({
      ...filters,
      dateEnd: end.toISOString().split('T')[0],
      dateStart: start.toISOString().split('T')[0]
    });
    setShowCustomDates(false);
  };

  const setYearToDate = () => {
    const end = new Date();
    const start = new Date(new Date().getFullYear(), 0, 1);
    onChange({
      ...filters,
      dateEnd: end.toISOString().split('T')[0],
      dateStart: start.toISOString().split('T')[0]
    });
    setShowCustomDates(false);
  };

  const handleAnyDate = () => {
    onChange({
      ...filters,
      dateStart: '',
      dateEnd: ''
    });
    setShowCustomDates(false);
  };

  const today = new Date().toISOString().split('T')[0];

  const FilterButton = ({ active, label, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-[10px] font-medium border first:rounded-l last:rounded-r border-gray-300 -ml-[1px] first:ml-0 transition-colors
        ${active 
          ? 'bg-cyan-500 text-white border-cyan-600 z-10' 
          : 'bg-white text-gray-600 hover:bg-gray-50'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-b border-gray-200 bg-white relative z-30 shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-xs font-bold text-gray-600 hover:bg-gray-50 uppercase tracking-wide"
      >
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </span>
        <span className="text-gray-400">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3 bg-gray-50/50 border-t border-gray-100 pt-2 animate-fade-in-down">
          
          {/* 1. Platform (Button Group) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Platform</label>
            <div className="flex w-full shadow-sm">
              <FilterButton 
                active={filters.platform === ''} 
                label="All" 
                onClick={() => handleChange('platform', '')} 
              />
              <FilterButton 
                active={filters.platform === 'satellite'} 
                label="Satellite" 
                onClick={() => handleChange('platform', 'satellite')} 
              />
              <FilterButton 
                active={filters.platform === 'uav'} 
                label="Drone" 
                onClick={() => handleChange('platform', 'uav')} 
              />
              <FilterButton 
                active={filters.platform === 'aircraft'} 
                label="Other" 
                onClick={() => handleChange('platform', 'aircraft')} 
              />
            </div>
          </div>

          {/* 2. Date (Presets + Custom Toggle) */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date</label>
            <div className="flex w-full shadow-sm mb-2">
              <FilterButton 
                active={!filters.dateStart && !filters.dateEnd} 
                label="Any" 
                onClick={handleAnyDate} 
              />
              <FilterButton active={false} label="Week" onClick={() => applyDatePreset(7)} />
              <FilterButton active={false} label="Month" onClick={() => applyDatePreset(30)} />
              <FilterButton active={false} label="Year" onClick={setYearToDate} />
              <FilterButton 
                active={showCustomDates} 
                label="Custom..." 
                onClick={() => setShowCustomDates(!showCustomDates)} 
              />
            </div>

            {/* Custom Date Inputs (Hidden by default) */}
            {showCustomDates && (
              <div className="flex gap-2 items-center bg-white p-2 rounded border border-gray-200 shadow-inner">
                <input type="date" max={today} value={filters.dateStart} onChange={(e) => handleChange('dateStart', e.target.value)} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1" />
                <span className="text-gray-300">-</span>
                <input type="date" max={today} value={filters.dateEnd} onChange={(e) => handleChange('dateEnd', e.target.value)} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1" />
              </div>
            )}
          </div>

           {/* 3. License (Button Group) */}
           <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">License</label>
            <div className="flex w-full shadow-sm">
              <FilterButton 
                active={filters.license === ''} 
                label="Any" 
                onClick={() => handleChange('license', '')} 
              />
              <FilterButton 
                active={filters.license === 'CC-BY 4.0'} 
                label="CC-BY" 
                onClick={() => handleChange('license', 'CC-BY 4.0')} 
              />
              <FilterButton 
                active={filters.license === 'CC BY-NC 4.0'} 
                label="NC" 
                onClick={() => handleChange('license', 'CC BY-NC 4.0')} 
              />
              <FilterButton 
                active={filters.license === 'CC BY-SA 4.0'} 
                label="SA" 
                onClick={() => handleChange('license', 'CC BY-SA 4.0')} 
              />
            </div>
          </div>

          {/* Reset Link (Minimal) */}
          <div className="text-right pt-1">
             <button 
               onClick={() => {
                 onChange({ dateStart: '', dateEnd: '', platform: '', license: '' });
                 setShowCustomDates(false);
               }}
               className="text-[10px] text-cyan-600 hover:text-cyan-800 underline"
             >
               Clear Filters
             </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default FilterPanel;