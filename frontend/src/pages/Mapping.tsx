import React, { useState } from 'react';
import { startMapping, stopMapping } from '../services/api';

export const Mapping = () => {
  const [isMapping, setIsMapping] = useState(false);

  const toggleMapping = async () => {
    if (isMapping) {
      await stopMapping();
      setIsMapping(false);
    } else {
      await startMapping('New Map');
      setIsMapping(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
        <h2 className="text-xl font-bold mb-4">Environment Mapping</h2>
        <button onClick={toggleMapping} className={`px-6 py-3 rounded-lg font-bold text-white ${isMapping ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isMapping ? 'STOP MAPPING' : 'START MAPPING'}
        </button>
        {isMapping && (
          <div className="mt-6 p-4 bg-slate-800 rounded border border-slate-700 animate-pulse">
            <span className="text-blue-400 font-bold">Scanning environment...</span>
          </div>
        )}
      </div>
    </div>
  );
};
