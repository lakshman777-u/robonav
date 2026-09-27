import { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Flag, Zap, Compass, Disc, Shield, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

interface GameDestination {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  color: string;
}

const TRACK_DESTINATIONS: GameDestination[] = [
  { id: 1, name: 'VIP Reception Bay', type: 'Executive Terminal', x: 140, y: 120, color: '#38bdf8' },
  { id: 2, name: 'Pit Suite A', type: 'Telemetry Lab', x: 620, y: 120, color: '#8b5cf6' },
  { id: 3, name: 'Dyno Testing Bay', type: 'Powertrain Station', x: 140, y: 420, color: '#10b981' },
  { id: 4, name: 'Research Lab C', type: 'Aerodynamics Windtunnel', x: 660, y: 420, color: '#f59e0b' }
];

export const PaganiSimulatorGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Car Physics State
  const carRef = useRef({
    x: 400,
    y: 280,
    angle: 0,
    speed: 0,
    steerAngle: 0,
    maxSpeed: 7.5,
    accel: 0.16,
    friction: 0.96,
    brakeForce: 0.35,
    battery: 98,
    isBraking: false,
    isAccelerating: false,
    skidMarks: [] as { x: number; y: number; alpha: number }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const [speedKmh, setSpeedKmh] = useState(0);
  const [batteryDisplay, setBatteryDisplay] = useState(98);
  const [selectedDest, setSelectedDest] = useState<GameDestination | null>(null);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [distanceDriven, setDistanceDriven] = useState(0);

  // Audio Context for Engine Sound
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Audio Engine Synthesizer
  const toggleSound = () => {
    if (soundMuted) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        audioCtxRef.current = ctx;
        oscRef.current = osc;
        gainRef.current = gain;
        setSoundMuted(false);
      } catch (e) {
        console.error('Audio init failed', e);
      }
    } else {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
      }
      setSoundMuted(true);
    }
  };

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animId: number;
    let distCounter = 0;

    const gameLoop = () => {
      const car = carRef.current;
      const keys = keysPressed.current;

      // Handle Manual Driving Inputs
      const up = keys['w'] || keys['arrowup'];
      const down = keys['s'] || keys['arrowdown'];
      const left = keys['a'] || keys['arrowleft'];
      const right = keys['d'] || keys['arrowright'];
      const space = keys[' ']; // Emergency Brake
      const reset = keys['r'];

      if (reset) {
        car.x = 400;
        car.y = 280;
        car.speed = 0;
        car.angle = 0;
        car.battery = 100;
        setIsAutopilot(false);
      }

      // Autopilot Navigation if destination selected
      if (isAutopilot && selectedDest) {
        const dx = selectedDest.x - car.x;
        const dy = selectedDest.y - car.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 30) {
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - car.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          car.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.06);
          car.speed = Math.min(car.speed + car.accel * 0.8, 3.8);
          car.isAccelerating = true;
          car.isBraking = false;
        } else {
          // Arrived at destination
          car.speed *= 0.85;
          car.isBraking = true;
          car.isAccelerating = false;
          if (car.speed < 0.1) {
            car.speed = 0;
            setIsAutopilot(false);
          }
        }
      } else {
        // Manual Driving Physics
        if (space) {
          // Emergency Handbrake
          car.speed *= 0.82;
          car.isBraking = true;
          car.isAccelerating = false;
        } else {
          if (up) {
            car.speed = Math.min(car.speed + car.accel, car.maxSpeed);
            car.isAccelerating = true;
            car.isBraking = false;
            // Battery discharge with throttle
            car.battery = Math.max(0, car.battery - 0.005);
          } else if (down) {
            if (car.speed > 0.2) {
              car.speed = Math.max(0, car.speed - car.brakeForce);
              car.isBraking = true;
              car.isAccelerating = false;
            } else {
              // Reverse gear
              car.speed = Math.max(car.speed - car.accel * 0.7, -2.5);
              car.isAccelerating = false;
              car.isBraking = true;
            }
          } else {
            // Natural coasting friction
            car.speed *= car.friction;
            car.isAccelerating = false;
            car.isBraking = false;
          }
        }

        // Steering dynamics (turns more effectively when moving)
        const turnSpeed = 0.045;
        if (left) {
          car.angle -= turnSpeed * (Math.abs(car.speed) / car.maxSpeed + 0.3) * (car.speed >= 0 ? 1 : -1);
          car.steerAngle = -0.35;
        } else if (right) {
          car.angle += turnSpeed * (Math.abs(car.speed) / car.maxSpeed + 0.3) * (car.speed >= 0 ? 1 : -1);
          car.steerAngle = 0.35;
        } else {
          car.steerAngle = 0;
        }
      }

      // Update position
      car.x += Math.cos(car.angle) * car.speed;
      car.y += Math.sin(car.angle) * car.speed;

      // Track boundaries clamp with bounce
      const margin = 35;
      if (car.x < margin) { car.x = margin; car.speed *= -0.4; }
      if (car.x > 800 - margin) { car.x = 800 - margin; car.speed *= -0.4; }
      if (car.y < margin) { car.y = margin; car.speed *= -0.4; }
      if (car.y > 520 - margin) { car.y = 520 - margin; car.speed *= -0.4; }

      // Charging Station Pad (at center bay: 400, 280)
      const distToPad = Math.hypot(car.x - 400, car.y - 280);
      if (distToPad < 45 && Math.abs(car.speed) < 0.5) {
        car.battery = Math.min(100, car.battery + 0.08); // Recharging!
      }

      // Tire skid marks when turning fast or braking
      if ((car.isBraking && Math.abs(car.speed) > 1.5) || (Math.abs(car.steerAngle) > 0.2 && Math.abs(car.speed) > 4.5)) {
        car.skidMarks.push({ x: car.x, y: car.y, alpha: 0.6 });
        if (car.skidMarks.length > 120) car.skidMarks.shift();

        // Smoke particles
        car.particles.push({
          x: car.x - Math.cos(car.angle) * 15,
          y: car.y - Math.sin(car.angle) * 15,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1.0,
          color: 'rgba(200, 210, 225, 0.4)'
        });
      }

      // Fade skid marks & particles
      car.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
      });
      car.particles = car.particles.filter((p) => p.life > 0);

      // Distance counter
      distCounter += Math.abs(car.speed) * 0.05;
      setDistanceDriven(Math.floor(distCounter));

      // Update state for HUD readouts
      const currentKmh = Math.floor(Math.abs(car.speed) * 22);
      setSpeedKmh(currentKmh);
      setBatteryDisplay(Math.floor(car.battery));

      // Audio frequency modulation
      if (!soundMuted && oscRef.current && audioCtxRef.current) {
        const targetFreq = 50 + Math.abs(car.speed) * 65;
        oscRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.05);
      }

      renderCanvas();
      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      if (oscRef.current) {
        try {
          oscRef.current.stop();
        } catch (e) {}
      }
    };
  }, [isAutopilot, selectedDest, soundMuted]);

  // Render Track & Pagani Car Canvas
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const car = carRef.current;

    // Dark Asphalt Track Base
    ctx.fillStyle = '#080c16';
    ctx.fillRect(0, 0, w, h);

    // Track Grid & Apex Curves
    ctx.strokeStyle = '#172033';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Outer Track Curbing (Red & White Racing Curbs)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ef4444';
    ctx.strokeRect(20, 20, w - 40, h - 40);

    // Inner Curbs
    ctx.setLineDash([12, 12]);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.setLineDash([]);

    // Charging Pad / Pit Stop at Center (400, 280)
    const isCharging = Math.hypot(car.x - 400, car.y - 280) < 45;
    ctx.fillStyle = isCharging ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.arc(400, 280, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isCharging ? '#10b981' : '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = isCharging ? '#10b981' : '#94a3b8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('⚡ PIT CHARGING BAY', 345, 275);
    ctx.font = '9px sans-serif';
    ctx.fillText(isCharging ? 'RECHARGING (100W)' : 'Park here to recharge', 345, 290);

    // Render Skid Marks
    car.skidMarks.forEach((m) => {
      ctx.fillStyle = `rgba(15, 20, 30, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      m.alpha -= 0.002;
    });

    // Render Smoke Particles
    car.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - p.life) * 8 + 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw the 4 Indoor Destinations on Track
    TRACK_DESTINATIONS.forEach((d) => {
      const isTarget = selectedDest?.id === d.id;

      // Holographic Pad
      ctx.fillStyle = isTarget ? `${d.color}35` : 'rgba(15, 23, 42, 0.7)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isTarget ? d.color : '#334155';
      ctx.lineWidth = isTarget ? 3 : 1.5;
      ctx.stroke();

      if (isTarget) {
        // Pulsing navigation ring
        ctx.beginPath();
        ctx.arc(d.x, d.y, 32 + Math.sin(Date.now() / 150) * 6, 0, Math.PI * 2);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Pin
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(d.name, d.x - 35, d.y - 32);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.fillText(d.type, d.x - 35, d.y - 18);
    });

    // Autopilot Path Trajectory
    if (isAutopilot && selectedDest) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(selectedDest.x, selectedDest.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // DRAW THE PAGANI HYPERCAR
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Headlight Cones (Golden Xenon Light Beams)
    const beamLength = 95;
    const beamGrad = ctx.createRadialGradient(25, 0, 5, 25, 0, beamLength);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    beamGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.15)');
    beamGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(20, -10);
    ctx.lineTo(20 + beamLength, -32);
    ctx.lineTo(20 + beamLength, 32);
    ctx.lineTo(20, 10);
    ctx.closePath();
    ctx.fill();

    // 4 Pagani Racing Wheels with Tire Rims
    const drawWheel = (wx: number, wy: number, steer: number) => {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(steer);
      ctx.fillStyle = '#1e293b'; // Pirelli P-Zero Tire
      ctx.beginPath();
      ctx.roundRect(-7, -4, 14, 8, 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Gold Magnesium Rim Center
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    };

    // Front Wheels (Steerable)
    drawWheel(16, -17, car.steerAngle);
    drawWheel(16, 17, car.steerAngle);
    // Rear Wheels (Fixed Drive)
    drawWheel(-16, -17, 0);
    drawWheel(-16, 17, 0);

    // Pagani Teardrop Carbon Monocoque Chassis
    ctx.fillStyle = '#0f172a'; // Carbon Black
    ctx.beginPath();
    ctx.roundRect(-24, -14, 48, 28, 7);
    ctx.fill();
    ctx.strokeStyle = '#06b6d4'; // Cyan Aero Trim
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Titanium Aerodynamic Center Line
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-22, -1.5, 44, 3);

    // Glass Canopy Cockpit
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Quad Exhaust Circular Cluster (Pagani Signature)
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(-22, -2.5, 1.8, 0, Math.PI * 2);
    ctx.arc(-22, 2.5, 1.8, 0, Math.PI * 2);
    ctx.arc(-24, -1.2, 1.8, 0, Math.PI * 2);
    ctx.arc(-24, 1.2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Rear Carbon Active Wing
    ctx.fillStyle = '#020617';
    ctx.fillRect(-26, -16, 4, 32);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.strokeRect(-26, -16, 4, 32);

    // Tail Lights (Brighten when braking)
    ctx.fillStyle = car.isBraking ? '#ef4444' : '#7f1d1d';
    ctx.shadowColor = car.isBraking ? '#ef4444' : 'transparent';
    ctx.shadowBlur = car.isBraking ? 12 : 0;
    ctx.fillRect(-24, -12, 2, 6);
    ctx.fillRect(-24, 6, 2, 6);
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  const handleSelectDest = (dest: GameDestination) => {
    setSelectedDest(dest);
    setIsAutopilot(true);
  };

  const sendKey = (key: string, state: boolean) => {
    keysPressed.current[key] = state;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-dark-card border border-white/10 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel shadow-2xl">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles size={16} /> Interactive Simulator Practice Game
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span>PAGANI HUAYRA R</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              V12 PRACTICE SIMULATOR
            </span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Drive the virtual robot styled as a Pagani hypercar with full keyboard/touch controls, speed telemetry, and destination autopilot.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleSound}
            className={`p-2.5 rounded-xl border transition-all ${
              soundMuted
                ? 'bg-slate-900 border-white/10 text-gray-400 hover:text-white'
                : 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
            }`}
            title="Toggle Engine Sound"
          >
            {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={() => {
              carRef.current.x = 400;
              carRef.current.y = 280;
              carRef.current.speed = 0;
              carRef.current.angle = 0;
              carRef.current.battery = 100;
              setIsAutopilot(false);
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
          >
            <RotateCcw size={15} /> Reset Pit
          </button>
        </div>
      </div>

      {/* Main Game Screen & Cockpit HUD Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Cols: Interactive Game Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl glass-panel aspect-[800/520]">
            {/* HUD Overlay inside game */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-3 pointer-events-none">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">TELEMETRY:</span>{' '}
                <span className="text-cyan-400 font-bold">{speedKmh} KM/H</span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">BATTERY:</span>{' '}
                <span className={batteryDisplay > 20 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {batteryDisplay}%
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">DISTANCE:</span>{' '}
                <span className="text-white font-bold">{distanceDriven}m</span>
              </div>
            </div>

            {/* Autopilot Status Badge */}
            {isAutopilot && (
              <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500 text-cyan-300 text-xs font-mono font-bold animate-pulse">
                ⚡ AUTOPILOT TO {selectedDest?.name.toUpperCase()}
              </div>
            )}

            {/* Game Canvas */}
            <canvas
              ref={canvasRef}
              width={800}
              height={520}
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>

          {/* On-screen Pedals & D-Pad for Touch/Mouse driving */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-mono text-gray-400">
              <span className="text-white font-bold">KEYBOARD:</span> W / Up (Gas) • S / Down (Brake) • A / Left • D / Right • SPACE (Handbrake)
            </div>

            {/* On-screen buttons */}
            <div className="flex items-center gap-2">
              <button
                onMouseDown={() => sendKey('a', true)}
                onMouseUp={() => sendKey('a', false)}
                onTouchStart={() => sendKey('a', true)}
                onTouchEnd={() => sendKey('a', false)}
                className="w-12 h-12 bg-slate-900 border border-white/10 rounded-xl text-white flex items-center justify-center active:bg-slate-700"
              >
                <ArrowLeft size={20} />
              </button>

              <button
                onMouseDown={() => sendKey('s', true)}
                onMouseUp={() => sendKey('s', false)}
                onTouchStart={() => sendKey('s', true)}
                onTouchEnd={() => sendKey('s', false)}
                className="w-14 h-12 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center justify-center active:scale-95 border border-red-400/40"
              >
                BRAKE
              </button>

              <button
                onMouseDown={() => sendKey('w', true)}
                onMouseUp={() => sendKey('w', false)}
                onTouchStart={() => sendKey('w', true)}
                onTouchEnd={() => sendKey('w', false)}
                className="w-16 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wider rounded-xl flex items-center justify-center active:scale-95 border border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                GAS ▲
              </button>

              <button
                onMouseDown={() => sendKey('d', true)}
                onMouseUp={() => sendKey('d', false)}
                onTouchStart={() => sendKey('d', true)}
                onTouchEnd={() => sendKey('d', false)}
                className="w-12 h-12 bg-slate-900 border border-white/10 rounded-xl text-white flex items-center justify-center active:bg-slate-700"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Destination Dispatch & Live Battery Cluster */}
        <div className="space-y-5">
          {/* Destination Selector */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flag size={16} className="text-cyan-400" /> Target Destinations
              </h3>
              <span className="text-[10px] font-mono text-gray-400">4 TRACK ZONES</span>
            </div>

            <p className="text-xs text-gray-400 font-mono">
              Click any zone to engage Pagani autopilot guidance:
            </p>

            <div className="space-y-2.5">
              {TRACK_DESTINATIONS.map((dest) => {
                const isCurrent = selectedDest?.id === dest.id;
                return (
                  <button
                    key={dest.id}
                    onClick={() => handleSelectDest(dest)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-slate-800 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-950/70 hover:bg-slate-900 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: dest.color, boxShadow: `0 0 8px ${dest.color}` }}
                      />
                      <div>
                        <div className="font-bold text-xs text-white">{dest.name}</div>
                        <div className="text-[10px] text-gray-400">{dest.type}</div>
                      </div>
                    </div>

                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: `${dest.color}25`, color: dest.color }}
                    >
                      {isCurrent ? 'ACTIVE' : 'GO'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Supercar Battery Gauge Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap size={15} className="text-amber-400" /> High-Voltage Battery Pack
              </span>
              <span className="text-xs font-mono font-bold text-green-400">{batteryDisplay}%</span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  batteryDisplay > 30 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-red-500 animate-pulse'
                }`}
                style={{ width: `${batteryDisplay}%` }}
              />
            </div>

            <div className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Drive across the central green <span className="text-green-400 font-bold">⚡ PIT CHARGING BAY</span> to wirelessly fast-recharge the battery!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
