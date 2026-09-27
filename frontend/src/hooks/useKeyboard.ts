import { useEffect } from 'react';

export const useKeyboard = (onCommand: (cmd: string) => void, enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': onCommand('MOVE_FORWARD'); break;
        case 'ArrowDown': onCommand('MOVE_BACKWARD'); break;
        case 'ArrowLeft': onCommand('TURN_LEFT'); break;
        case 'ArrowRight': onCommand('TURN_RIGHT'); break;
        case ' ': onCommand('STOP'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCommand, enabled]);
};
