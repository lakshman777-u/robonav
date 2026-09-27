import React from 'react';
import { AlertOctagon, Play } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { emergencyStop } from '../services/api';

export const EmergencyStop = () => {
  const { robotStatus, sendCommand } = useRobotStatus();
  
  const isEstop = robotStatus?.state === 'EMERGENCY_STOP';

  const handleEstop = async () => {
    if (robotStatus?.robot_id) {
      await emergencyStop(robotStatus.robot_id);
    }
  };

  const handleResume = () => {
    sendCommand('RESUME');
  };

  return (
    <div className="mt-4">
      {!isEstop ? (
        <button onClick={handleEstop} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-900/50 flex flex-col items-center animate-pulse">
          <AlertOctagon size={32} className="mb-2" />
          EMERGENCY STOP
        </button>
      ) : (
        <button onClick={handleResume} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg flex flex-col items-center">
          <Play size={32} className="mb-2" />
          RESUME OPERATION
        </button>
      )}
    </div>
  );
};
