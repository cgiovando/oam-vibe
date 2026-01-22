import React, { useState } from 'react';

function BurgerMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { label: 'Upload Imagery', href: 'https://upload.openaerialmap.org/' },
    { label: 'About OAM', href: 'http://openaerialmap.org/about' },
    { label: 'Documentation', href: 'http://docs.openaerialmap.org' },
    { label: 'System Status', href: 'https://uptime.hotosm.org/' },
    { label: 'Contact Support', href: 'mailto:info@openaerialmap.org' },
  ];

  return (
    <div className="absolute top-4 right-4 z-50 font-sans">
      {/* Burger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-white rounded shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-cyan-600 hover:bg-gray-50 transition-all"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-48 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden animate-fade-in origin-top-right">
          <div className="py-1">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition-colors border-b border-gray-50 last:border-0"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BurgerMenu;