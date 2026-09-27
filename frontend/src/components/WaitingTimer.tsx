import { useState, useEffect } from 'react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { Timer, Zap } from 'lucide-react';

export const WaitingTimer = () => {
  const { robotStatus, demoMode } = useRobotStatus();
  const [timeLeft, setTimeLeft] = useState(0);

  const totalTime = demoMode ? 30 : 300; // 30s in demo or 5m normal

  useEffect(() => {
    if (robotStatus?.state === 'WAITING_AT_DESTINATION') {
      setTimeLeft(totalTime);
      const timer = setInterval(() => {
        setTimeLeft((t) => Math.max(0, t - 1));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setTimeLeft(0);
    }
  }, [robotStatus?.state, totalTime]);

  if (robotStatus?.state !== 'WAITING_AT_DESTINATION') return null;

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-green-500/40 shadow-2xl relative overflow-hidden flex flex-col items-center space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
        <h3 className="text-sm font-bold text-green-400 flex items-center gap-2">
          <Timer size={16} /> Destination Waiting Timer
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">
          {demoMode ? '10x ACCELERATED' : '5-MIN STANDBY'}
        </span>
      </div>

      {/* Circular Countdown Dial */}
      <div className="relative w-36 h-36 flex items-center justify-center relative z-10">
        <svg className="transform -rotate-90 w-36 h-36">
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-green-500 transition-all duration-1000"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 8px #10b981)' }}
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-mono font-black text-white tracking-tight">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest text-green-400 font-bold">
            REMAINING
          </span>
        </div>
      </div>

      <p className="text-gray-400 text-xs text-center font-mono relative z-10 leading-relaxed">
        Robot is standing by for the user.<br />
        Will automatically engage auto-docking return home.
      </p>
    </div>
  );
};
