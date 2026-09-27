import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from 'lucide-react';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const ManualControl = () => {
  const { robotStatus, sendCommand } = useRobotStatus();
  
  const handleCommand = (cmd: string) => {
    if (robotStatus?.state === 'MANUAL_CONTROL') {
      sendCommand(cmd);
    }
  };

  useKeyboard(handleCommand, robotStatus?.state === 'MANUAL_CONTROL');

  return (
    <div className="p-4 bg-dark-card rounded-lg border border-dark-border flex flex-col items-center">
      <h3 className="text-lg font-bold mb-4">Manual Control</h3>
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button onMouseDown={() => handleCommand('MOVE_FORWARD')} onMouseUp={() => handleCommand('STOP')} className="p-4 bg-slate-700 hover:bg-slate-600 rounded active:bg-slate-500">
          <ArrowUp />
        </button>
        <div />
        <button onMouseDown={() => handleCommand('TURN_LEFT')} onMouseUp={() => handleCommand('STOP')} className="p-4 bg-slate-700 hover:bg-slate-600 rounded active:bg-slate-500">
          <ArrowLeft />
        </button>
        <button onMouseDown={() => handleCommand('MOVE_BACKWARD')} onMouseUp={() => handleCommand('STOP')} className="p-4 bg-slate-700 hover:bg-slate-600 rounded active:bg-slate-500">
          <ArrowDown />
        </button>
        <button onMouseDown={() => handleCommand('TURN_RIGHT')} onMouseUp={() => handleCommand('STOP')} className="p-4 bg-slate-700 hover:bg-slate-600 rounded active:bg-slate-500">
          <ArrowRight />
        </button>
      </div>
      <button onClick={() => handleCommand('STOP')} className="mt-4 w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded flex justify-center items-center gap-2">
        <Square className="fill-black" /> STOP
      </button>
    </div>
  );
};
