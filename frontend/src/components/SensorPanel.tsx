import React from 'react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { Radar, Camera, Waves, ShieldAlert } from 'lucide-react';

export const SensorPanel = () => {
  const { sensorData } = useRobotStatus();

  if (!sensorData) return <div className="p-4 bg-dark-card rounded-lg border border-dark-border text-center">No sensor data</div>;

  return (
    <div className="p-4 bg-dark-card rounded-lg border border-dark-border space-y-4">
      <h3 className="text-lg font-bold border-b border-dark-border pb-2">Sensors</h3>
      
      <div className="flex justify-between items-center">
        <span className="text-gray-400 flex items-center gap-2"><Radar size={16}/> LiDAR</span>
        <span className={sensorData.lidar.active ? 'text-green-500' : 'text-red-500'}>{sensorData.lidar.active ? 'ACTIVE' : 'INACTIVE'}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-400 flex items-center gap-2"><Camera size={16}/> Camera</span>
        {sensorData.camera.obstacle_detected ? <span className="text-red-500">OBSTACLE</span> : <span className="text-green-500">CLEAR</span>}
      </div>

      <div>
        <span className="text-gray-400 flex items-center gap-2 mb-2"><Waves size={16}/> Ultrasonic</span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-800 p-2 rounded">Front: {sensorData.ultrasonic.front}m</div>
          <div className="bg-slate-800 p-2 rounded">Rear: {sensorData.ultrasonic.rear}m</div>
          <div className="bg-slate-800 p-2 rounded">Left: {sensorData.ultrasonic.left}m</div>
          <div className="bg-slate-800 p-2 rounded">Right: {sensorData.ultrasonic.right}m</div>
        </div>
      </div>

      {sensorData.glass_detected && (
        <div className="bg-amber-500/20 text-amber-500 p-2 rounded flex items-center gap-2 mt-4 text-sm font-bold border border-amber-500/50">
          <ShieldAlert size={16} /> GLASS DETECTED
        </div>
      )}
    </div>
  );
};
