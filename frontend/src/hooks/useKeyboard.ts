import { useEffect, useRef } from 'react';

export const useKeyboard = (onCommand: (cmd: string) => void, enabled: boolean) => {
  const activeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const isInputFocused = () => {
      const activeEl = document.activeElement;
      if (!activeEl) return false;
      const tagName = activeEl.tagName.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || (activeEl as HTMLElement).isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused() || e.repeat) return;

      const key = e.key.toLowerCase();
      let cmd: string | null = null;

      if (key === 'w' || e.key === 'ArrowUp') {
        cmd = 'MOVE_FORWARD';
      } else if (key === 's' || e.key === 'ArrowDown') {
        cmd = 'MOVE_BACKWARD';
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        cmd = 'TURN_LEFT';
      } else if (key === 'd' || e.key === 'ArrowRight') {
        cmd = 'TURN_RIGHT';
      } else if (e.key === ' ') {
        cmd = 'STOP';
      }

      if (cmd) {
        activeKeyRef.current = key;
        onCommand(cmd);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const key = e.key.toLowerCase();
      if (
        key === 'w' ||
        key === 's' ||
        key === 'a' ||
        key === 'd' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        activeKeyRef.current = null;
        onCommand('STOP');
      }
    };

    const handleBlur = () => {
      if (activeKeyRef.current) {
        activeKeyRef.current = null;
        onCommand('STOP');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onCommand, enabled]);
};

