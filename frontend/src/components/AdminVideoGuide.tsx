import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Video, Shield, Scan, Gamepad2, MapPin, UploadCloud, CheckCircle2 } from 'lucide-react';

export const AdminVideoGuide = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 45 seconds
  const [totalDuration] = useState(45);
  const [stepCaption, setStepCaption] = useState('Step 1: Manual Robot Control via Keyboard & D-Pad');
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'interactive' | 'custom'>('interactive');

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlaying && mode === 'interactive') {
        setCurrentTime((prev) => {
          const next = prev + dt * playbackSpeed;
          return next >= totalDuration ? 0 : next;
        });
      }

      renderCanvas();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackSpeed, mode, currentTime]);

  // Captions based on timeline
  useEffect(() => {
    const t = currentTime;
    if (t < 10) {
      setStepCaption('Phase 1: Manual Control - Driving robot using Arrow Keys / D-Pad with Emergency Stop');
    } else if (t < 22) {
      setStepCaption('Phase 2: Progressive SLAM Mapping - LiDAR scans room as robot explores (Coverage: 85%)');
    } else if (t < 30) {
      setStepCaption('Phase 3: Stop Mapping & Save/Upload - Compresses 2D Occupancy Grid to Database');
    } else {
      setStepCaption('Phase 4: Place 4 Destinations on Map - Reception, Meeting Room, Room A, Room B');
    }
  }, [currentTime]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = currentTime;

    // Dark sleek gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Left Pane: Map and Robot Canvas
    const mapW = w * 0.58;
    const mapH = h - 50;

    ctx.save();
    ctx.beginPath();
    ctx.rect(15, 15, mapW, mapH);
    ctx.clip();

    // Floor base
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(15, 15, mapW, mapH);

    // SLAM exploration simulation:
    // If t is in phase 2 (mapping), progressive reveal of cells
    const isMapping = t >= 10 && t < 30;
    const mapProgress = t < 10 ? 0.3 : Math.min(1.0, 0.3 + ((t - 10) / 16) * 0.7);

    // Explored floor mask (light cyan tint)
    const exploreRadius = 60 + mapProgress * 280;
    const expGrad = ctx.createRadialGradient(mapW * 0.45, mapH * 0.5, 20, mapW * 0.45, mapH * 0.5, exploreRadius);
    expGrad.addColorStop(0, '#172554');
    expGrad.addColorStop(0.7, '#1e293b');
    expGrad.addColorStop(1, '#0b1120');
    ctx.fillStyle = expGrad;
    ctx.fillRect(15, 15, mapW, mapH);

    // Grid dots
    ctx.fillStyle = '#334155';
    for (let gx = 30; gx < mapW; gx += 25) {
      for (let gy = 30; gy < mapH; gy += 25) {
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    // Outer & Room Walls
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(30, 30, mapW - 30, mapH - 30);

    // Interior walls
    ctx.beginPath();
    ctx.moveTo(30, 110);
    ctx.lineTo(130, 110);
    ctx.lineTo(130, 80);

    ctx.moveTo(30, 190);
    ctx.lineTo(130, 190);
    ctx.lineTo(130, 220);

    ctx.moveTo(mapW, 190);
    ctx.lineTo(mapW - 120, 190);
    ctx.lineTo(mapW - 120, 220);

    ctx.strokeRect(170, 90, 90, 80);
    ctx.stroke();

    // Clear doorway
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(195, 88, 30, 6);

    // Robot path during manual drive or mapping
    let rx = 70;
    let ry = 70;
    let rAngle = 0;

    if (t < 10) {
      // Manual control: driving around lobby
      const phase = (t / 10) * Math.PI * 2;
      rx = 80 + Math.sin(phase) * 35;
      ry = 80 + Math.cos(phase) * 25;
      rAngle = phase + Math.PI / 2;
    } else if (t < 25) {
      // SLAM mapping path: sweeps across corridors
      const p = (t - 10) / 15;
      rx = 70 + p * (mapW - 140);
      ry = 150 + Math.sin(p * Math.PI * 3) * 40;
      rAngle = Math.atan2(Math.cos(p * Math.PI * 3) * 40, (mapW - 140) / 15);
    } else {
      // Settled in central hub
      rx = 180;
      ry = 220;
      rAngle = -Math.PI / 2;
    }

    // LiDAR Scanning Rays (Phase 2 & 1)
    const rays = isMapping ? 32 : 16;
    for (let i = 0; i < rays; i++) {
      const angle = (t * 5) + (i * (Math.PI * 2 / rays));
      const dist = 45 + Math.sin(angle * 2.5) * 20;
      ctx.strokeStyle = isMapping ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(angle) * dist, ry + Math.sin(angle) * dist);
      ctx.stroke();
    }

    // Phase 4: Drawing the 4 destinations being placed by Admin
    if (t >= 30) {
      const dests = [
        { name: '1. Reception', x: 70, y: 70, color: '#3b82f6', showAt: 30 },
        { name: '2. Meeting Room', x: 215, y: 130, color: '#8b5cf6', showAt: 33 },
        { name: '3. Room A', x: 70, y: 250, color: '#10b981', showAt: 36 },
        { name: '4. Room B', x: mapW - 60, y: 250, color: '#f59e0b', showAt: 39 }
      ];

      dests.forEach((d) => {
        if (t >= d.showAt) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, 11, 0, Math.PI * 2);
          ctx.fillStyle = d.color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Pulsing placement ring
          ctx.beginPath();
          ctx.arc(d.x, d.y, 18 + Math.sin(t * 8) * 4, 0, Math.PI * 2);
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(d.name, d.x - 20, d.y - 16);
        }
      });
    }

    // Draw Robot
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(rAngle);

    // Wheels
    ctx.fillStyle = '#334155';
    ctx.fillRect(-11, -9, 6, 4);
    ctx.fillRect(5, -9, 6, 4);
    ctx.fillRect(-11, 5, 6, 4);
    ctx.fillRect(5, 5, 6, 4);

    // Robot body
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 16, 4);
    ctx.fill();

    // Direction marker
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore(); // End map clip

    // Right Pane: Admin Control Panels
    const uiX = mapW + 25;
    const uiW = w - uiX - 15;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(uiX, 15, uiW, mapH, 8);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (t < 10) {
      // UI State 1: Manual Controls
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('1. Manual Robot Control', uiX + 15, 38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Drive via Keyboard Arrow Keys or D-Pad:', uiX + 15, 54);

      // D-Pad widget mock
      const cx = uiX + uiW / 2;
      const cy = 135;

      const drawKey = (kx: number, ky: number, label: string, active: boolean) => {
        ctx.fillStyle = active ? '#2563eb' : '#0f172a';
        ctx.beginPath();
        ctx.roundRect(kx - 18, ky - 18, 36, 36, 6);
        ctx.fill();
        ctx.strokeStyle = active ? '#60a5fa' : '#334155';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(label, kx - 5, ky + 4);
      };

      const keyForward = Math.floor(t * 3) % 4 === 0;
      const keyLeft = Math.floor(t * 3) % 4 === 1;

      drawKey(cx, cy - 42, '▲', keyForward);
      drawKey(cx - 42, cy, '◀', keyLeft);
      drawKey(cx, cy, '■', false);
      drawKey(cx + 42, cy, '▶', false);
      drawKey(cx, cy + 42, '▼', false);

      // Emergency Stop Button
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(uiX + 20, 240, uiW - 40, 42, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('EMERGENCY STOP', uiX + 65, 265);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText('Hardware & simulation safety kill-switch', uiX + 42, 298);

    } else if (t < 25) {
      // UI State 2: SLAM Mapping in progress
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('2. Environment Mapping', uiX + 15, 38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Real-time 2D SLAM exploration:', uiX + 15, 54);

      // Live Scanning Box
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(uiX + 15, 75, uiW - 30, 95, 6);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('● SLAM SCANNING ACTIVE', uiX + 28, 98);

      const coveragePct = Math.min(96, Math.floor(40 + (t - 10) * 4));
      ctx.fillStyle = '#f8fafc';
      ctx.font = '11px sans-serif';
      ctx.fillText(`Discovered Area: ${coveragePct}%`, uiX + 28, 122);
      ctx.fillText('LiDAR: 360 rays @ 10Hz', uiX + 28, 140);
      ctx.fillText('Resolution: 0.05m / cell', uiX + 28, 156);

      // Active Mapping Button (Red Stop)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(uiX + 15, 190, uiW - 30, 40, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('STOP & SAVE MAP', uiX + 60, 214);

    } else if (t < 30) {
      // UI State 3: Map Uploaded / Committed
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('3. Map Saved & Uploaded', uiX + 15, 38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Occupancy Grid stored in SQLite DB:', uiX + 15, 54);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(uiX + 15, 75, uiW - 30, 140, 6);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('✓ Map "Office Floor 1" Ready', uiX + 28, 105);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Grid Dimensions: 400 x 300 (20m x 15m)', uiX + 28, 130);
      ctx.fillText('Compression: zlib / Base64', uiX + 28, 150);
      ctx.fillText('Status: Commited to DB', uiX + 28, 170);
      ctx.fillText('Next: Define destinations for users', uiX + 28, 195);

    } else {
      // UI State 4: Adding 4 Destinations
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('4. Add 4 Destinations', uiX + 15, 38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Click map to place destinations:', uiX + 15, 54);

      const items = [
        { name: 'Reception', coord: '(3.0m, 3.0m)', col: '#3b82f6' },
        { name: 'Meeting Room', coord: '(10.0m, 7.5m)', col: '#8b5cf6' },
        { name: 'Room A', coord: '(3.0m, 12.0m)', col: '#10b981' },
        { name: 'Room B', coord: '(15.0m, 12.0m)', col: '#f59e0b' }
      ];

      items.forEach((item, i) => {
        const itemY = 72 + i * 44;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(uiX + 15, itemY, uiW - 30, 38, 4);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.stroke();

        ctx.fillStyle = item.col;
        ctx.beginPath();
        ctx.arc(uiX + 28, itemY + 19, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(item.name, uiX + 42, itemY + 17);

        ctx.fillStyle = '#64748b';
        ctx.font = '9px sans-serif';
        ctx.fillText(`Saved ${item.coord}`, uiX + 42, itemY + 30);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('✓ SAVED', uiX + uiW - 75, itemY + 22);
      });

      // Bottom confirmation badge
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.roundRect(uiX + 15, 260, uiW - 30, 42, 6);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Ready for User Navigation!', uiX + 45, 285);
    }

    // Bottom Video Title bar
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, h - 38, w, 38);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('ADMIN VIDEO GUIDE: How to Control Robot, Run SLAM Mapping & Configure Destinations', 15, h - 22);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px sans-serif';
    ctx.fillText(stepCaption, 15, h - 8);

    // Time counter
    const curMin = Math.floor(t / 60);
    const curSec = Math.floor(t % 60);
    const totMin = Math.floor(totalDuration / 60);
    const totSec = Math.floor(totalDuration % 60);
    const timeStr = `${curMin}:${curSec.toString().padStart(2, '0')} / ${totMin}:${totSec.toString().padStart(2, '0')}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(timeStr, w - 85, h - 15);
  };

  const jumpToStep = (time: number) => {
    setCurrentTime(time);
    setIsPlaying(true);
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header bar */}
      <div className="bg-slate-900 border-b border-dark-border px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Admin Reference Video: Control, SLAM Mapping & Map Upload</h3>
            <p className="text-xs text-gray-400">Complete walkthrough for driving, scanning with LiDAR, saving maps, and configuring 4 destinations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('interactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'interactive' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
          >
            Live Animated Simulation
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'custom' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
          >
            Recorded MP4 Video
          </button>
        </div>
      </div>

      {/* Video Display Area */}
      <div className="relative bg-black flex items-center justify-center">
        {mode === 'interactive' ? (
          <canvas
            ref={canvasRef}
            width={850}
            height={460}
            className="w-full h-auto max-h-[520px] aspect-[16/9] object-contain"
          />
        ) : (
          <div className="w-full h-[460px] flex flex-col items-center justify-center p-6 text-center">
            {customVideoUrl ? (
              <video
                src={customVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <Video size={48} className="mx-auto text-purple-400 opacity-60" />
                <h4 className="font-bold text-white">Attach Real Robot Recording (MP4)</h4>
                <p className="text-xs text-gray-400">
                  Upload an MP4 screen capture or live video of your Raspberry Pi 5 mapping and manual control session.
                </p>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCustomVideoUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step scrubber & timeline */}
      <div className="px-5 py-3 bg-slate-900/90 border-t border-dark-border flex flex-col gap-2">
        {/* Progress bar */}
        <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setCurrentTime(pct * totalDuration);
          }}
        >
          <div
            className="h-full bg-purple-500 transition-all duration-75"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Video Player Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              onClick={() => { setCurrentTime(0); setIsPlaying(true); }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg transition-colors"
              title="Replay from start"
            >
              <RotateCcw size={16} />
            </button>

            <span className="text-xs text-gray-400 font-mono">
              {Math.floor(currentTime)}s / {totalDuration}s
            </span>
          </div>

          {/* Quick Step Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button onClick={() => jumpToStep(0)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300 flex items-center gap-1">
              <Gamepad2 size={12} /> 1. Manual Drive
            </button>
            <button onClick={() => jumpToStep(11)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300 flex items-center gap-1">
              <Scan size={12} /> 2. SLAM Mapping
            </button>
            <button onClick={() => jumpToStep(26)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300 flex items-center gap-1">
              <UploadCloud size={12} /> 3. Save / Upload
            </button>
            <button onClick={() => jumpToStep(31)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300 flex items-center gap-1">
              <MapPin size={12} /> 4. Add 4 Destinations
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Speed:</span>
            {[1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-0.5 rounded text-xs ${playbackSpeed === s ? 'bg-purple-600 text-white' : 'bg-slate-800 text-gray-400'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Explanatory Walkthrough Cards for Admins */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/60 border-t border-dark-border">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-purple-400 font-bold text-xs mb-1 flex items-center gap-1.5"><Gamepad2 size={14} /> 1. Drive Robot</div>
          <div className="text-[11px] text-gray-400">Use on-screen D-Pad or Arrow keys (W/A/S/D) to drive. Emergency stop button halts all motion instantly.</div>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-purple-400 font-bold text-xs mb-1 flex items-center gap-1.5"><Scan size={14} /> 2. SLAM Scan</div>
          <div className="text-[11px] text-gray-400">Click START MAPPING. Robot emits 360° LiDAR rays to progressively uncover walls, corridors, and doorways.</div>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-purple-400 font-bold text-xs mb-1 flex items-center gap-1.5"><UploadCloud size={14} /> 3. Save & Upload</div>
          <div className="text-[11px] text-gray-400">Click STOP MAPPING to commit the 2D grid to the database. The map becomes the ground truth for A* navigation.</div>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-purple-400 font-bold text-xs mb-1 flex items-center gap-1.5"><MapPin size={14} /> 4. Set 4 Destinations</div>
          <div className="text-[11px] text-gray-400">Click coordinates on the map or type names to register Reception, Meeting Room, Room A, and Room B for user dispatch.</div>
        </div>
      </div>
    </div>
  );
};
