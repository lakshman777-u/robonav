import { useRef, useEffect, useState } from 'react';
import { Radar, Disc, ZoomIn, ZoomOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';

interface LidarPolarViewProps {
  maxRangeMeters?: number;
}

export const LidarPolarView = ({ maxRangeMeters = 6.0 }: LidarPolarViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sensorData, robotStatus } = useRobotStatus();
  const [rangeScale, setRangeScale] = useState(maxRangeMeters); // 4m, 6m, 8m
  const sweepAngleRef = useRef(0);

  const lidarData = sensorData?.lidar;
  const rays = lidarData?.rays || [];
  const isLidarActive = Boolean(lidarData?.active && rays.length > 0);
  const scanHz = lidarData?.scan_rate ?? robotStatus?.bridge?.scan_hz ?? 14.0;
  const port = robotStatus?.bridge?.sender_ip?.includes('USB') 
    ? '/dev/ttyUSB0' 
    : (robotStatus?.bridge?.sender_ip !== 'none' ? robotStatus?.bridge?.sender_ip : '/dev/ttyUSB0');

  // Find closest point
  let closestDist = Infinity;
  let closestAngle = 0;
  rays.forEach(r => {
    if (r.distance > 0.10 && r.distance < closestDist) {
      closestDist = r.distance;
      closestAngle = Math.round(r.angle > 6.29 ? r.angle : (r.angle * 180) / Math.PI);
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.min(cx, cy) - 24;

      ctx.clearRect(0, 0, width, height);

      // 1. Radar Background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      // Subtle gradient circle
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxRadius);
      grad.addColorStop(0, '#041d2d');
      grad.addColorStop(1, '#020b14');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Concentric Range Rings
      const ringSteps = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0].filter(r => r <= rangeScale);
      ringSteps.forEach(r => {
        const ringRadius = (r / rangeScale) * maxRadius;
        ctx.strokeStyle = r === rangeScale ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = r === rangeScale ? 1.5 : 1;
        ctx.setLineDash(r % 2 === 0 ? [] : [3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ring distance label
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '9px monospace';
        ctx.fillText(`${r}m`, cx + 4, cy - ringRadius + 11);
      });

      // 3. Radial Crosshair Lines (every 45 degrees)
      for (let deg = 0; deg < 360; deg += 45) {
        const rad = (deg * Math.PI) / 180;
        ctx.strokeStyle = deg % 90 === 0 ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = deg % 90 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxRadius * Math.cos(rad), cy + maxRadius * Math.sin(rad));
        ctx.stroke();

        // Direction labels
        if (deg === 270) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('0° (FWD)', cx, cy - maxRadius - 6);
        } else if (deg === 90) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('180°', cx, cy + maxRadius + 14);
        } else if (deg === 0) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('90°', cx + maxRadius + 4, cy + 3);
        } else if (deg === 180) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'right';
          ctx.fillText('270°', cx - maxRadius - 4, cy + 3);
        }
      }

      // 4. Rotating Radar Sweep Beam
      if (isLidarActive) {
        sweepAngleRef.current = (sweepAngleRef.current + (scanHz * 0.035)) % (Math.PI * 2);
        const sweepAngle = sweepAngleRef.current;

        // Sweep cone trail
        const trailAngle = 0.35; // radians
        const coneGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        coneGrad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
        coneGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, sweepAngle - trailAngle, sweepAngle, false);
        ctx.closePath();
        ctx.fill();

        // Leading edge line
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxRadius * Math.cos(sweepAngle), cy + maxRadius * Math.sin(sweepAngle));
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 5. Draw 360° Room Wall Contours & Obstacle Nodes
      if (rays && rays.length > 0) {
        interface PolarPoint {
          angleDeg: number;
          dist: number;
          px: number;
          py: number;
          color: string;
          glow: string;
        }

        const validPolar: PolarPoint[] = [];

        rays.forEach(r => {
          if (r.distance < 0.12 || r.distance > 8.0) return;
          // YDLIDAR: 0° is forward (UP on screen), clockwise
          const angleDeg = ((r.angle % 360) + 360) % 360;
          const rad = ((angleDeg - 90) * Math.PI) / 180;
          const distClamped = Math.min(r.distance, rangeScale);
          const px = cx + (distClamped / rangeScale) * maxRadius * Math.cos(rad);
          const py = cy + (distClamped / rangeScale) * maxRadius * Math.sin(rad);

          let color = '#06b6d4';
          let glow = 'rgba(6, 182, 212, 0.8)';
          if (r.distance < 0.45) {
            color = '#ef4444';
            glow = 'rgba(239, 68, 68, 0.9)';
          } else if (r.distance < 1.0) {
            color = '#f59e0b';
            glow = 'rgba(245, 158, 11, 0.8)';
          }

          validPolar.push({ angleDeg, dist: r.distance, px, py, color, glow });
        });

        if (validPolar.length >= 4) {
          // Sort rays by angle
          validPolar.sort((a, b) => a.angleDeg - b.angleDeg);

          // 5a. Fill interior room radar floor
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(validPolar[0].px, validPolar[0].py);
          for (let i = 1; i < validPolar.length; i++) {
            ctx.lineTo(validPolar[i].px, validPolar[i].py);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
          ctx.fill();
          ctx.restore();

          // 5b. Partition into continuous wall segments
          const wallChains: PolarPoint[][] = [];
          let currentChain: PolarPoint[] = [validPolar[0]];

          for (let i = 1; i < validPolar.length; i++) {
            const prev = validPolar[i - 1];
            const curr = validPolar[i];
            const angleDiff = curr.angleDeg - prev.angleDeg;
            const distDiff = Math.abs(curr.dist - prev.dist);

            if (angleDiff <= 4.0 && distDiff <= 0.45) {
              currentChain.push(curr);
            } else {
              if (currentChain.length >= 2) wallChains.push(currentChain);
              currentChain = [curr];
            }
          }

          // Wrap-around check
          if (currentChain.length >= 2) {
            const first = validPolar[0];
            const last = currentChain[currentChain.length - 1];
            const wrapAngle = (first.angleDeg + 360) - last.angleDeg;
            const wrapDist = Math.abs(first.dist - last.dist);
            if (wrapAngle <= 4.0 && wrapDist <= 0.45 && wallChains.length > 0) {
              wallChains[0] = [...currentChain, ...wallChains[0]];
            } else {
              wallChains.push(currentChain);
            }
          }

          // 5c. Draw continuous glowing walls
          wallChains.forEach(chain => {
            if (chain.length < 2) return;
            ctx.save();
            ctx.strokeStyle = chain.some(p => p.dist < 0.45) ? '#ef4444' : '#00f0ff';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(chain[0].px, chain[0].py);
            for (let i = 1; i < chain.length; i++) {
              ctx.lineTo(chain[i].px, chain[i].py);
            }
            ctx.stroke();

            // Inner core stroke
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            ctx.stroke();
            ctx.restore();
          });

          // 5d. Draw obstacle reflection nodes
          validPolar.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.px, p.py, p.dist < 0.45 ? 2.5 : 1.5, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      // 6. Robot Center Marker
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Heading indicator (pointer UP)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy - 14);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [rays, isLidarActive, rangeScale, scanHz]);

  return (
    <div className="glass-panel p-4 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center">
      {/* Background carbon */}
      <div className="absolute inset-0 bg-carbon-pattern opacity-25 pointer-events-none" />

      {/* Header Bar */}
      <div className="w-full flex justify-between items-center pb-2 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <Radar size={16} className={isLidarActive ? 'text-cyan-400 animate-spin-slow' : 'text-gray-400'} />
          <h4 className="text-xs font-black uppercase tracking-wider text-white">
            360° LiDAR Polar Radar
          </h4>
        </div>

        {/* Range Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-900/80 px-1.5 py-0.5 rounded-lg border border-white/10">
          <button
            onClick={() => setRangeScale(prev => Math.max(3.0, prev - 1.0))}
            className="p-1 hover:text-cyan-400 text-gray-400 transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
          <span className="text-[10px] font-mono text-cyan-300 font-bold px-1">
            {rangeScale.toFixed(0)}m
          </span>
          <button
            onClick={() => setRangeScale(prev => Math.min(8.0, prev + 1.0))}
            className="p-1 hover:text-cyan-400 text-gray-400 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
        </div>
      </div>

      {/* Polar Canvas */}
      <div className="relative my-2 z-10">
        <canvas
          ref={canvasRef}
          width={340}
          height={340}
          className="rounded-full shadow-inner border border-cyan-500/20"
        />

        {/* Status Badge in Center Top */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold flex items-center gap-1 border backdrop-blur-md ${
            isLidarActive
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-900/80 border-white/10 text-gray-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLidarActive ? 'bg-cyan-400 animate-ping' : 'bg-gray-500'}`} />
            {isLidarActive ? `STREAMING (${scanHz.toFixed(1)} HZ)` : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Bottom Telemetry HUD */}
      <div className="w-full grid grid-cols-2 gap-2 text-[10px] font-mono relative z-10 pt-2 border-t border-white/10">
        <div className="bg-slate-900/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400 text-[9px] flex items-center gap-1">
            <Disc size={11} className="text-cyan-400" /> HARDWARE PORT
          </div>
          <div className="font-bold text-white truncate">{port}</div>
          <div className="text-gray-400 text-[9px] pt-1">ACTIVE SCAN BINS</div>
          <div className="font-bold text-cyan-400">{rays.length > 0 ? `${rays.length} Rays (360°)` : '0 Bins'}</div>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400 text-[9px] flex items-center gap-1">
            {closestDist < 0.5 ? (
              <AlertCircle size={11} className="text-red-400 animate-pulse" />
            ) : (
              <CheckCircle2 size={11} className="text-green-400" />
            )}
            CLOSEST OBSTACLE
          </div>
          <div className={`font-bold ${closestDist < 0.5 ? 'text-red-400 font-black' : 'text-white'}`}>
            {closestDist < Infinity ? `${closestDist.toFixed(2)} m @ ${closestAngle}°` : 'None in range'}
          </div>
          <div className="text-gray-400 text-[9px] pt-1">SAFETY ZONE</div>
          <div className={`font-bold ${closestDist < 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
            {closestDist < 0.35 ? 'CRITICAL STOP' : closestDist < 1.0 ? 'CAUTION' : 'CLEAR PATH'}
          </div>
        </div>
      </div>
    </div>
  );
};
