import { useState, useRef, useCallback } from 'react';
import { RESOLUTION, ORIGIN_X, ORIGIN_Y } from '../utils/mapRenderer';

export const useMap = () => {
  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState({ x: 50, y: 25 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(Math.max(0.4, s - e.deltaY * 0.001), 4.0));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback((canvasW: number = 900, canvasH: number = 650) => {
    setScale(1.0);
    setOffset({
      x: (canvasW - 400 * 2.0) / 2,
      y: (canvasH - 300 * 2.0) / 2
    });
  }, []);

  const centerOnRobot = useCallback((rx: number, ry: number, canvasW: number = 900, canvasH: number = 650) => {
    const cellPixelSize = 2.0 * scale;
    const gx = (rx - ORIGIN_X) / RESOLUTION;
    const gy = (ry - ORIGIN_Y) / RESOLUTION;
    setOffset({
      x: canvasW / 2 - gx * cellPixelSize,
      y: canvasH / 2 - gy * cellPixelSize
    });
  }, [scale]);

  const zoomIn = useCallback(() => setScale(s => Math.min(4.0, s + 0.25)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(0.4, s - 0.25)), []);

  return {
    scale,
    offset,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView,
    centerOnRobot,
    zoomIn,
    zoomOut
  };
};
