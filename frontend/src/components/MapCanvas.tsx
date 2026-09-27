import { useRef, useEffect, MouseEvent } from 'react';
import { useMap } from '../hooks/useMap';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { drawGrid, drawRobot, drawDestination, drawPath, canvasToWorld } from '../utils/mapRenderer';
import { createDestination } from '../services/api';
import toast from 'react-hot-toast';

export const MapCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scale, offset, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp } = useMap();
  const { mapData, robotStatus, destinations, navigationPath } = useRobotStatus();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (mapData && mapData.occupancy_grid) {
        drawGrid(ctx, mapData.occupancy_grid, mapData.width, mapData.height, scale, offset);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      if (navigationPath) {
         drawPath(ctx, navigationPath, scale, offset);
      }

      if (destinations) {
         destinations.forEach((d: any) => drawDestination(ctx, d.x, d.y, scale, offset));
      }
      
      if (robotStatus) {
        drawRobot(ctx, robotStatus.position.x, robotStatus.position.y, robotStatus.orientation, scale, offset);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mapData, robotStatus, scale, offset, destinations, navigationPath]);

  const onCanvasDoubleClick = async (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldPos = canvasToWorld(cx, cy, scale, offset.x, offset.y);
    
    try {
       await createDestination({ name: `Dest_${Math.floor(Date.now()/1000)}`, x: worldPos.x, y: worldPos.y });
       toast.success('Destination added');
    } catch (err) {
       console.error('Failed to add destination', err);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-dark-bg border border-dark-border rounded-lg">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={onCanvasDoubleClick}
      />
    </div>
  );
};
