import React from 'react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { ScrollText } from 'lucide-react';

export const SystemLog = () => {
  const { logs } = useRobotStatus();

  return (
    <div className="bg-dark-card rounded-lg border border-dark-border h-full flex flex-col">
      <div className="p-4 border-b border-dark-border">
        <h3 className="text-lg font-bold flex items-center gap-2"><ScrollText size={20} /> System Logs</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-3 text-gray-300">
            <span className="text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.level === 'ERROR' ? 'bg-red-900/50 text-red-400' : log.level === 'WARN' ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
              {log.level || 'INFO'}
            </span>
            <span className="break-all">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && <div className="text-gray-500 text-center mt-10">No logs available</div>}
      </div>
    </div>
  );
};
