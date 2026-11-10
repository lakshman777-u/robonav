import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Video, Scan, Gamepad2, 
  Flag, Compass, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Layers,
  UploadCloud, Volume2, VolumeX
} from 'lucide-react';

interface GuideRoom {
  id: number;
  name: string;
  roomNum: string;
  flagLabel: string;
  color: string;
  x: number;
  y: number;
  desc: string;
}

const GUIDE_ROOMS: GuideRoom[] = [
  { id: 1, name: 'Entrance / Entryway', roomNum: 'Room 1', flagLabel: 'Flag 1', color: '#06b6d4', x: 190, y: 250, desc: 'Lobby entry point & Home dock adjacent' },
  { id: 2, name: 'Living Room', roomNum: 'Room 2', flagLabel: 'Flag 2', color: '#a855f7', x: 80, y: 210, desc: 'Southwest spacious lounge area' },
  { id: 3, name: 'Dining Area', roomNum: 'Room 3', flagLabel: 'Flag 3', color: '#10b981', x: 130, y: 75, desc: 'Northwest central dining hall' },
  { id: 4, name: 'Kitchen', roomNum: 'Room 4', flagLabel: 'Flag 4', color: '#f59e0b', x: 260, y: 65, desc: 'Northeast kitchen & pantry wing' },
  { id: 5, name: 'Master Bedroom', roomNum: 'Room 5', flagLabel: 'Flag 5', color: '#ef4444', x: 380, y: 85, desc: 'Far east primary master suite' },
];

export const SlamVideoGuide = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 72 seconds
  const totalDuration = 72;
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [activeChapter, setActiveChapter] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [interactiveMode, setInteractiveMode] = useState<'video' | 'sandbox'>('video');
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'simulation' | 'custom'>('simulation');

  // Interactive Sandbox overrides
  const [sandboxPos, setSandboxPos] = useState({ x: 190, y: 155, heading: 90 });
  const [sandboxSpeedMode, setSandboxSpeedMode] = useState<'TURTLE' | 'BOOST'>('TURTLE');
  const lastSpokenChapterRef = useRef<number>(0);

  // Chapters definition
  const chapters = [
    { id: 1, start: 0, end: 12, title: '1. SLAM Toolbox Scan', icon: Scan, desc: 'Start node, YDLIDAR facing North, 360° laser sweep rays @ 11.9 Hz' },
    { id: 2, start: 12, end: 24, title: '2. 2D Map & Zero Overlap', icon: Layers, desc: 'Fixed world frame (worldToCanvas) stops wall drift & overlapping lines' },
    { id: 3, start: 24, end: 36, title: '3. Drive Forward & Back', icon: Gamepad2, desc: 'Move forward/backward (W/S), turn (A/D), Turtle vs Boost mode, E-Stop' },
    { id: 4, start: 36, end: 48, title: '4. Arrange Flags 1 to 5', icon: Flag, desc: 'Arrange Flag 1 to 5 in sequential order for Room 1, 2, 3, 4, 5' },
    { id: 5, start: 48, end: 60, title: '5. Select & Navigate Rooms', icon: Compass, desc: 'Select Room 1-5, A* path planning ribbon, auto-guide & return to Home' },
    { id: 6, start: 60, end: 72, title: '6. Master Order & Save', icon: UploadCloud, desc: 'Complete 5-step operational order, save to DB, export high-res PNG' },
  ];

  // Voice narration helper using browser SpeechSynthesis
  const speakCaption = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05 * playbackSpeed;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  // Determine active chapter from current time
  useEffect(() => {
    const ch = chapters.find(c => currentTime >= c.start && currentTime < c.end) || chapters[0];
    if (ch.id !== activeChapter) {
      setActiveChapter(ch.id);
      if (voiceEnabled && ch.id !== lastSpokenChapterRef.current) {
        lastSpokenChapterRef.current = ch.id;
        speakCaption(`${ch.title}. ${ch.desc}`);
      }
    }
  }, [currentTime, voiceEnabled, activeChapter, playbackSpeed]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlaying && mode === 'simulation') {
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
  }, [isPlaying, playbackSpeed, mode, currentTime, interactiveMode, sandboxPos, selectedRoomId]);

  // Jump to chapter
  const jumpToChapter = (startSec: number) => {
    setCurrentTime(startSec);
    setIsPlaying(true);
  };

  // Main high-performance render function
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = currentTime;

    // Deep Obsidian Floor Background (#06080e)
    ctx.fillStyle = '#06080e';
    ctx.fillRect(0, 0, w, h);

    // Left Pane: 2D House Floor Plan SLAM Map (Width: 62% of canvas)
    const mapW = w * 0.62;
    const mapH = h - 52;
    const mapX = 14;
    const mapY = 14;

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    // Map Floor base
    ctx.fillStyle = '#090d16';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    // 1. Draw subtle 1-meter grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let gx = mapX + 15; gx < mapX + mapW; gx += 20) {
      for (let gy = mapY + 15; gy < mapY + mapH; gy += 20) {
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    // 2. Reference House Geometry (Walls scaled to fit map pane)
    const hx1 = mapX + 25;
    const hx2 = mapX + mapW - 25;
    const hy1 = mapY + 25;
    const hy2 = mapY + mapH - 25;
    const midX = (hx1 + hx2) / 2;
    const midY = (hy1 + hy2) / 2;

    // Explored floor mask (charcoal floor revealed progressively in Chapters 1 & 2)
    let exploreProgress = 1.0;
    if (t < 12) {
      exploreProgress = Math.min(1.0, 0.25 + (t / 12) * 0.35); // Initial scan reveal
    } else if (t < 24) {
      exploreProgress = Math.min(1.0, 0.60 + ((t - 12) / 12) * 0.40); // 100% full house reveal
    }

    // Explored floor fill
    ctx.fillStyle = '#141824';
    ctx.fillRect(hx1, hy1, (hx2 - hx1) * exploreProgress, hy2 - hy1);

    // Architectural Room Boundaries (Solid Red Walls #ef4444)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer Perimeter
    ctx.strokeRect(hx1, hy1, hx2 - hx1, hy2 - hy1);

    // Interior Partition Walls
    // Divider 1: Left Wing (Living & Dining)
    ctx.beginPath();
    ctx.moveTo(hx1 + 140, hy1);
    ctx.lineTo(hx1 + 140, hy1 + 90);
    ctx.moveTo(hx1 + 140, hy1 + 130);
    ctx.lineTo(hx1 + 140, hy2);
    ctx.stroke();

    // Divider 2: Living Room / Dining Area horizontal wall
    ctx.beginPath();
    ctx.moveTo(hx1, hy1 + 110);
    ctx.lineTo(hx1 + 95, hy1 + 110);
    ctx.moveTo(hx1 + 125, hy1 + 110);
    ctx.lineTo(hx1 + 140, hy1 + 110);
    ctx.stroke();

    // Divider 3: Central Kitchen North Wall
    ctx.beginPath();
    ctx.moveTo(hx1 + 140, hy1 + 95);
    ctx.lineTo(hx1 + 250, hy1 + 95);
    ctx.stroke();

    // Divider 4: Central Hallway South Wall
    ctx.beginPath();
    ctx.moveTo(hx1 + 140, hy1 + 175);
    ctx.lineTo(hx1 + 220, hy1 + 175);
    ctx.moveTo(hx1 + 250, hy1 + 175);
    ctx.lineTo(hx1 + 330, hy1 + 175);
    ctx.stroke();

    // Divider 5: Right Wing (Master Bedroom partition)
    ctx.beginPath();
    ctx.moveTo(hx1 + 330, hy1);
    ctx.lineTo(hx1 + 330, hy1 + 90);
    ctx.moveTo(hx1 + 330, hy1 + 135);
    ctx.lineTo(hx1 + 330, hy2);
    ctx.stroke();

    // Architectural Room Labels on floor
    const rooms = [
      { name: 'Room 1: Entrance', x: hx1 + 190, y: hy2 - 35, col: '#06b6d4' },
      { name: 'Room 2: Living Room', x: hx1 + 70, y: hy2 - 45, col: '#a855f7' },
      { name: 'Room 3: Dining Area', x: hx1 + 70, y: hy1 + 55, col: '#10b981' },
      { name: 'Room 4: Kitchen', x: hx1 + 235, y: hy1 + 45, col: '#f59e0b' },
      { name: 'Room 5: Master Bed', x: hx2 - 75, y: hy1 + 55, col: '#ef4444' },
      { name: 'Central Hallway', x: midX, y: midY, col: '#64748b' }
    ];

    rooms.forEach(r => {
      ctx.fillStyle = r.col;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, r.x, r.y);
    });

    // 3. HOME (0,0) Green Bullseye Marker
    const homeX = hx1 + 190;
    const homeY = hy1 + 135;
    ctx.beginPath();
    ctx.arc(homeX, homeY, 9, 0, Math.PI * 2);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(homeX, homeY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOME (0,0)', homeX, homeY - 14);

    // Dynamic Robot Coordinates & Pose across chapters
    let rx = homeX;
    let ry = homeY;
    let headingDeg = 90;

    if (interactiveMode === 'sandbox') {
      rx = sandboxPos.x;
      ry = sandboxPos.y;
      headingDeg = sandboxPos.heading;
    } else {
      if (t < 12) {
        headingDeg = (90 + Math.sin(t * 1.5) * 25);
        rx = homeX;
        ry = homeY;
      } else if (t < 24) {
        const p = (t - 12) / 12;
        rx = homeX - p * 60;
        ry = homeY - Math.sin(p * Math.PI) * 15;
        headingDeg = 180 - p * 30;
      } else if (t < 36) {
        const subT = t - 24;
        if (subT < 4) {
          const p = subT / 4;
          rx = homeX - 30 + p * 70;
          ry = homeY;
          headingDeg = 0;
        } else if (subT < 8) {
          const p = (subT - 4) / 4;
          rx = homeX + 40 - p * 50;
          ry = homeY;
          headingDeg = 0;
        } else {
          rx = homeX - 10;
          ry = homeY;
          headingDeg = (subT - 8) * 45;
        }
      } else if (t < 48) {
        rx = homeX;
        ry = homeY;
        headingDeg = 90;
      } else if (t < 60) {
        const p = (t - 48) / 12;
        if (p < 0.5) {
          const np = p * 2;
          rx = homeX + np * 45;
          ry = homeY - np * 70;
          headingDeg = 45;
        } else {
          const np = (p - 0.5) * 2;
          rx = homeX + 45 + np * 120;
          ry = homeY - 70 + np * 20;
          headingDeg = 15;
        }
      } else {
        const p = (t - 60) / 12;
        rx = (hx2 - 75) - p * ((hx2 - 75) - homeX);
        ry = (hy1 + 55) + p * (homeY - (hy1 + 55));
        headingDeg = 210;
      }
    }

    // CHAPTER 2 VISUAL: Demonstrating "ZERO OVERLAPPING WALLS"
    if (t >= 12 && t < 24) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(mapX + 15, mapY + 12, 280, 24);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX + 15, mapY + 12, 280, 24);

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('✓ ROOT FIX: Fixed World Coordinates (Zero Drift)', mapX + 22, mapY + 28);
    }

    // CHAPTER 4 & 5 VISUAL: Displaying Flags 1 to 5 in Sequential Order
    const flagCoords = [
      { id: 1, name: 'Flag 1 (Room 1)', x: hx1 + 190, y: hy2 - 35, col: '#06b6d4', showAt: 36.5 },
      { id: 2, name: 'Flag 2 (Room 2)', x: hx1 + 70, y: hy2 - 45, col: '#a855f7', showAt: 38.5 },
      { id: 3, name: 'Flag 3 (Room 3)', x: hx1 + 70, y: hy1 + 55, col: '#10b981', showAt: 40.5 },
      { id: 4, name: 'Flag 4 (Room 4)', x: hx1 + 235, y: hy1 + 45, col: '#f59e0b', showAt: 42.5 },
      { id: 5, name: 'Flag 5 (Room 5)', x: hx2 - 75, y: hy1 + 55, col: '#ef4444', showAt: 44.5 },
    ];

    if (t >= 36 || interactiveMode === 'sandbox') {
      flagCoords.forEach(f => {
        if (t >= f.showAt || t >= 48 || interactiveMode === 'sandbox') {
          ctx.beginPath();
          ctx.arc(f.x, f.y, 11 + Math.sin(t * 6) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = f.col;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(f.x, f.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = f.col;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#020617';
          ctx.fillRect(f.x - 30, f.y - 24, 60, 14);
          ctx.strokeStyle = f.col;
          ctx.lineWidth = 1;
          ctx.strokeRect(f.x - 30, f.y - 24, 60, 14);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`FLAG ${f.id}`, f.x, f.y - 14);
        }
      });
    }

    // CHAPTER 5 VISUAL: Planned Autonomous Navigation Ribbon (A* Path)
    if ((t >= 48 && t < 60) || selectedRoomId !== null) {
      const targetFlag = flagCoords.find(f => f.id === (selectedRoomId || 4)) || flagCoords[3];

      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(rx, ry);
      const cornerX = midX;
      const cornerY = midY;
      ctx.lineTo(cornerX, cornerY);
      ctx.lineTo(targetFlag.x, targetFlag.y);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(targetFlag.x, targetFlag.y, 16 + Math.sin(t * 8) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // CHAPTER 1 & 2: 360° Live LiDAR Scan Sweep Rays & Neon Reflection Hits
    const radHeading = (headingDeg * Math.PI) / 180;
    const numRays = 40;
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.lineWidth = 0.5;

    for (let i = 0; i < numRays; i++) {
      const rayAngle = radHeading + (i * (Math.PI * 2 / numRays));
      const dist = 55 + Math.sin(rayAngle * 3 + t * 4) * 25;
      const hitX = rx + Math.cos(rayAngle) * dist;
      const hitY = ry + Math.sin(rayAngle) * dist;

      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(hitX, hitY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hitX, hitY, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ff2222';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 5;
      ctx.fill();
    }
    ctx.restore();

    // 4. Draw Robot Chassis, Wheels, Heading Pointer & Laser Diode
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(-radHeading + Math.PI / 2);

    // Left & Right Tires
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-14, -12, 7, 6);
    ctx.fillRect(7, -12, 7, 6);
    ctx.fillRect(-14, 6, 7, 6);
    ctx.fillRect(7, 6, 7, 6);

    // Chassis Body
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Heading Pointer
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(-4, -4);
    ctx.lineTo(4, -4);
    ctx.closePath();
    ctx.fill();

    // Ruby Laser Diode
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore(); // End map clip

    // Right Pane: Explanatory Chapter Cockpit UI
    const uiX = mapW + 28;
    const uiW = w - uiX - 14;
    const uiH = mapH;

    ctx.fillStyle = '#0b1120';
    ctx.beginPath();
    ctx.roundRect(uiX, mapY, uiW, uiH, 12);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chapter Title Badge
    const curChapter = chapters.find(c => t >= c.start && t < c.end) || chapters[0];
    ctx.fillStyle = '#020617';
    ctx.fillRect(uiX + 10, mapY + 10, uiW - 20, 38);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(uiX + 10, mapY + 10, uiW - 20, 38);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`PHASE ${curChapter.id} OF 6`, uiX + 18, mapY + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(curChapter.title.slice(3), uiX + 18, mapY + 40);

    // Dynamic Chapter Content rendering inside Cockpit
    if (t < 12) {
      drawChapter1Details(ctx, uiX, mapY, uiW);
    } else if (t < 24) {
      drawChapter2Details(ctx, uiX, mapY, uiW);
    } else if (t < 36) {
      drawChapter3Details(ctx, uiX, mapY, uiW, t);
    } else if (t < 48) {
      drawChapter4Details(ctx, uiX, mapY, uiW, t);
    } else if (t < 60) {
      drawChapter5Details(ctx, uiX, mapY, uiW);
    } else {
      drawChapter6Details(ctx, uiX, mapY, uiW);
    }

    // Bottom Video Title bar & Time Scrubber
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, h - 42, w, 42);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, h - 42, w, 1);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SLAM VIDEO GUIDE: 2D MAPPING, OVERLAP FIX, FLAGS 1-5 & NAVIGATION', 15, h - 24);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(curChapter.desc, 15, h - 10);

    // Time counter readout
    const curMin = Math.floor(t / 60);
    const curSec = Math.floor(t % 60);
    const totMin = Math.floor(totalDuration / 60);
    const totSec = Math.floor(totalDuration % 60);
    const timeStr = `${curMin}:${curSec.toString().padStart(2, '0')} / ${totMin}:${totSec.toString().padStart(2, '0')}`;
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, w - 18, h - 18);
  };

  // Helper Drawing Functions for Cockpit UI
  const drawChapter1Details = (ctx: CanvasRenderingContext2D, uiX: number, mapY: number, uiW: number) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Live ROS 2 SLAM Toolbox Scan Ingestion:', uiX + 15, mapY + 68);

    const stats = [
      { label: 'ROS 2 Topic', val: '/scan (sensor_msgs)', col: '#38bdf8' },
      { label: 'LiDAR Hardware', val: 'YDLIDAR X2 @ /dev/ttyUSB0', col: '#4ade80' },
      { label: 'Motor Orientation', val: 'Facing North (+X Body)', col: '#f59e0b' },
      { label: 'Scan Frequency', val: '11.9 Hz (360 Rays/Rev)', col: '#ef4444' },
      { label: 'SLAM Node', val: 'async_slam_toolbox_node', col: '#a855f7' },
      { label: 'Map Resolution', val: '0.05m (5 cm per cell)', col: '#38bdf8' }
    ];

    stats.forEach((s, idx) => {
      const sy = mapY + 86 + idx * 30;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(uiX + 12, sy, uiW - 24, 25, 4);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(s.label, uiX + 20, sy + 16);

      ctx.fillStyle = s.col;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(s.val, uiX + uiW - 20, sy + 16);
      ctx.textAlign = 'left';
    });

    // Pro-Tip Box
    ctx.fillStyle = '#042f2e';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, mapY + 280, uiW - 24, 45, 6);
    ctx.fill();
    ctx.strokeStyle = '#14b8a6';
    ctx.stroke();

    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('💡 PRO TIP: Motor Alignment', uiX + 20, mapY + 296);
    ctx.fillStyle = '#ccfbf1';
    ctx.font = '8px sans-serif';
    ctx.fillText('Mount YDLIDAR with motor wire facing robot front to eliminate scan skew.', uiX + 20, mapY + 312);
  };

  const drawChapter2Details = (ctx: CanvasRenderingContext2D, uiX: number, mapY: number, uiW: number) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Why Walls Do NOT Overlap (Root-Level Fix):', uiX + 15, mapY + 68);

    // Comparison Card 1: Old Wrong Way
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, mapY + 84, uiW - 24, 65, 6);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('❌ PREVIOUS: Relative Screen Blits', uiX + 20, mapY + 102);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('• Scans plotted relative to moving robot chassis', uiX + 20, mapY + 118);
    ctx.fillText('• Result: Ghost walls, overlapping streaks, tilted rooms', uiX + 20, mapY + 132);

    // Comparison Card 2: New Decoupled Way
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, mapY + 160, uiW - 24, 85, 6);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('✓ ROBUST FIX: Fixed World Coordinates', uiX + 20, mapY + 178);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '8.5px sans-serif';
    ctx.fillText('• WorldToCanvas maps to fixed (originX: -15, originY: -15)', uiX + 20, mapY + 194);
    ctx.fillText('• Row inversion: canvas_y = (height - 1) - grid_y (North Up)', uiX + 20, mapY + 208);
    ctx.fillText('• Raytracing clears free floor; walls stay 100% stationary', uiX + 20, mapY + 222);

    // Metric Grid specs
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(uiX + 12, mapY + 260, uiW - 24, 65);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(uiX + 12, mapY + 260, uiW - 24, 65);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '9px monospace';
    ctx.fillText('GRID SPECS: 600 x 600 cells (30m x 30m world)', uiX + 20, mapY + 280);
    ctx.fillText('TRI-STATE: -1 Unknown, 0 Free Floor, 100 Red Wall', uiX + 20, mapY + 300);
  };

  const drawChapter3Details = (ctx: CanvasRenderingContext2D, uiX: number, mapY: number, uiW: number, t: number) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Interactive Drive: Forward, Backward & Steering:', uiX + 15, mapY + 68);

    const cx = uiX + uiW / 2;
    const cy = mapY + 140;

    const subT = t - 24;
    const isFwd = subT < 4;
    const isRev = subT >= 4 && subT < 8;
    const isLeft = subT >= 8 && subT < 10;
    const isRight = subT >= 10 && subT < 12;

    const drawKey = (kx: number, ky: number, keyName: string, icon: string, active: boolean) => {
      ctx.fillStyle = active ? '#ef4444' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(kx - 18, ky - 18, 36, 36, 6);
      ctx.fill();
      ctx.strokeStyle = active ? '#fca5a5' : '#334155';
      ctx.stroke();

      ctx.fillStyle = active ? '#ffffff' : '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icon, kx, ky + 1);
      ctx.font = '8px monospace';
      ctx.fillText(keyName, kx, ky + 12);
      ctx.textAlign = 'left';
    };

    drawKey(cx, cy - 38, 'W', '▲', isFwd);
    drawKey(cx, cy + 38, 'S', '▼', isRev);
    drawKey(cx - 38, cy, 'A', '◀', isLeft);
    drawKey(cx + 38, cy, 'D', '▶', isRight);
    drawKey(cx, cy, 'STOP', '■', false);

    // Speed Mode Indicator
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, mapY + 215, uiW - 24, 45, 6);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('SPEED MODE SELECTION:', uiX + 20, mapY + 233);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px monospace';
    ctx.fillText('• TURTLE MODE: 0.10 m/s (Recommended for Mapping)', uiX + 20, mapY + 248);

    // Emergency Stop Banner
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, mapY + 275, uiW - 24, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛑 EMERGENCY STOP (SPACEBAR)', uiX + uiW / 2, mapY + 300);
    ctx.textAlign = 'left';
  };

  const drawChapter4Details = (ctx: CanvasRenderingContext2D, uiX: number, mapY: number, uiW: number, t: number) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Arrange Flags 1 to 5 in Sequential Order:', uiX + 15, mapY + 68);

    GUIDE_ROOMS.forEach((room, idx) => {
      const ry = mapY + 84 + idx * 38;
      const isUnlocked = t >= (36 + idx * 2.2) || t >= 48;

      ctx.fillStyle = isUnlocked ? '#0f172a' : '#090d16';
      ctx.beginPath();
      ctx.roundRect(uiX + 12, ry, uiW - 24, 32, 6);
      ctx.fill();
      ctx.strokeStyle = isUnlocked ? room.color : '#1e293b';
      ctx.stroke();

      ctx.fillStyle = isUnlocked ? room.color : '#475569';
      ctx.beginPath();
      ctx.arc(uiX + 26, ry + 16, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(room.id), uiX + 26, ry + 19);

      ctx.textAlign = 'left';
      ctx.fillStyle = isUnlocked ? '#f8fafc' : '#64748b';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(`${room.flagLabel}: ${room.name}`, uiX + 40, ry + 14);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.fillText(`Coordinates Locked • ${room.roomNum}`, uiX + 40, ry + 25);

      ctx.textAlign = 'right';
      ctx.fillStyle = isUnlocked ? '#10b981' : '#64748b';
      ctx.font = 'bold 8.5px monospace';
      ctx.fillText(isUnlocked ? '✓ PLACED' : 'PENDING', uiX + uiW - 20, ry + 20);
      ctx.textAlign = 'left';
    });

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(uiX + 12, mapY + 285, uiW - 24, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8.5px monospace';
    ctx.fillText('HOW TO ARRANGE ON 2D MAP:', uiX + 20, mapY + 301);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '8px sans-serif';
    ctx.fillText('Click "Set Flag 1..5" then click on the map to anchor each room pin.', uiX + 20, mapY + 315);
  };

  const drawChapter5Details = (ctx: CanvasRenderingContext2D, uiX: number, mapY: number, uiW: number) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Selecting Room 1 to 5 & Autonomous Guidance:', uiX + 15, mapY + 68);

    const steps = [
      { num: '1', title: 'Pick Room Number (1 - 5)', desc: 'User or Admin selects destination room from list' },
      { num: '2', title: 'A* Path Planning', desc: 'Computes collision-free trajectory ribbon through doorways' },
      { num: '3', title: 'Dynamic Guidance', desc: 'Robot drives at 0.10 m/s with 360° obstacle clearance' },
      { num: '4', title: 'Arrival & Auto-Return', desc: '5-min wait at room, then automatically returns to HOME (0,0)' }
    ];

    steps.forEach((st, idx) => {
      const sy = mapY + 86 + idx * 42;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(uiX + 12, sy, uiW - 24, 36, 6);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(uiX + 28, sy + 18, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.num, uiX + 28, sy + 21);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(st.title, uiX + 44, sy + 15);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.fillText(st.desc, uiX + 44, sy + 28);
    });

    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(uiX + 12, mapY + 270, uiW - 24, 52, 6);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 9.5px monospace';
    ctx.fillText('● AUTONOMOUS NAVIGATION ACTIVE', uiX + 20, mapY + 290);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '8px sans-serif';
    ctx.fillText('Path tracking accuracy: ±2 cm with real-time obstacle avoidance.', uiX + 20, mapY + 308);
  };

  const drawChapter6Details = (ctx: CanvasRenderingContext2D, uiX: number, mapY: number, uiW: number) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('Master 5-Step Order to Arrange Everything:', uiX + 15, mapY + 68);

    const orderSteps = [
      'Step 1: Start SLAM Scanning (YDLIDAR North)',
      'Step 2: Drive Forward/Backward to Map Walls',
      'Step 3: Arrange Flags 1 to 5 on Room Centers',
      'Step 4: Stop Mapping & Save Map to Database',
      'Step 5: Dispatch Navigation to Any Room (1-5)'
    ];

    orderSteps.forEach((os, idx) => {
      const sy = mapY + 84 + idx * 30;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(uiX + 12, sy, uiW - 24, 25, 4);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`✓ ${os}`, uiX + 20, sy + 16);
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(uiX + 12, mapY + 245, uiW - 24, 75);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(uiX + 12, mapY + 245, uiW - 24, 75);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('MAPPING STUDIO ACTION BUTTONS:', uiX + 20, mapY + 263);

    ctx.fillStyle = '#22c55e';
    ctx.font = '8.5px monospace';
    ctx.fillText('[START MAPPING] [PAUSE] [STOP MAPPING]', uiX + 20, mapY + 282);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('[SAVE MAP]   [CLEAR MAP]   [DELETE ALL]', uiX + 20, mapY + 302);
  };

  const handleDrive = (cmd: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP') => {
    setInteractiveMode('sandbox');
    const step = sandboxSpeedMode === 'BOOST' ? 12 : 6;

    if (cmd === 'FORWARD') {
      const rad = (sandboxPos.heading * Math.PI) / 180;
      setSandboxPos(p => ({
        ...p,
        x: Math.max(50, Math.min(420, p.x + Math.cos(rad) * step)),
        y: Math.max(50, Math.min(270, p.y - Math.sin(rad) * step))
      }));
    } else if (cmd === 'BACKWARD') {
      const rad = (sandboxPos.heading * Math.PI) / 180;
      setSandboxPos(p => ({
        ...p,
        x: Math.max(50, Math.min(420, p.x - Math.cos(rad) * step)),
        y: Math.max(50, Math.min(270, p.y + Math.sin(rad) * step))
      }));
    } else if (cmd === 'LEFT') {
      setSandboxPos(p => ({ ...p, heading: (p.heading + 25) % 360 }));
    } else if (cmd === 'RIGHT') {
      setSandboxPos(p => ({ ...p, heading: (p.heading - 25 + 360) % 360 }));
    }
  };

  return (
    <div className="bg-slate-950 rounded-2xl border border-red-500/30 overflow-hidden shadow-2xl flex flex-col font-sans">
      {/* Header bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-red-500/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/20 text-red-400 rounded-xl border border-red-500/30 shadow-lg">
            <Scan size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-950 text-red-400 border border-red-500/40">
                MASTER VIDEO GUIDE
              </span>
              <span className="text-[10px] text-gray-400 font-mono">60 FPS Interactive Canvas</span>
            </div>
            <h3 className="font-black text-white text-base tracking-wide mt-0.5">
              RoboNav 2D SLAM Mapping, Overlap Fix & Multi-Room Guide
            </h3>
          </div>
        </div>

        {/* Top Controls: Voice Narration Toggle, Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              voiceEnabled 
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                : 'bg-slate-800 text-gray-400 hover:text-white'
            }`}
            title="Toggle Voice Narration Audio"
          >
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{voiceEnabled ? 'VOICE ON' : 'VOICE OFF'}</span>
          </button>

          <button
            onClick={() => { setMode('simulation'); setInteractiveMode('video'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              mode === 'simulation' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            Interactive Simulation
          </button>

          <button
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              mode === 'custom' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            Recorded MP4
          </button>
        </div>
      </div>

      {/* Video / Simulation Canvas View */}
      <div className="relative bg-black flex items-center justify-center overflow-hidden">
        {mode === 'simulation' ? (
          <canvas
            ref={canvasRef}
            width={920}
            height={500}
            className="w-full h-auto max-h-[540px] aspect-[16/9] object-contain shadow-2xl"
          />
        ) : (
          <div className="w-full h-[500px] flex flex-col items-center justify-center p-6 text-center">
            {customVideoUrl ? (
              <video
                src={customVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                <Video size={48} className="mx-auto text-red-400 opacity-60" />
                <h4 className="font-bold text-white text-base">Attach Real Robot Recording (MP4/WebM)</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Upload an MP4 screen recording of your live SLAM Toolbox mapping session and multi-room flag navigation.
                </p>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCustomVideoUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Chapter Scrubber & Playback Bar */}
      <div className="px-6 py-4 bg-slate-900/95 border-t border-red-500/20 flex flex-col gap-3">
        {/* Progress bar */}
        <div
          className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setCurrentTime(pct * totalDuration);
            setInteractiveMode('video');
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.8)] transition-all duration-75"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Video Player Controls & Chapter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setIsPlaying(!isPlaying); setInteractiveMode('video'); }}
              className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-lg shadow-red-600/30"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
            </button>

            <button
              onClick={() => { setCurrentTime(0); setIsPlaying(true); setInteractiveMode('video'); }}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl transition-colors"
              title="Replay from start"
            >
              <RotateCcw size={17} />
            </button>

            <span className="text-xs text-gray-300 font-mono font-bold">
              {Math.floor(currentTime)}s / {totalDuration}s
            </span>
          </div>

          {/* Quick Chapter Navigation Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {chapters.map(c => {
              const Icon = c.icon;
              const isActive = activeChapter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { jumpToChapter(c.start); setInteractiveMode('video'); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'bg-slate-800/80 text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{c.title}</span>
                </button>
              );
            })}
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">Speed:</span>
            {[1, 1.5, 2].map(s => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  playbackSpeed === s ? 'bg-red-600 text-white shadow-md' : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Practice Sandbox: Room 1 to 5 Selector & Forward/Backward Drive */}
      <div className="p-6 bg-slate-950/90 border-t border-red-500/20 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Room 1 to 5 Selection & Navigation Test */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <Compass size={15} /> Select Room 1, 2, 3, 4, or 5 (Live Navigation)
            </h4>
            <span className="text-[10px] text-gray-400 font-mono">Click to test path</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GUIDE_ROOMS.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedRoomId(r.id);
                  setInteractiveMode('sandbox');
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedRoomId === r.id
                    ? 'bg-red-950/80 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                    : 'bg-slate-900/80 border-white/10 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{r.roomNum}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                </div>
                <div className="text-[11px] font-bold mt-1 text-gray-300 truncate">{r.name}</div>
                <div className="text-[9px] text-gray-400 truncate mt-0.5">{r.desc}</div>
              </button>
            ))}

            {/* Auto-Return Home button */}
            <button
              onClick={() => {
                setSelectedRoomId(null);
                setInteractiveMode('sandbox');
                setSandboxPos({ x: 190, y: 155, heading: 90 });
              }}
              className="p-3 rounded-xl border border-green-500/40 bg-green-950/40 hover:bg-green-900/50 text-left transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-green-300">HOME</span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <div className="text-[11px] font-bold mt-1 text-green-200">Return (0,0)</div>
              <div className="text-[9px] text-green-400/80">Auto-Dock Station</div>
            </button>
          </div>
        </div>

        {/* Right: Driving Controls Test (Forward, Backward, Turning) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <Gamepad2 size={15} /> Move Forward, Backward & Steer (Sandbox Test)
            </h4>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSandboxSpeedMode('TURTLE')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${sandboxSpeedMode === 'TURTLE' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-gray-400'}`}
              >
                TURTLE 0.10 m/s
              </button>
              <button
                onClick={() => setSandboxSpeedMode('BOOST')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${sandboxSpeedMode === 'BOOST' ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-400'}`}
              >
                BOOST 0.18 m/s
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={() => handleDrive('LEFT')}
              className="p-3 bg-slate-900 hover:bg-slate-800 text-white border border-white/10 rounded-xl font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
              title="Turn Left (A)"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDrive('FORWARD')}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-red-600/30 active:scale-95"
                title="Move Forward (W)"
              >
                <ArrowUp size={16} /> FORWARD
              </button>

              <button
                onClick={() => handleDrive('BACKWARD')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-white/10 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
                title="Move Backward / Reverse (S)"
              >
                <ArrowDown size={16} /> BACKWARD
              </button>
            </div>

            <button
              onClick={() => handleDrive('RIGHT')}
              className="p-3 bg-slate-900 hover:bg-slate-800 text-white border border-white/10 rounded-xl font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
              title="Turn Right (D)"
            >
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => handleDrive('STOP')}
              className="px-4 py-6 bg-red-700 hover:bg-red-800 text-white rounded-xl font-mono text-xs font-bold transition-all shadow-lg active:scale-95 ml-2"
              title="Emergency Stop"
            >
              E-STOP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
