import React, { useState } from 'react';
import { toggleSimulation, toggleDemoTime } from '../services/api';

export const Settings = () => {
  const [sim, setSim] = useState(false);
  const [demo, setDemo] = useState(false);

  const handleSim = async () => {
    await toggleSimulation(!sim);
    setSim(!sim);
  };

  const handleDemo = async () => {
    await toggleDemoTime(!demo);
    setDemo(!demo);
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border space-y-6">
      <h2 className="text-xl font-bold">System Settings</h2>
      
      <div className="flex items-center justify-between p-4 bg-slate-800 rounded">
        <div>
          <div className="font-bold">Simulation Mode</div>
          <div className="text-sm text-gray-400">Run without physical robot hardware</div>
        </div>
        <button onClick={handleSim} className={`px-4 py-2 rounded font-bold ${sim ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300'}`}>
          {sim ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-800 rounded">
        <div>
          <div className="font-bold">Demo Time</div>
          <div className="text-sm text-gray-400">Accelerate waiting timers for demos</div>
        </div>
        <button onClick={handleDemo} className={`px-4 py-2 rounded font-bold ${demo ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300'}`}>
          {demo ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
