import React from 'react';
import { SensorPanel } from '../components/SensorPanel';
import { LidarSignalsHUD } from '../components/LidarSignalsHUD';

export const Sensors = () => {
  return (
    <div className="max-w-6xl space-y-5 pb-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">
            Robot Sensor Diagnostics & Signal Scopes
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            Real-time optical waveforms, 360° laser polar scanner, ultrasonic telemetry & camera vision
          </p>
        </div>
      </div>

      {/* Primary LiDAR Signals Suite */}
      <LidarSignalsHUD />

      {/* Sensor Diagnostic Panel */}
      <div className="max-w-3xl">
        <SensorPanel />
      </div>
    </div>
  );
};

