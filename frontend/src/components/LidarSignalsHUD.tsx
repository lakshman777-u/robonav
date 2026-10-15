import { useRef, useEffect, useState } from 'react';
import { 
  Radar, Activity, ZoomIn, ZoomOut, AlertTriangle, 
  CheckCircle2, Radio, HardDrive, Cpu, Compass, RefreshCw, Layers
} from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { startLidar } from '../services/api';
import toast from 'react-hot-toast';

interface LidarSignalsHUDProps {
  initialRange?: number;
  compact?: boolean;
}

export const LidarSignalsHUD = ({ initialRange = 6.0, compact = false }: LidarSignalsHUDProps) => {
  const { sensorData, robotStatus } = useRobotStatus();
  const { config } = useCarTrim();

  const [viewMode, setViewMode] = useState<'polar' | 'waveform' | 'split'>('split');
  const [rangeScale, setRangeScale] = useState(initialRange);
  const [restarting, setRestarting] = useState(false);

  const polarCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const sweepAngleRef = useRef(0);

  // Extract LiDAR rays and metrics from sensorData or robotStatus fallback
  const lidar = sensorData?.lidar;
  const bridge = robotStatus?.bridge || sensorData?.bridge;
  const rays = lidar?.rays || (robotStatus as any)?.lidar?.rays || [];
  const scanHz = lidar?.scan_rate ?? bridge?.scan_hz ?? (robotStatus as any)?.lidar?.hz ?? 9.3;
  const isStreaming = Boolean(
    (lidar?.active || bridge?.active || robotStatus?.hardware?.lidar === 'ACTIVE') &&
    (rays.length > 0 || (bridge?.scans_published || 0) > 0)
  );

  const port = bridge?.sender_ip?.includes('USB') 
    ? '/dev/ttyUSB0' 
    : (bridge?.sender_ip !== 'none' && bridge?.sender_ip ? bridge.sender_ip : '/dev/ttyUSB0');

  const packetsRx = bridge?.udp_packets_rx ?? lidar?.packets ?? 0;
  const bytesRx = bridge?.udp_bytes_rx ?? bridge?.esp32_lidar_rx_bytes ?? 0;
  const mbRx = (bytesRx / (1024 * 1024)).toFixed(2);

  // Compute closest obstacle and quadrant clearances
  let closestDist = Infinity;
  let closestAngle = 0;
  let frontMin = Infinity;
  let rightMin = Infinity;
  let rearMin = Infinity;
  let leftMin = Infinity;

  rays.forEach((r: any) => {
    if (r.distance > 0.12 && r.distance < 8.0) {
      if (r.distance < closestDist) {
        closestDist = r.distance;
        closestAngle = Math.round(r.angle > 6.29 ? r.angle : (r.angle * 180) / Math.PI);
      }
      const deg = ((r.angle % 360) + 360) % 360;
      if (deg >= 315 || deg < 45) {
        if (r.distance < frontMin) frontMin = r.distance;
      } else if (deg >= 45 && deg < 135) {
        if (r.distance < rightMin) rightMin = r.distance;
      } else if (deg >= 135 && deg < 225) {
        if (r.distance < rearMin) rearMin = r.distance;
      } else {
        if (r.distance < leftMin) leftMin = r.distance;
      }
    }
  });

  const handleRestartDriver = async () => {
    setRestarting(true);
    try {
      await startLidar(false);
      toast.success('YDLIDAR X2 driver initialized! Streaming live signals.');
    } catch (err: any) {
      toast.error('Driver restart: ' + (err?.message || 'Using automatic stream'));
    } finally {
      setTimeout(() => setRestarting(false), 1200);
    }
  };

  // State ref for smooth canvas render animation
  const stateRef = useRef({ rays, isStreaming, rangeScale, scanHz });
  useEffect(() => {
    stateRef.current = { rays, isStreaming, rangeScale, scanHz };
  });

  // 1. Polar Radar Renderer
  useEffect(() => {
    let animId: number;
    const renderPolar = () => {
      const canvas = polarCanvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderPolar);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { rays: curRays, isStreaming: curActive, rangeScale: curScale, scanHz: curHz } = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy) - 20;

      ctx.clearRect(0, 0, w, h);

      // Radar background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // Radial gradient background
      const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, maxR);
      grad.addColorStop(0, '#041d2d');
      grad.addColorStop(0.7, '#020e1a');
      grad.addColorStop(1, '#02060d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      // Range rings
      const rings = [1.0, 2.0, 3.0, 4.0, 6.0, 8.0].filter(r => r <= curScale);
      rings.forEach(r => {
        const ringR = (r / curScale) * maxR;
        ctx.strokeStyle = r === curScale ? 'rgba(6, 182, 212, 0.45)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = r === curScale ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '9px monospace';
        ctx.fillText(`${r}m`, cx + 4, cy - ringR + 11);
      });

      // Crosshairs & Angles
      for (let deg = 0; deg < 360; deg += 45) {
        const rad = (deg * Math.PI) / 180;
        ctx.strokeStyle = deg % 90 === 0 ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad));
        ctx.stroke();
      }

      // Compass labels
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0° (FWD)', cx, cy - maxR - 4);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText('180°', cx, cy + maxR + 12);
      ctx.textAlign = 'left';
      ctx.fillText('90°', cx + maxR + 4, cy + 3);
      ctx.textAlign = 'right';
      ctx.fillText('270°', cx - maxR - 4, cy + 3);

      // Rotating Radar Sweep Beam
      if (curActive) {
        sweepAngleRef.current = (sweepAngleRef.current + (curHz * 0.035)) % (Math.PI * 2);
        const sweepAngle = sweepAngleRef.current;

        const trail = 0.35;
        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
        sweepGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, sweepAngle - trail, sweepAngle, false);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxR * Math.cos(sweepAngle), cy + maxR * Math.sin(sweepAngle));
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw 360° Wall Contours
      if (curRays && curRays.length > 0) {
        interface PolarPoint {
          angleDeg: number;
          dist: number;
          px: number;
          py: number;
        }

        const validPts: PolarPoint[] = [];
        curRays.forEach((r: any) => {
          if (r.distance < 0.12 || r.distance > 8.0) return;
          const angleDeg = ((r.angle % 360) + 360) % 360;
          const rad = ((angleDeg - 90) * Math.PI) / 180;
          const clamped = Math.min(r.distance, curScale);
          const px = cx + (clamped / curScale) * maxR * Math.cos(rad);
          const py = cy + (clamped / curScale) * maxR * Math.sin(rad);
          validPts.push({ angleDeg, dist: r.distance, px, py });
        });

        if (validPts.length >= 4) {
          validPts.sort((a, b) => a.angleDeg - b.angleDeg);

          // Floor fill
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(validPts[0].px, validPts[0].py);
          for (let i = 1; i < validPts.length; i++) {
            ctx.lineTo(validPts[i].px, validPts[i].py);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
          ctx.fill();

          // Continuous wall strokes
          for (let i = 1; i < validPts.length; i++) {
            const p1 = validPts[i - 1];
            const p2 = validPts[i];
            const dAngle = p2.angleDeg - p1.angleDeg;
            const dDist = Math.abs(p2.dist - p1.dist);
            if (dAngle <= 5.0 && dDist <= 0.45) {
              ctx.strokeStyle = p2.dist < 0.5 ? '#ef4444' : '#00f0ff';
              ctx.lineWidth = 2.0;
              ctx.shadowColor = ctx.strokeStyle;
              ctx.shadowBlur = 6;
              ctx.beginPath();
              ctx.moveTo(p1.px, p1.py);
              ctx.lineTo(p2.px, p2.py);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }

      // Center Robot Puck
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Heading indicator pointer (pointing UP / 0°)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy - 14);
      ctx.stroke();

      animId = requestAnimationFrame(renderPolar);
    };

    renderPolar();
    return () => cancelAnimationFrame(animId);
  }, []);

  // 2. Linear Waveform / Oscilloscope Renderer
  useEffect(() => {
    let animId: number;
    const renderWaveform = () => {
      const canvas = waveformCanvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderWaveform);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { rays: curRays, isStreaming: curActive, rangeScale: curScale, scanHz: curHz } = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const padL = 36;
      const padR = 16;
      const padT = 16;
      const padB = 26;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // Grid background pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      // Horizontal range grid lines (0m, 2m, 4m, 6m, 8m)
      const rangeSteps = [0.0, 2.0, 4.0, 6.0, 8.0].filter(r => r <= curScale);
      rangeSteps.forEach(r => {
        const y = padT + plotH - (r / curScale) * plotH;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${r.toFixed(0)}m`, padL - 4, y + 3);
      });

      // Vertical angle grid lines (0°, 90°, 180°, 270°, 360°)
      const angles = [
        { deg: 0, label: '0° FWD' },
        { deg: 90, label: '90° R' },
        { deg: 180, label: '180° RR' },
        { deg: 270, label: '270° L' },
        { deg: 360, label: '360°' }
      ];
      angles.forEach(a => {
        const x = padL + (a.deg / 360) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(a.label, x, h - 8);
      });

      // Safety threshold line (0.50m)
      const stopY = padT + plotH - (0.50 / curScale) * plotH;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, stopY);
      ctx.lineTo(padL + plotW, stopY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.font = '8px monospace';
      ctx.fillText('0.5m CRITICAL STOP', padL + 45, stopY - 3);

      // Plot Signal Envelope Curve
      if (curRays && curRays.length > 0) {
        const sorted = [...curRays].sort((a: any, b: any) => a.angle - b.angle);

        ctx.save();
        ctx.beginPath();
        let firstDrawn = false;

        sorted.forEach((r: any) => {
          if (r.distance < 0.08) return;
          const deg = ((r.angle % 360) + 360) % 360;
          const x = padL + (deg / 360) * plotW;
          const dClamped = Math.min(r.distance, curScale);
          const y = padT + plotH - (dClamped / curScale) * plotH;

          if (!firstDrawn) {
            ctx.moveTo(x, y);
            firstDrawn = true;
          } else {
            ctx.lineTo(x, y);
          }
        });

        // Area under waveform
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Gradient under curve
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (first && last) {
          const xFirst = padL + (first.angle / 360) * plotW;
          const xLast = padL + (last.angle / 360) * plotW;
          ctx.lineTo(xLast, padT + plotH);
          ctx.lineTo(xFirst, padT + plotH);
          ctx.closePath();
          const waveGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
          waveGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
          waveGrad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
          ctx.fillStyle = waveGrad;
          ctx.fill();
        }
        ctx.restore();

        // Highlight closest peak
        if (closestDist < Infinity) {
          const peakX = padL + (closestAngle / 360) * plotW;
          const peakY = padT + plotH - (Math.min(closestDist, curScale) / curScale) * plotH;

          ctx.fillStyle = closestDist < 0.5 ? '#ef4444' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`${closestDist.toFixed(2)}m`, peakX, Math.max(padT + 10, peakY - 8));
        }
      }

      // Real-time Sweep vertical cursor
      if (curActive) {
        const sweepDeg = ((sweepAngleRef.current * 180) / Math.PI) % 360;
        const curX = padL + (sweepDeg / 360) * plotW;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(curX, padT);
        ctx.lineTo(curX, padT + plotH);
        ctx.stroke();
      }

      animId = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-4 font-mono">
      {/* Background carbon */}
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
            <Radar size={18} className={isStreaming ? 'animate-spin-slow' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                LiDAR Signals & Hardware Stream
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${
                isStreaming 
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300' 
                  : 'bg-red-950/80 border-red-500/50 text-red-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-cyan-400 animate-ping' : 'bg-red-500'}`} />
                {isStreaming ? `STREAMING (${scanHz.toFixed(1)} Hz)` : 'INACTIVE'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              YDLIDAR X2 USB-Serial • 360° Optical Triangulation • ROS 2 /scan
            </p>
          </div>
        </div>

        {/* View Switchers & Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Tabs */}
          <div className="flex bg-slate-900/90 p-0.5 rounded-xl border border-white/10 text-[10px]">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'split' ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Dual Scope
            </button>
            <button
              onClick={() => setViewMode('polar')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'polar' ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Polar Radar
            </button>
            <button
              onClick={() => setViewMode('waveform')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'waveform' ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Waveform
            </button>
          </div>

          {/* Zoom scale */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-xl border border-white/10 text-[10px]">
            <button
              onClick={() => setRangeScale(prev => Math.max(3.0, prev - 1.0))}
              className="p-0.5 hover:text-cyan-400 text-gray-400 transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
            <span className="font-bold text-cyan-300 px-1">{rangeScale.toFixed(0)}m</span>
            <button
              onClick={() => setRangeScale(prev => Math.min(8.0, prev + 1.0))}
              className="p-0.5 hover:text-cyan-400 text-gray-400 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
          </div>

          {/* Restart Driver Button */}
          <button
            onClick={handleRestartDriver}
            disabled={restarting}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-gray-200 border border-white/10 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 shadow"
            title="Restart YDLIDAR Hardware Driver"
          >
            <RefreshCw size={11} className={restarting ? 'animate-spin text-cyan-400' : ''} />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* Main Visual Display (Polar, Waveform, or Split) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
        {/* Left: 360° Polar Radar Scanner */}
        {(viewMode === 'polar' || viewMode === 'split') && (
          <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/70 border border-white/5 relative ${
            viewMode === 'polar' ? 'lg:col-span-2' : ''
          }`}>
            <div className="w-full flex justify-between items-center text-[10px] text-gray-400 pb-1">
              <span className="flex items-center gap-1 font-bold text-cyan-300">
                <Radar size={12} /> 360° POLAR RADAR SCANNER
              </span>
              <span>{rays.length} ACTIVE RAYS</span>
            </div>
            <canvas
              ref={polarCanvasRef}
              width={viewMode === 'polar' ? 440 : 340}
              height={viewMode === 'polar' ? 340 : 300}
              className="rounded-full shadow-inner border border-cyan-500/20 max-w-full"
            />
          </div>
        )}

        {/* Right: 360° Optical Distance Waveform Oscilloscope */}
        {(viewMode === 'waveform' || viewMode === 'split') && (
          <div className={`flex flex-col justify-center p-3 rounded-xl bg-slate-950/70 border border-white/5 relative ${
            viewMode === 'waveform' ? 'lg:col-span-2' : ''
          }`}>
            <div className="w-full flex justify-between items-center text-[10px] text-gray-400 pb-1">
              <span className="flex items-center gap-1 font-bold text-cyan-300">
                <Activity size={12} /> SIGNAL WAVEFORM SPECTRUM (DISTANCE VS BEAM ANGLE)
              </span>
              <span>FOV: 0° - 360°</span>
            </div>
            <canvas
              ref={waveformCanvasRef}
              width={viewMode === 'waveform' ? 700 : 380}
              height={viewMode === 'waveform' ? 260 : 300}
              className="rounded-xl border border-cyan-500/20 w-full"
            />
          </div>
        )}
      </div>

      {/* Quadrant Clearances Bar */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Front */}
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
          frontMin < 0.5 ? 'bg-red-950/50 border-red-500/50 text-red-300' :
          frontMin < 1.2 ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' :
          'bg-slate-900/60 border-white/10 text-cyan-300'
        }`}>
          <div className="text-[9px] text-gray-400 uppercase font-bold flex items-center justify-between">
            <span>FRONT CLEARANCE</span>
            <span>0°</span>
          </div>
          <div className="text-base font-black mt-1">
            {frontMin < Infinity ? `${frontMin.toFixed(2)} m` : '> 8.0 m'}
          </div>
          <div className="text-[9px] mt-0.5">
            {frontMin < 0.35 ? '⚠ STOP HAZARD' : frontMin < 1.0 ? 'CAUTION' : 'CLEAR'}
          </div>
        </div>

        {/* Right */}
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
          rightMin < 0.5 ? 'bg-red-950/50 border-red-500/50 text-red-300' :
          rightMin < 1.2 ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' :
          'bg-slate-900/60 border-white/10 text-cyan-300'
        }`}>
          <div className="text-[9px] text-gray-400 uppercase font-bold flex items-center justify-between">
            <span>RIGHT CLEARANCE</span>
            <span>90°</span>
          </div>
          <div className="text-base font-black mt-1">
            {rightMin < Infinity ? `${rightMin.toFixed(2)} m` : '> 8.0 m'}
          </div>
          <div className="text-[9px] mt-0.5">
            {rightMin < 0.35 ? '⚠ STOP HAZARD' : rightMin < 1.0 ? 'CAUTION' : 'CLEAR'}
          </div>
        </div>

        {/* Rear */}
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
          rearMin < 0.5 ? 'bg-red-950/50 border-red-500/50 text-red-300' :
          rearMin < 1.2 ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' :
          'bg-slate-900/60 border-white/10 text-cyan-300'
        }`}>
          <div className="text-[9px] text-gray-400 uppercase font-bold flex items-center justify-between">
            <span>REAR CLEARANCE</span>
            <span>180°</span>
          </div>
          <div className="text-base font-black mt-1">
            {rearMin < Infinity ? `${rearMin.toFixed(2)} m` : '> 8.0 m'}
          </div>
          <div className="text-[9px] mt-0.5">
            {rearMin < 0.35 ? '⚠ STOP HAZARD' : rearMin < 1.0 ? 'CAUTION' : 'CLEAR'}
          </div>
        </div>

        {/* Left */}
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
          leftMin < 0.5 ? 'bg-red-950/50 border-red-500/50 text-red-300' :
          leftMin < 1.2 ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' :
          'bg-slate-900/60 border-white/10 text-cyan-300'
        }`}>
          <div className="text-[9px] text-gray-400 uppercase font-bold flex items-center justify-between">
            <span>LEFT CLEARANCE</span>
            <span>270°</span>
          </div>
          <div className="text-base font-black mt-1">
            {leftMin < Infinity ? `${leftMin.toFixed(2)} m` : '> 8.0 m'}
          </div>
          <div className="text-[9px] mt-0.5">
            {leftMin < 0.35 ? '⚠ STOP HAZARD' : leftMin < 1.0 ? 'CAUTION' : 'CLEAR'}
          </div>
        </div>
      </div>

      {/* Comprehensive Telemetry Metrics Strip */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[10px]">
        <div className="bg-slate-950/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400">HARDWARE PORT</div>
          <div className="font-bold text-white truncate">{port}</div>
        </div>

        <div className="bg-slate-950/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400">SCAN FREQUENCY</div>
          <div className="font-bold text-cyan-400">{scanHz.toFixed(1)} Hz</div>
        </div>

        <div className="bg-slate-950/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400">BEAM RESOLUTION</div>
          <div className="font-bold text-white">360° (1° / Ray)</div>
        </div>

        <div className="bg-slate-950/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400">ROS 2 TOPIC</div>
          <div className="font-bold text-emerald-400">/scan (Active)</div>
        </div>

        <div className="bg-slate-950/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400">PACKETS RECEIVED</div>
          <div className="font-bold text-white">{packetsRx.toLocaleString()} pkts</div>
        </div>

        <div className="bg-slate-950/80 p-2 rounded-xl border border-white/5 space-y-0.5">
          <div className="text-gray-400">CLOSEST HAZARD</div>
          <div className={`font-bold ${closestDist < 0.5 ? 'text-red-400' : 'text-cyan-300'}`}>
            {closestDist < Infinity ? `${closestDist.toFixed(2)}m @ ${closestAngle}°` : 'None in range'}
          </div>
        </div>
      </div>
    </div>
  );
};
