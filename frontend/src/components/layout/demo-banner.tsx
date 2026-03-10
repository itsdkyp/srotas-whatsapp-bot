'use client';
import React from 'react';

export function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-center py-1.5 px-4 text-[11px] font-medium tracking-wide flex-shrink-0 z-50 relative shadow-md w-full flex items-center justify-between">
      <div className="flex-1"></div>
      <div className="flex-1 text-center whitespace-nowrap">
        This is a functional mock showcase. UI states are simulated and will not affect real data.
      </div>
      <div className="flex-1 flex justify-end">
        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('start-tour'));
          }}
          className="bg-white/20 hover:bg-white/30 transition-colors px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          Guided Tour
        </button>
      </div>
    </div>
  );
}
