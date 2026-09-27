import React from 'react';
import { SensorPanel } from '../components/SensorPanel';

export const Sensors = () => {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold mb-4">Sensor Diagnostics</h2>
      <SensorPanel />
    </div>
  );
};
