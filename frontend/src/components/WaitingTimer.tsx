import React, { useState, useEffect } from 'react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { Timer } from 'lucide-react';

export const WaitingTimer = () => {
  const { robotStatus, demoMode } = useRobotStatus();
  const [timeLeft, setTimeLeft] = useState(0);

  const totalTime = demoMode ? 30 : 300; // 30s or 5m

  useEffect(() => {
    if (robotStatus?.state === 'WAITING_AT_DESTINATION') {
      setTimeLeft(totalTime);
      const timer = setInterval(() => {
        setTimeLeft(t => Math.max(0, t - 1));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setTimeLeft(0);
    }
  }, [robotStatus?.state, totalTime]);

  if (robotStatus?.state !== 'WAITING_AT_DESTINATION') return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  return (
    <div className="p-4 bg-dark-card rounded-lg border border-dark-border mt-4 flex flex-col items-center">
      <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-green-400">
        <Timer size={20} /> Waiting
      </h3>
      
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="transform -rotate-90 w-32 h-32">
          <circle cx="64" cy="64" r={radius} className="stroke-slate-700" strokeWidth="8" fill="none" />
          <circle 
            cx="64" cy="64" r={radius} 
            className="stroke-green-500 transition-all duration-1000" 
            strokeWidth="8" fill="none" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
          />
        </svg>
        <div className="absolute text-2xl font-mono font-bold">
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </div>
      
      <p className="text-gray-400 text-sm mt-4 text-center">
        Waiting for next request...<br/>
        Robot will return home soon.
      </p>
    </div>
  );
};
