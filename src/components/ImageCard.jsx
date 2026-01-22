import React, { useState, useRef, useEffect } from 'react';
import bbox from '@turf/bbox';

function ImageCard({ feature, onSelect, isSelected, isPreviewOn, onTogglePreview }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
      setTimeout(() => {
        if (cardRef.current) {
          cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      setIsExpanded(false); 
    }
  }, [isSelected]);

  const p = feature.properties;

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'Unknown Date') return 'Unknown Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const toSentenceCase = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const formatPlatform = (plat) => {
    if (!plat) return 'Unknown';
    const lower = plat.toLowerCase();
    if (lower === 'uav' || lower === 'drone') return 'Drone';
    return toSentenceCase(plat);
  };

  const getIdsFromFeature = () => {
    const uuid = p.uuid;
    const parts = uuid.split('/');
    const filename = parts[parts.length - 1].replace('.tif', '').replace('.tiff', '');
    const uploadId = parts[parts.length - 3];
    return { uploadId, filename };
  };

  const getTmsUrl = () => {
    const { uploadId, filename } = getIdsFromFeature();
    return `https://tiles.openaerialmap.org/${uploadId}/0/${filename}/{z}/{x}/{y}`;
  };

  const toggleDetails = (e) => { e.stopPropagation(); setIsExpanded(!isExpanded); };
  const handleDeselect = (e) => { e.stopPropagation(); onSelect(null); };
  const handleCopy = (e, text, feedbackId) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopyFeedback(feedbackId); setTimeout(() => setCopyFeedback(null), 2000); };

  // NEW: Handle Toggle Click
  const handleToggleClick = (e) => {
    e.stopPropagation();
    onTogglePreview();
  };

  const handleOpenJosm = async (e) => {
    e.stopPropagation();
    const url = getTmsUrl();
    const title = `OAM - ${p.title || p.id}`;
    const tmsUrl = `tms[22]:${url}`;
    const josmUrl = `http://127.0.0.1:8111/imagery?title=${encodeURIComponent(title)}&type=tms&url=${encodeURIComponent(tmsUrl)}`;
    try { await fetch(josmUrl); } catch (err) { alert("Could not connect to JOSM. Make sure JOSM is running and 'Remote Control' is enabled."); }
  };

  const handleOpenId = (e) => {
    e.stopPropagation();
    const url = getTmsUrl();
    const featureBbox = bbox(feature);
    const centerX = (featureBbox[0] + featureBbox[2]) / 2;
    const centerY = (featureBbox[1] + featureBbox[3]) / 2;
    const zoom = 16;
    const backgroundParam = `custom:${url}`;
    const idUrl = `https://www.openstreetmap.org/edit?editor=id#map=${zoom}/${centerY}/${centerX}&background=${encodeURIComponent(backgroundParam)}`;
    window.open(idUrl, '_blank');
  };

  return (
    <div 
      ref={cardRef}
      onClick={() => onSelect(feature)}
      className={`group border-b transition-all duration-200 relative ${
        isSelected 
          ? 'bg-white border-l-4 border-l-cyan-500 shadow-md my-2 rounded-r-md' 
          : 'border-gray-100 bg-white hover:bg-gray-50 border-l-4 border-l-transparent'
      }`}
    >
      {isSelected && (
        <button onClick={handleDeselect} className="absolute top-2 right-2 text-gray-400 hover:text-cyan-600 p-1 hover:bg-gray-100 rounded-full z-10" title="Deselect">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
      )}

      <div className="p-4">
        <div className="aspect-video bg-gray-100 rounded-md mb-3 overflow-hidden relative border border-gray-200 shadow-inner">
           {p.thumbnail ? <img src={p.thumbnail} alt="Preview" className="w-full h-full object-cover" loading="lazy" /> : <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Preview</div>}
           
           {/* NEW: Overlay Toggle Button on Image */}
           <button 
             onClick={handleToggleClick}
             className={`absolute top-2 left-2 p-1.5 rounded shadow-sm border transition-all z-10 ${isPreviewOn ? 'bg-cyan-500 text-white border-cyan-600 hover:bg-cyan-600' : 'bg-white/90 text-gray-500 border-gray-200 hover:text-cyan-600 hover:bg-white'}`}
             title={isPreviewOn ? "Hide on map" : "Show on map"}
           >
             {isPreviewOn ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                 <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
               </svg>
             ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
             )}
           </button>
        </div>

        <div className="flex justify-between items-start gap-2 pr-6">
          <h3 className={`font-bold text-sm leading-tight ${isSelected ? 'text-cyan-700' : 'text-gray-800'}`}>
            {p.title}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
          <span className="font-medium text-gray-700">{formatDate(p.date)}</span>
          <span className="text-gray-300">•</span>
          <span className="truncate max-w-[150px]" title={p.provider}>{p.provider}</span>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <button onClick={toggleDetails} className="flex-1 text-xs font-semibold text-gray-500 hover:text-cyan-600 flex items-center justify-center gap-1 py-1.5 transition-colors">
            {isExpanded ? 'Hide Details' : 'Show Details'} 
            <span className="text-[9px] transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </button>
          
          <a href={p.uuid} target="_blank" rel="noreferrer" download onClick={(e) => e.stopPropagation()} className="flex-1 text-xs font-semibold text-cyan-600 bg-cyan-50 hover:bg-cyan-100 py-1.5 rounded text-center transition-colors">
            Download GeoTIFF
          </a>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-gray-50 px-4 py-4 text-xs border-t border-gray-100 text-gray-600 animate-fade-in">
          <div className="mb-4 pb-3 border-b border-gray-200">
            <div className="flex gap-2">
              <button onClick={(e) => handleCopy(e, getTmsUrl(), 'tms')} className="flex-1 bg-white border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm">{copyFeedback === 'tms' ? <span className="text-green-600 font-bold">Copied!</span> : 'Copy TMS'}</button>
              <button onClick={handleOpenId} className="flex-1 bg-white border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm">Open iD</button>
              <button onClick={handleOpenJosm} className="flex-1 bg-white border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-gray-100 hover:border-gray-400 transition-all shadow-sm">Open JOSM</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div><span className="block text-[10px] uppercase text-gray-400 font-bold">Platform Type</span>{formatPlatform(p.platform)}</div>
            <div><span className="block text-[10px] uppercase text-gray-400 font-bold">Sensor</span>{toSentenceCase(p.sensor)}</div>
            <div><span className="block text-[10px] uppercase text-gray-400 font-bold">GSD (Resolution)</span>{p.gsd}</div>
            <div><span className="block text-[10px] uppercase text-gray-400 font-bold">File Size</span>{p.file_size || 'Unknown'}</div>
            <div><span className="block text-[10px] uppercase text-gray-400 font-bold">License</span><a href="https://creativecommons.org/licenses/" target="_blank" rel="noreferrer" className="hover:underline hover:text-cyan-600 truncate block" title={p.license}>{p.license}</a></div>
            <div className="min-w-0"><span className="block text-[10px] uppercase text-gray-400 font-bold">ID</span><span className="font-mono text-[10px] text-gray-500 block truncate select-all cursor-text bg-gray-100 px-1 rounded" title={p.id}>{p.id}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageCard;