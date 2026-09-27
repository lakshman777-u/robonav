import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Maximize2, MapPin, CheckCircle, Navigation, AlertTriangle, Video, Eye } from 'lucide-react';

interface Destination {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  color: string;
}

const DESTINATIONS: Destination[] = [
  { id: 1, name: 'Reception', type: 'Lobby & Check-in', x: 70, y: 70, color: '#3b82f6' },
  { id: 2, name: 'Meeting Room', type: 'Conference Hall', x: 210, y: 130, color: '#8b5cf6' },
  { id: 3, name: 'Room A', type: 'Executive Office', x: 70, y: 250, color: '#10b981' },
  { id: 4, name: 'Room B', type: 'Research & Robotics Lab', x: 330, y: 250, color: '#f59e0b' }
];

export const UserVideoGuide = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 40 seconds
  const [totalDuration] = useState(40);
  const [selectedDestId, setSelectedDestId] = useState<number>(1);
  const [stepCaption, setStepCaption] = useState('Step 1: Browse destinations on the website');
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'interactive' | 'custom'>('interactive');

  // Animation frame loop for interactive video simulation
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

  // Update captions and selected destination based on current playback time
  useEffect(() => {
    const t = currentTime;
    if (t < 8) {
      setStepCaption('Step 1: User views 4 available indoor destinations on the website');
      setSelectedDestId(1);
    } else if (t < 16) {
      setStepCaption('Step 2: User previews destinations randomly or sequentially (e.g., Room B)');
      setSelectedDestId(t < 12 ? 4 : 2);
    } else if (t < 22) {
      setStepCaption('Step 3: User confirms "Room A" and clicks "Navigate Me"');
      setSelectedDestId(3);
    } else if (t < 34) {
      setStepCaption('Step 4: Robot plans A* path, scans with LiDAR & safely guides user around obstacles');
    } else {
      setStepCaption('Step 5: Robot arrives at Room A, enters waiting timer (5 mins) for user');
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

    // Background gradient (Dark terminal aesthetic)
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Left Pane: Map View
    const mapW = w * 0.58;
    const mapH = h - 50;
    ctx.save();
    ctx.beginPath();
    ctx.rect(15, 15, mapW, mapH);
    ctx.clip();

    // Map container background
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(15, 15, mapW, mapH);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 15; x < mapW + 15; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 15);
      ctx.lineTo(x, mapH + 15);
      ctx.stroke();
    }
    for (let y = 15; y < mapH + 15; y += 30) {
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(mapW + 15, y);
      ctx.stroke();
    }

    // Outer and interior walls
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, mapW - 30, mapH - 30);

    // Partition walls (Rooms)
    ctx.beginPath();
    // Reception partition (Top-Left)
    ctx.moveTo(30, 110);
    ctx.lineTo(130, 110);
    ctx.lineTo(130, 75); // Door opening

    // Room A partition (Bottom-Left)
    ctx.moveTo(30, 190);
    ctx.lineTo(130, 190);
    ctx.lineTo(130, 225); // Door opening

    // Room B partition (Bottom-Right)
    ctx.moveTo(mapW, 190);
    ctx.lineTo(mapW - 120, 190);
    ctx.lineTo(mapW - 120, 225); // Door

    // Meeting Room (Center)
    ctx.strokeRect(170, 90, 90, 80);
    ctx.stroke();

    // Clear door for Meeting Room
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(195, 88, 30, 6);

    // Glass wall indicator (dashed cyan)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(mapW - 120, 90);
    ctx.lineTo(mapW - 120, 170);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw the 4 Destinations
    DESTINATIONS.forEach((dest) => {
      const isSelected = dest.id === selectedDestId;
      ctx.beginPath();
      ctx.arc(dest.x + 30, dest.y + 30, isSelected ? 12 : 8, 0, Math.PI * 2);
      ctx.fillStyle = dest.color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(dest.x + 30, dest.y + 30, 18 + Math.sin(t * 5) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = dest.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px sans-serif';
      ctx.fillText(dest.name, dest.x + 10, dest.y + 20);
    });

    // Robot Position Calculation
    const startX = 60;
    const startY = 60;
    let robotX = startX;
    let robotY = startY;
    let robotAngle = 0;

    // Waypoints for Room A (Target: dest 3 at x=70, y=250 -> canvas pos x=100, y=280)
    const waypoints = [
      { x: 60, y: 60 },
      { x: 150, y: 60 },
      { x: 150, y: 190 },
      { x: 145, y: 220 }, // Obstacle avoidance detour
      { x: 100, y: 280 }  // Room A
    ];

    if (t >= 22 && t < 34) {
      // Navigating progress 0 to 1
      const navProgress = (t - 22) / 12;
      const totalSegments = waypoints.length - 1;
      const currentSegment = Math.min(Math.floor(navProgress * totalSegments), totalSegments - 1);
      const segmentProgress = (navProgress * totalSegments) - currentSegment;

      const p1 = waypoints[currentSegment];
      const p2 = waypoints[currentSegment + 1];

      robotX = p1.x + (p2.x - p1.x) * segmentProgress;
      robotY = p1.y + (p2.y - p1.y) * segmentProgress;
      robotAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      // Draw planned path (Green dashed line)
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(waypoints[0].x, waypoints[0].y);
      for (let i = 1; i < waypoints.length; i++) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (t >= 34) {
      robotX = 100;
      robotY = 280;
      robotAngle = Math.PI / 2;
    }

    // Dynamic obstacle at (150, 160) during navigation
    if (t >= 22 && t < 34) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(150, 160, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Warning ring if robot is close
      if (Math.hypot(robotX - 150, robotY - 160) < 45) {
        ctx.beginPath();
        ctx.arc(150, 160, 22 + Math.sin(t * 10) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('! Obstacle Reroute', 165, 160);
      }
    }

    // LiDAR Scanning Rays around Robot
    const rayCount = 18;
    for (let i = 0; i < rayCount; i++) {
      const angle = (t * 4) + (i * (Math.PI * 2 / rayCount));
      const dist = 35 + Math.sin(angle * 3) * 12;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(robotX, robotY);
      ctx.lineTo(robotX + Math.cos(angle) * dist, robotY + Math.sin(angle) * dist);
      ctx.stroke();
    }

    // Draw Robot Chassis
    ctx.save();
    ctx.translate(robotX, robotY);
    ctx.rotate(robotAngle);

    // Wheels
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10, -9, 6, 4);
    ctx.fillRect(4, -9, 6, 4);
    ctx.fillRect(-10, 5, 6, 4);
    ctx.fillRect(4, 5, 6, 4);

    // Body
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(-8, -7, 16, 14, 3);
    ctx.fill();

    // Direction Head / Camera
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(6, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore(); // End map clip

    // Right Pane: Simulated Website Interface
    const uiX = mapW + 25;
    const uiW = w - uiX - 15;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(uiX, 15, uiW, mapH, 8);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    // UI Header
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Select Destination', uiX + 15, 38);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Choose where you want the robot to take you:', uiX + 15, 54);

    // 4 Destination Cards in UI
    DESTINATIONS.forEach((dest, idx) => {
      const cardY = 68 + idx * 56;
      const isSelected = dest.id === selectedDestId;

      ctx.fillStyle = isSelected ? '#1e3a5f' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(uiX + 12, cardY, uiW - 24, 48, 6);
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#334155';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Color badge
      ctx.fillStyle = dest.color;
      ctx.beginPath();
      ctx.arc(uiX + 26, cardY + 24, 7, 0, Math.PI * 2);
      ctx.fill();

      // Destination Name & details
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(dest.name, uiX + 42, cardY + 20);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText(dest.type, uiX + 42, cardY + 34);

      if (isSelected) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('✓ SELECTED', uiX + uiW - 85, cardY + 27);
      }
    });

    // "Navigate Me Here" Button
    const btnY = 300;
    const isNavigating = t >= 22;
    ctx.fillStyle = isNavigating ? '#059669' : '#2563eb';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, btnY, uiW - 24, 38, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    const btnText = isNavigating ? 'Robot Navigating You...' : '▶ Request Robot Guide';
    ctx.fillText(btnText, uiX + 35, btnY + 24);

    // Status Banner at bottom of UI
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(uiX + 12, btnY + 48, uiW - 24, 42);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(uiX + 12, btnY + 48, uiW - 24, 42);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('Live Robot Status:', uiX + 20, btnY + 64);

    let statusText = 'IDLE - Ready for selection';
    let statusColor = '#38bdf8';
    if (t >= 22 && t < 34) {
      statusText = 'NAVIGATING to Room A (0.3m/s)';
      statusColor = '#10b981';
    } else if (t >= 34) {
      statusText = 'WAITING AT ROOM A (4:52 remaining)';
      statusColor = '#f59e0b';
    }

    ctx.fillStyle = statusColor;
    ctx.font = '10px sans-serif';
    ctx.fillText(statusText, uiX + 20, btnY + 80);

    // Animated Mouse Pointer Simulation
    let mouseX = uiX + 120;
    let mouseY = 100;

    if (t < 8) {
      // Moves to Reception
      mouseX = uiX + 120 + Math.sin(t * 2) * 20;
      mouseY = 90;
    } else if (t < 12) {
      // Moves to Room B
      mouseX = uiX + 120 + (t - 8) * 5;
      mouseY = 68 + 3 * 56 + 24;
    } else if (t < 16) {
      // Moves to Meeting Room
      mouseX = uiX + 130;
      mouseY = 68 + 1 * 56 + 24;
    } else if (t < 22) {
      // Moves to Room A then clicks Navigate button
      const p = (t - 16) / 6;
      if (p < 0.5) {
        mouseX = uiX + 120;
        mouseY = 68 + 2 * 56 + 24;
      } else {
        mouseX = uiX + uiW / 2;
        mouseY = btnY + 19;
      }
    } else {
      // Off screen during navigation
      mouseX = w + 50;
      mouseY = h + 50;
    }

    // Draw Cursor
    if (mouseX <= w && mouseY <= h) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(mouseX, mouseY);
      ctx.lineTo(mouseX + 12, mouseY + 12);
      ctx.lineTo(mouseX + 7, mouseY + 13);
      ctx.lineTo(mouseX + 10, mouseY + 19);
      ctx.lineTo(mouseX + 7, mouseY + 20);
      ctx.lineTo(mouseX + 4, mouseY + 14);
      ctx.lineTo(mouseX, mouseY + 17);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Click ripple effect around t=20s
      if (t > 19.5 && t < 21) {
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, (t - 19.5) * 25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Bottom Video Title & Subtitle bar
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, h - 38, w, 38);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('VIDEO GUIDE: How to Select a Destination & Let Robot Navigate You', 15, h - 22);

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
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
            <Video size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">User Reference Video: Destination Selection & Robot Navigation</h3>
            <p className="text-xs text-gray-400">Step-by-step interactive visual tutorial demonstrating 4 destinations and live autonomous guidance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('interactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'interactive' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
          >
            Live Animated Simulation
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
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
                <Video size={48} className="mx-auto text-blue-400 opacity-60" />
                <h4 className="font-bold text-white">Attach Real Robot Recording (MP4)</h4>
                <p className="text-xs text-gray-400">
                  You can upload or provide a local MP4 recording of your Raspberry Pi 5 robot navigating around the physical office.
                </p>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCustomVideoUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
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
            className="h-full bg-blue-500 transition-all duration-75"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Video Player Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
            <button onClick={() => jumpToStep(0)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300">
              1. 4 Destinations
            </button>
            <button onClick={() => jumpToStep(9)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300">
              2. Random Selection
            </button>
            <button onClick={() => jumpToStep(17)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300">
              3. Request Robot
            </button>
            <button onClick={() => jumpToStep(23)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300">
              4. Navigation & Obstacles
            </button>
            <button onClick={() => jumpToStep(35)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] rounded text-gray-300">
              5. Arrival & Timer
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Speed:</span>
            {[1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-0.5 rounded text-xs ${playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Explanatory Walkthrough Cards for Users */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/60 border-t border-dark-border">
        {DESTINATIONS.map((d) => (
          <div key={d.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: d.color }} />
            <div>
              <div className="font-bold text-xs text-white">{d.name}</div>
              <div className="text-[11px] text-gray-400">{d.type}</div>
              <div className="text-[10px] text-blue-400 mt-1">Coordinates: ({d.x / 20}m, {d.y / 20}m)</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
