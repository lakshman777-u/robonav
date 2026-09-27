import { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, Volume2, VolumeX, Flag, Zap, Compass, Disc, Shield, 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles, Home, Box, 
  AlertTriangle, Sofa, Bed, Utensils, Laptop, BatteryCharging, CheckCircle2,
  Eye, Layers, Bot, User, Dog
} from 'lucide-react';
import { useCarTrim, CarTrim } from '../context/CarTrimContext';

// 5 Room Destinations Universal Across All Simulations
export interface RoomDestination {
  id: number;
  name: string;
  roomType: string;
  x: number;
  y: number;
  color: string;
  description: string;
  icon: 'sofa' | 'bed' | 'utensils' | 'laptop' | 'battery';
}

export const HOUSE_5_ROOMS: RoomDestination[] = [
  { 
    id: 1, 
    name: 'Living Room Lounge', 
    roomType: 'Social & Entertainment', 
    x: 170, 
    y: 140, 
    color: '#38bdf8', 
    description: 'Sectional sofa, coffee table, 85" OLED TV & area rug',
    icon: 'sofa'
  },
  { 
    id: 2, 
    name: 'Master Bedroom Suite', 
    roomType: 'Private Quarters', 
    x: 630, 
    y: 140, 
    color: '#818cf8', 
    description: 'King platform bed, bedside nightstands & wardrobe',
    icon: 'bed'
  },
  { 
    id: 3, 
    name: 'Gourmet Kitchen & Dining', 
    roomType: 'Culinary Bay', 
    x: 170, 
    y: 390, 
    color: '#10b981', 
    description: 'Marble island counter, cooktop & 4-seat dining set',
    icon: 'utensils'
  },
  { 
    id: 4, 
    name: 'Tech Office / Study Lab', 
    roomType: 'Workstation & Research', 
    x: 630, 
    y: 390, 
    color: '#f59e0b', 
    description: 'Executive L-desk, dual monitors & library bookshelf',
    icon: 'laptop'
  },
  { 
    id: 5, 
    name: 'Charging Garage Dock', 
    roomType: 'Energy Docking Station', 
    x: 400, 
    y: 260, 
    color: '#ec4899', 
    description: 'Inductive wireless fast-charging pad & tool bench',
    icon: 'battery'
  }
];

// Moving Obstacles for SRT Hellcat Mode
interface MovingObstacle {
  id: string;
  name: string;
  type: 'roomba' | 'person' | 'dog' | 'cart';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  angle: number;
}

export const PaganiSimulatorGame = () => {
  const { trim, setTrim, config } = useCarTrim();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Simulation Mode & Feature Toggles
  const [activeCar, setActiveCar] = useState<CarTrim>(trim || 'pagani');
  const [showObstacles, setShowObstacles] = useState<boolean>(activeCar === 'hellcat');
  const [showFurniture, setShowFurniture] = useState<boolean>(activeCar === 'mustang');

  // Sync mode changes
  const handleCarSwitch = (newTrim: CarTrim) => {
    setActiveCar(newTrim);
    setTrim(newTrim);
    if (newTrim === 'hellcat') {
      setShowObstacles(true);
      setShowFurniture(false);
    } else if (newTrim === 'mustang') {
      setShowObstacles(false);
      setShowFurniture(true);
    } else {
      // Pagani mode (pure architectural house)
      setShowObstacles(false);
      setShowFurniture(false);
    }
  };

  // Car Physics State
  const carRef = useRef({
    x: 400,
    y: 260,
    angle: -Math.PI / 2, // Facing up toward hallway
    speed: 0,
    steerAngle: 0,
    maxSpeed: 6.5,
    accel: 0.16,
    friction: 0.95,
    brakeForce: 0.38,
    battery: 98,
    isBraking: false,
    isAccelerating: false,
    skidMarks: [] as { x: number; y: number; alpha: number }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
  });

  // Dynamic Moving Obstacles (SRT Hellcat Mode)
  const obstaclesRef = useRef<MovingObstacle[]>([
    {
      id: 'obs-1',
      name: 'Autonomous Vacuum Bot',
      type: 'roomba',
      x: 150,
      y: 180,
      vx: 1.2,
      vy: 0.7,
      radius: 16,
      color: '#38bdf8',
      minX: 50,
      maxX: 290,
      minY: 60,
      maxY: 220,
      angle: 0
    },
    {
      id: 'obs-2',
      name: 'Walking Family Member',
      type: 'person',
      x: 600,
      y: 180,
      vx: -0.9,
      vy: 0,
      radius: 15,
      color: '#fbbf24',
      minX: 350,
      maxX: 720,
      minY: 140,
      maxY: 360,
      angle: 0
    },
    {
      id: 'obs-3',
      name: 'Playful Pet Dog',
      type: 'dog',
      x: 220,
      y: 380,
      vx: 1.4,
      vy: -1.1,
      radius: 14,
      color: '#f97316',
      minX: 60,
      maxX: 290,
      minY: 300,
      maxY: 460,
      angle: 0
    },
    {
      id: 'obs-4',
      name: 'Autonomous Delivery Pod',
      type: 'cart',
      x: 400,
      y: 100,
      vx: 0,
      vy: 1.3,
      radius: 18,
      color: '#ec4899',
      minX: 360,
      maxX: 440,
      minY: 60,
      maxY: 460,
      angle: 0
    }
  ]);

  const [proximityAlert, setProximityAlert] = useState<string | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const [speedKmh, setSpeedKmh] = useState(0);
  const [batteryDisplay, setBatteryDisplay] = useState(98);
  const [selectedDest, setSelectedDest] = useState<RoomDestination | null>(null);
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

        // Tune sound waveform to car trim
        if (activeCar === 'pagani') {
          osc.type = 'sawtooth'; // Screaming Italian V12
          osc.frequency.setValueAtTime(65, ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
        } else if (activeCar === 'hellcat') {
          osc.type = 'triangle'; // Supercharged American HEMI V8 Rumble
          osc.frequency.setValueAtTime(45, ctx.currentTime);
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
        } else {
          osc.type = 'sawtooth'; // High-Revving Shelby GT500 V8
          osc.frequency.setValueAtTime(55, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
        }

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
        try {
          oscRef.current.stop();
        } catch (e) {}
      }
      setSoundMuted(true);
    }
  };

  // 60 FPS Physics & Simulation Game Loop
  useEffect(() => {
    let animId: number;
    let distCounter = distanceDriven;
    let obstacleAnimTick = 0;

    const gameLoop = () => {
      const car = carRef.current;
      const keys = keysPressed.current;

      // Update Moving Obstacles (SRT Hellcat Mode or if enabled)
      obstacleAnimTick++;
      let closestDist = 9999;
      let alertName: string | null = null;

      if (showObstacles) {
        obstaclesRef.current.forEach((obs) => {
          obs.x += obs.vx;
          obs.y += obs.vy;

          // Bounce within room / patrol zone boundaries
          if (obs.x <= obs.minX || obs.x >= obs.maxX) {
            obs.vx *= -1;
            obs.angle = obs.vx > 0 ? 0 : Math.PI;
          }
          if (obs.y <= obs.minY || obs.y >= obs.maxY) {
            obs.vy *= -1;
          }

          // Proximity detection to car
          const d = Math.hypot(car.x - obs.x, car.y - obs.y);
          if (d < closestDist) {
            closestDist = d;
            if (d < 55) {
              alertName = `${obs.name.toUpperCase()} (Dist: ${Math.round(d)}cm)`;
            }
          }

          // Soft collision push
          if (d < obs.radius + 18) {
            car.speed *= -0.5;
            obs.vx *= -1;
            obs.vy *= -1;
          }
        });
      }
      setProximityAlert(alertName);

      // Autopilot Waypoint Navigation
      if (isAutopilot && selectedDest) {
        const dx = selectedDest.x - car.x;
        const dy = selectedDest.y - car.y;
        const targetDist = Math.hypot(dx, dy);

        if (targetDist < 30) {
          // Arrived at room destination
          car.speed *= 0.85;
          if (Math.abs(car.speed) < 0.2) {
            car.speed = 0;
            setIsAutopilot(false);
          }
        } else {
          // Turn toward waypoint
          const targetAngle = Math.atan2(dy, dx);
          let angleDiff = targetAngle - car.angle;

          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          car.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.08);
          car.steerAngle = Math.sign(angleDiff) * 0.25;

          // Smooth throttle
          if (car.speed < 3.2 && car.battery > 0) {
            car.speed += car.accel * 0.7;
            car.battery = Math.max(0, car.battery - 0.015);
          }
        }
      } else {
        // Manual Driving Controls
        const gas = keys['w'] || keys['arrowup'];
        const brake = keys['s'] || keys['arrowdown'];
        const left = keys['a'] || keys['arrowleft'];
        const right = keys['d'] || keys['arrowright'];
        const handbrake = keys[' '];

        car.isAccelerating = !!gas;
        car.isBraking = !!brake || !!handbrake;

        // Acceleration
        if (gas && car.battery > 0) {
          if (car.speed < car.maxSpeed) {
            car.speed += car.accel;
          }
          // Battery discharge with throttle
          car.battery = Math.max(0, car.battery - 0.025);
        }

        // Foot Brake & Reverse
        if (brake) {
          if (car.speed > 0) {
            car.speed -= car.brakeForce;
            if (car.speed < 0) car.speed = 0;
          } else {
            // Reverse
            if (car.speed > -car.maxSpeed * 0.45) {
              car.speed -= car.accel * 0.6;
            }
          }
        }

        // Handbrake
        if (handbrake) {
          car.speed *= 0.90;
        }

        // Natural Rolling Friction
        car.speed *= car.friction;

        // Steering (scales with velocity)
        const turnSpeed = 0.052;
        if (left) {
          car.angle -= turnSpeed * (Math.abs(car.speed) / car.maxSpeed + 0.35) * (car.speed >= 0 ? 1 : -1);
          car.steerAngle = -0.35;
        } else if (right) {
          car.angle += turnSpeed * (Math.abs(car.speed) / car.maxSpeed + 0.35) * (car.speed >= 0 ? 1 : -1);
          car.steerAngle = 0.35;
        } else {
          car.steerAngle = 0;
        }
      }

      // Update position
      car.x += Math.cos(car.angle) * car.speed;
      car.y += Math.sin(car.angle) * car.speed;

      // Outer House Wall Boundaries (20 to 780, 20 to 500)
      const minX = 40, maxX = 760, minY = 40, maxY = 480;
      if (car.x < minX) { car.x = minX; car.speed *= -0.4; }
      if (car.x > maxX) { car.x = maxX; car.speed *= -0.4; }
      if (car.y < minY) { car.y = minY; car.speed *= -0.4; }
      if (car.y > maxY) { car.y = maxY; car.speed *= -0.4; }

      // Internal Architectural Wall Collisions with Doorway Openings
      // Left vertical wall at x = 320 with doorway (y: 180 to 260)
      if (Math.abs(car.x - 320) < 14) {
        const inDoorway = (car.y >= 180 && car.y <= 270) || (car.y >= 330 && car.y <= 410);
        if (!inDoorway) {
          car.x = car.x < 320 ? 306 : 334;
          car.speed *= -0.4;
        }
      }
      // Right vertical wall at x = 480 with doorway (y: 180 to 260)
      if (Math.abs(car.x - 480) < 14) {
        const inDoorway = (car.y >= 180 && car.y <= 270) || (car.y >= 330 && car.y <= 410);
        if (!inDoorway) {
          car.x = car.x < 480 ? 466 : 494;
          car.speed *= -0.4;
        }
      }
      // Horizontal wall dividing Living Room & Kitchen (y = 260, x: 20 to 320) with doorway (x: 130 to 210)
      if (car.x < 320 && Math.abs(car.y - 260) < 14) {
        const inDoorway = car.x >= 130 && car.x <= 210;
        if (!inDoorway) {
          car.y = car.y < 260 ? 246 : 274;
          car.speed *= -0.4;
        }
      }
      // Horizontal wall dividing Bedroom & Office (y = 260, x: 480 to 780) with doorway (x: 590 to 670)
      if (car.x > 480 && Math.abs(car.y - 260) < 14) {
        const inDoorway = car.x >= 590 && car.x <= 670;
        if (!inDoorway) {
          car.y = car.y < 260 ? 246 : 274;
          car.speed *= -0.4;
        }
      }

      // Charging Garage Dock (Room 5 at center: 400, 260)
      const distToDock = Math.hypot(car.x - 400, car.y - 260);
      if (distToDock < 45 && Math.abs(car.speed) < 0.8) {
        car.battery = Math.min(100, car.battery + 0.12); // Fast inductive wireless charging
      }

      // Tire Skid Marks when drifting or braking hard
      if ((car.isBraking && Math.abs(car.speed) > 1.4) || (Math.abs(car.steerAngle) > 0.25 && Math.abs(car.speed) > 4.0)) {
        car.skidMarks.push({ x: car.x, y: car.y, alpha: 0.5 });
        if (car.skidMarks.length > 100) car.skidMarks.shift();

        // Smoke / Exhaust Particles
        const particleColor = activeCar === 'hellcat' 
          ? 'rgba(239, 68, 68, 0.4)' 
          : activeCar === 'mustang' 
            ? 'rgba(59, 130, 246, 0.4)' 
            : 'rgba(6, 182, 212, 0.4)';

        car.particles.push({
          x: car.x - Math.cos(car.angle) * 16,
          y: car.y - Math.sin(car.angle) * 16,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1.0,
          color: particleColor
        });
      }

      // Fade skid marks & particles
      car.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.035;
      });
      car.particles = car.particles.filter((p) => p.life > 0);

      // Telemetry Odometer
      distCounter += Math.abs(car.speed) * 0.04;
      setDistanceDriven(Math.floor(distCounter));

      // Telemetry HUD readouts
      const currentKmh = Math.floor(Math.abs(car.speed) * 18);
      setSpeedKmh(currentKmh);
      setBatteryDisplay(Math.floor(car.battery));

      // Audio frequency modulation
      if (!soundMuted && oscRef.current && audioCtxRef.current) {
        const baseFreq = activeCar === 'hellcat' ? 45 : activeCar === 'mustang' ? 55 : 65;
        const targetFreq = baseFreq + Math.abs(car.speed) * 55;
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
  }, [isAutopilot, selectedDest, soundMuted, activeCar, showObstacles, showFurniture]);

  // Main Canvas Rendering Routine
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const car = carRef.current;

    // 1. BASE INDOOR ARCHITECTURAL FOUNDATION
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    // 2. ROOM FLOORING TEXTURES
    // Room 1: Living Room Lounge (Top-Left: 20, 20, 300, 240) - Dark Oak Parquet Planks
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 20, 300, 240);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let py = 20; py < 260; py += 20) {
      ctx.beginPath();
      ctx.moveTo(20, py);
      ctx.lineTo(320, py);
      ctx.stroke();
    }

    // Room 2: Master Bedroom Suite (Top-Right: 480, 20, 300, 240) - Plush Slate-Indigo Carpet
    ctx.fillStyle = '#0c1222';
    ctx.fillRect(480, 20, 300, 240);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1;
    for (let px = 480; px < 780; px += 25) {
      ctx.beginPath();
      ctx.moveTo(px, 20);
      ctx.lineTo(px, 260);
      ctx.stroke();
    }

    // Room 3: Gourmet Kitchen & Dining (Bottom-Left: 20, 260, 300, 240) - Checkerboard Porcelain Tiles
    ctx.fillStyle = '#08171d';
    ctx.fillRect(20, 260, 300, 240);
    ctx.strokeStyle = '#0f2f3d';
    ctx.lineWidth = 1;
    for (let tx = 20; tx < 320; tx += 30) {
      for (let ty = 260; ty < 500; ty += 30) {
        ctx.strokeRect(tx, ty, 30, 30);
      }
    }

    // Room 4: Tech Office / Study Lab (Bottom-Right: 480, 260, 300, 240) - Hexagonal / Cyber Matrix
    ctx.fillStyle = '#140f07';
    ctx.fillRect(480, 260, 300, 240);
    ctx.strokeStyle = '#291e0a';
    ctx.lineWidth = 1;
    for (let ox = 480; ox < 780; ox += 25) {
      ctx.beginPath();
      ctx.moveTo(ox, 260);
      ctx.lineTo(ox, 500);
      ctx.stroke();
    }

    // Room 5 / Central Corridor: Showroom Epoxy Concrete & Garage Dock (320 to 480, 20 to 500)
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(320, 20, 160, 480);

    // Hazard Stripes on Central Hallways
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.2)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(330, 30, 140, 460);
    ctx.setLineDash([]);

    // 3. ARCHITECTURAL PARTITION WALLS & DOORWAYS
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#334155';
    ctx.lineCap = 'round';

    // Outer Perimeter Wall
    ctx.strokeRect(20, 20, 760, 480);

    // Vertical Left Wall (x = 320) with Doorway openings
    ctx.beginPath();
    ctx.moveTo(320, 20);
    ctx.lineTo(320, 180); // Doorway: 180 - 270
    ctx.moveTo(320, 270);
    ctx.lineTo(320, 330); // Doorway: 330 - 410
    ctx.moveTo(320, 410);
    ctx.lineTo(320, 500);
    ctx.stroke();

    // Vertical Right Wall (x = 480) with Doorway openings
    ctx.beginPath();
    ctx.moveTo(480, 20);
    ctx.lineTo(480, 180); // Doorway: 180 - 270
    ctx.moveTo(480, 270);
    ctx.lineTo(480, 330); // Doorway: 330 - 410
    ctx.moveTo(480, 410);
    ctx.lineTo(480, 500);
    ctx.stroke();

    // Horizontal Wall Left (y = 260) with Doorway
    ctx.beginPath();
    ctx.moveTo(20, 260);
    ctx.lineTo(130, 260); // Doorway: 130 - 210
    ctx.moveTo(210, 260);
    ctx.lineTo(320, 260);
    ctx.stroke();

    // Horizontal Wall Right (y = 260) with Doorway
    ctx.beginPath();
    ctx.moveTo(480, 260);
    ctx.lineTo(590, 260); // Doorway: 590 - 670
    ctx.moveTo(670, 260);
    ctx.lineTo(780, 260);
    ctx.stroke();

    // Doorway threshold indicators (green dashed door swings)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.setLineDash([4, 4]);
    // Living room door swing
    ctx.beginPath();
    ctx.arc(320, 180, 45, 0, Math.PI / 2);
    ctx.stroke();
    // Bedroom door swing
    ctx.beginPath();
    ctx.arc(480, 180, 45, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. ROOM 5: CENTRAL WIRELESS INDUCTIVE CHARGING DOCK (400, 260)
    const isDocked = Math.hypot(car.x - 400, car.y - 260) < 45;
    ctx.fillStyle = isDocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.arc(400, 260, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDocked ? '#10b981' : '#ec4899';
    ctx.lineWidth = isDocked ? 3 : 2;
    ctx.stroke();

    // Inductive coils
    ctx.beginPath();
    ctx.arc(400, 260, 26, 0, Math.PI * 2);
    ctx.strokeStyle = isDocked ? 'rgba(16, 185, 129, 0.6)' : 'rgba(236, 72, 153, 0.4)';
    ctx.stroke();

    ctx.fillStyle = isDocked ? '#10b981' : '#ec4899';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('⚡ CHARGING GARAGE DOCK', 335, 255);
    ctx.font = '8px sans-serif';
    ctx.fillText(isDocked ? 'WIRELESS RECHARGING (100W)' : 'Room 5 Docking Bay', 335, 270);

    // 5. FULL FURNITURE DETAILS (Mustang Mode or Furniture Toggle)
    if (showFurniture) {
      // Room 1: Living Room Lounge Furniture
      // Sectional L-Sofa
      ctx.fillStyle = '#334155';
      ctx.fillRect(50, 45, 130, 45); // Main sofa couch
      ctx.fillRect(50, 90, 45, 60);  // Chaise return
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, 45, 130, 45);
      ctx.strokeRect(50, 90, 45, 60);

      // Coffee Table with Glass Top
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(110, 105, 55, 30);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(110, 105, 55, 30);

      // 85-Inch OLED TV Console
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(210, 30, 70, 14);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(210, 30, 70, 14);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('85" 4K OLED', 222, 40);

      // Room 2: Master Bedroom Furniture
      // King Platform Bed & Pillows
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(630, 45, 95, 80);
      ctx.strokeStyle = '#6366f1';
      ctx.strokeRect(630, 45, 95, 80);
      // Pillows
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(640, 50, 32, 18);
      ctx.fillRect(682, 50, 32, 18);
      // Duvet fold
      ctx.fillStyle = '#312e81';
      ctx.fillRect(630, 75, 95, 50);

      // Nightstands with Glowing Lamps
      ctx.fillStyle = '#4338ca';
      ctx.fillRect(595, 50, 25, 25);
      ctx.fillRect(735, 50, 25, 25);
      // Wardrobe
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(500, 35, 85, 20);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(500, 35, 85, 20);

      // Room 3: Gourmet Kitchen & Dining Furniture
      // Kitchen Island Counter
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(60, 290, 100, 45);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(60, 290, 100, 45);
      // 3 Barstools
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(75, 345, 8, 0, Math.PI * 2);
      ctx.arc(110, 345, 8, 0, Math.PI * 2);
      ctx.arc(145, 345, 8, 0, Math.PI * 2);
      ctx.fill();

      // 4-Person Dining Table & Chairs
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(200, 380, 80, 45);
      ctx.strokeStyle = '#34d399';
      ctx.strokeRect(200, 380, 80, 45);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('DINING', 222, 407);

      // Room 4: Tech Office / Study Lab Furniture
      // Executive L-Desk
      ctx.fillStyle = '#451a03';
      ctx.fillRect(640, 400, 90, 45);
      ctx.fillRect(695, 355, 35, 45);
      ctx.strokeStyle = '#d97706';
      ctx.strokeRect(640, 400, 90, 45);
      ctx.strokeRect(695, 355, 35, 45);
      // Dual LED Monitors & Laptop
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(655, 404, 30, 5);
      ctx.fillRect(690, 404, 25, 5);
      // Ergonomic Swivel Chair
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(670, 425, 10, 0, Math.PI * 2);
      ctx.fill();
      // Bookshelf
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(500, 455, 110, 22);
      ctx.strokeStyle = '#b45309';
      ctx.strokeRect(500, 455, 110, 22);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '7px sans-serif';
      ctx.fillText('📚 RESEARCH LIBRARY', 510, 470);
    }

    // 6. ROOM LABELS & BLUEPRINT ARCHITECTURAL ANNOTATIONS
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('ROOM 1: LIVING ROOM LOUNGE', 35, 40);
    ctx.fillText('ROOM 2: MASTER BEDROOM SUITE', 495, 40);
    ctx.fillText('ROOM 3: GOURMET KITCHEN & DINING', 35, 280);
    ctx.fillText('ROOM 4: TECH OFFICE / STUDY LAB', 495, 280);
    ctx.fillText('CENTRAL HALLWAY & PIT', 345, 40);

    // 7. RENDER 5 ROOM DESTINATION BEACONS
    HOUSE_5_ROOMS.forEach((room) => {
      const isSelected = selectedDest?.id === room.id;
      ctx.strokeStyle = room.color;
      ctx.lineWidth = isSelected ? 3 : 1.5;

      // Outer Target Circle
      ctx.beginPath();
      ctx.arc(room.x, room.y, isSelected ? 24 : 18, 0, Math.PI * 2);
      ctx.stroke();

      // Pulsing Center Core
      ctx.fillStyle = room.color;
      ctx.beginPath();
      ctx.arc(room.x, room.y, isSelected ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Room Name Tag
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(room.name, room.x - 40, room.y + (isSelected ? 38 : 30));
    });

    // 8. RENDER LIVE MOVING OBSTACLES (SRT Hellcat Mode or if enabled)
    if (showObstacles) {
      obstaclesRef.current.forEach((obs) => {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        if (obs.type === 'roomba') {
          // Autonomous Robotic Vacuum
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Blinking Sensor Dome
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('ROOMBA', -14, -20);
        } else if (obs.type === 'person') {
          // Walking Family Member
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, -6, 7, 0, Math.PI * 2); // Head
          ctx.fill();
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(-6, 2, 12, 14); // Torso
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('🚶 PERSON', -16, -18);
        } else if (obs.type === 'dog') {
          // Playful Pet Dog
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2); // Body
          ctx.fill();
          ctx.beginPath();
          ctx.arc(10, -4, 5, 0, Math.PI * 2); // Head
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('🐕 PET DOG', -16, -16);
        } else {
          // Delivery Cart
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(-12, -12, 24, 24);
          ctx.strokeStyle = '#a5b4fc';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-12, -12, 24, 24);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('📦 POD', -10, -16);
        }

        ctx.restore();

        // Proximity Warning Line between Car and Obstacle
        const d = Math.hypot(car.x - obs.x, car.y - obs.y);
        if (d < 65) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(car.x, car.y);
          ctx.lineTo(obs.x, obs.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // 9. RENDER SKID MARKS
    car.skidMarks.forEach((m) => {
      ctx.fillStyle = `rgba(15, 23, 42, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      m.alpha -= 0.003;
    });

    // 10. RENDER SMOKE / EXHAUST PARTICLES
    car.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - p.life) * 8 + 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 11. RENDER ACTIVE VEHICLE MODEL (Pagani, Hellcat, or Mustang)
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Headlight Beams (Illuminating the House Floors)
    const beamColor = activeCar === 'hellcat' 
      ? 'rgba(239, 68, 68, 0.18)' 
      : activeCar === 'mustang' 
        ? 'rgba(59, 130, 246, 0.18)' 
        : 'rgba(56, 189, 248, 0.22)';

    ctx.fillStyle = beamColor;
    ctx.beginPath();
    ctx.moveTo(22, -10);
    ctx.lineTo(130, -55);
    ctx.lineTo(130, 55);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fill();

    // Wheels (4-Wheel Chassis with Steerable Front Wheels)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;

    // Rear Wheels (fixed)
    ctx.fillRect(-18, -19, 11, 6);
    ctx.strokeRect(-18, -19, 11, 6);
    ctx.fillRect(-18, 13, 11, 6);
    ctx.strokeRect(-18, 13, 11, 6);

    // Front Left Wheel (steers)
    ctx.save();
    ctx.translate(14, -16);
    ctx.rotate(car.steerAngle);
    ctx.fillRect(-5, -3, 11, 6);
    ctx.strokeRect(-5, -3, 11, 6);
    ctx.restore();

    // Front Right Wheel (steers)
    ctx.save();
    ctx.translate(14, 16);
    ctx.rotate(car.steerAngle);
    ctx.fillRect(-5, -3, 11, 6);
    ctx.strokeRect(-5, -3, 11, 6);
    ctx.restore();

    // VEHICLE BODYWORK
    if (activeCar === 'pagani') {
      // PAGANI HUAYRA R HYPERCAR
      // Teardrop aerodynamic carbon monocoque body
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Front splitter & aero canards
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(18, -14);
      ctx.lineTo(27, 0);
      ctx.lineTo(18, 14);
      ctx.fill();

      // Glass Cockpit Canopy
      ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.beginPath();
      ctx.ellipse(2, 0, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Signature Pagani Quad Titanium Exhaust Cluster
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(-22, -2.5, 1.8, 0, Math.PI * 2);
      ctx.arc(-22, 2.5, 1.8, 0, Math.PI * 2);
      ctx.arc(-24, -1.2, 1.8, 0, Math.PI * 2);
      ctx.arc(-24, 1.2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Carbon Active Wing
      ctx.fillStyle = '#020617';
      ctx.fillRect(-26, -16, 4, 32);
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(-26, -16, 4, 32);

    } else if (activeCar === 'hellcat') {
      // DODGE CHALLENGER SRT HELLCAT REDEYE
      // Muscular aggressive widebody
      ctx.fillStyle = '#991b1b'; // Deep Demon Red
      ctx.fillRect(-22, -15, 46, 30);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-22, -15, 46, 30);

      // Matte Black Hood & Dual Functional Air Scoops
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -11, 16, 22);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(8, -7, 5, 4);  // Left hood scoop
      ctx.fillRect(8, 3, 5, 4);   // Right hood scoop

      // Windshield & Roof
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-10, -10, 12, 20);

      // Dual Demon Halo Red Headlights
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24, -9, 2.5, 0, Math.PI * 2);
      ctx.arc(24, 9, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Dual Chrome Exhaust
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-25, -11, 4, 4);
      ctx.fillRect(-25, 7, 4, 4);

    } else {
      // MUSTANG SHELBY GT500 COBRA
      // Sleek pony car body in metallic cobalt blue
      ctx.fillStyle = '#1d4ed8'; // Cobalt Blue
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-22, -14, 46, 28, 5) : ctx.rect(-22, -14, 46, 28);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dual Iconic Bold White Shelby Racing Stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-22, -4, 46, 3);
      ctx.fillRect(-22, 1, 46, 3);

      // Black Tinted Canopy
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cobra Front Splitter
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, -14, 4, 28);

      // Raised GT500 Carbon Track Wing
      ctx.fillStyle = '#020617';
      ctx.fillRect(-26, -17, 4, 34);
      ctx.strokeStyle = '#3b82f6';
      ctx.strokeRect(-26, -17, 4, 34);
    }

    // Active Brake Lights (illuminate when braking or reversing)
    if (car.isBraking || car.speed < 0) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fillRect(-24, -13, 3, 6);
      ctx.fillRect(-24, 7, 3, 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  const handleSelectDest = (dest: RoomDestination) => {
    setSelectedDest(dest);
    setIsAutopilot(true);
  };

  const sendKey = (key: string, state: boolean) => {
    keysPressed.current[key] = state;
  };

  // Motor Brake and Throttle functions
  const handleEmergencyBrake = () => {
    carRef.current.speed = 0;
    carRef.current.isBraking = true;
    setIsAutopilot(false);
  };

  const handleAccelerate = () => {
    carRef.current.isBraking = false;
    carRef.current.speed = 2.5;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Vehicle Selection Bar */}
      <div className="bg-dark-card border border-white/10 p-6 rounded-2xl glass-panel shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Home size={16} /> Autonomous Indoor House Architecture Simulator
            </div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span>{config.name.toUpperCase()}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                5-ROOM HOUSE ENVIRONMENT
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Navigate inside a complete 5-room architectural house layout with live moving obstacles and full luxury furnishings.
            </p>
          </div>

          {/* Quick Sound & Reset Actions */}
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
                carRef.current.y = 260;
                carRef.current.speed = 0;
                carRef.current.angle = -Math.PI / 2;
                carRef.current.battery = 100;
                setIsAutopilot(false);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw size={15} /> Reset to Garage Dock
            </button>
          </div>
        </div>

        {/* 3-WAY CAR & ENVIRONMENT SELECTOR */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mr-1">
              Select Vehicle & Mode:
            </span>

            {/* Pagani Button */}
            <button
              onClick={() => handleCarSwitch('pagani')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeCar === 'pagani'
                  ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-gray-400 border-white/10'
              }`}
            >
              <span>🏎️ PAGANI HUAYRA R</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
                Architectural House
              </span>
            </button>

            {/* SRT Hellcat Button */}
            <button
              onClick={() => handleCarSwitch('hellcat')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeCar === 'hellcat'
                  ? 'bg-red-500/25 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-gray-400 border-white/10'
              }`}
            >
              <span>🔥 SRT HELLCAT</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300">
                Moving Obstacles & Objects
              </span>
            </button>

            {/* Mustang Shelby Button */}
            <button
              onClick={() => handleCarSwitch('mustang')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeCar === 'mustang'
                  ? 'bg-blue-500/25 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-gray-400 border-white/10'
              }`}
            >
              <span>🐎 MUSTANG SHELBY GT500</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">
                Fully Furnished House
              </span>
            </button>
          </div>

          {/* Environmental Feature Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowObstacles(!showObstacles)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                showObstacles
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-white/10 text-gray-400'
              }`}
            >
              <Eye size={13} /> Moving Obstacles: {showObstacles ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowFurniture(!showFurniture)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                showFurniture
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-slate-900 border-white/10 text-gray-400'
              }`}
            >
              <Layers size={13} /> Full Furniture: {showFurniture ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Simulation Screen & Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: Interactive House Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl glass-panel aspect-[800/520]">
            {/* HUD Telemetry Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">SPEED:</span>{' '}
                <span className="text-cyan-400 font-bold">{speedKmh} KM/H</span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">BATTERY:</span>{' '}
                <span className={batteryDisplay > 25 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {batteryDisplay}%
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">DISTANCE:</span>{' '}
                <span className="text-white font-bold">{distanceDriven}m</span>
              </div>
            </div>

            {/* Proximity / Obstacle Warning Alert */}
            {proximityAlert && (
              <div className="absolute top-4 right-4 z-10 px-3.5 py-1.5 rounded-xl bg-red-950/90 border border-red-500 text-red-300 text-xs font-mono font-bold animate-bounce flex items-center gap-1.5 shadow-lg">
                <AlertTriangle size={15} /> ⚠️ PROXIMITY ALERT: {proximityAlert}
              </div>
            )}

            {/* Autopilot Status Badge */}
            {isAutopilot && (
              <div className="absolute top-14 right-4 z-10 px-3.5 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500 text-cyan-300 text-xs font-mono font-bold animate-pulse">
                ⚡ AUTOPILOT TO {selectedDest?.name.toUpperCase()}
              </div>
            )}

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={800}
              height={520}
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>

          {/* On-screen Pedals, Emergency Brake & Keyboard Driving Controls */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-mono text-gray-400 space-y-1">
              <div>
                <span className="text-white font-bold">KEYBOARD:</span> W/Up (Gas) • S/Down (Brake/Rev) • A/Left • D/Right • Space (Handbrake)
              </div>
              <div className="text-[10px] text-gray-500">
                Drive into Room 5 Charging Garage Dock at center to recharge your battery!
              </div>
            </div>

            {/* Emergency Brake & Accelerate Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleEmergencyBrake}
                className="px-3 py-2.5 bg-red-600/90 hover:bg-red-600 text-white font-black text-xs rounded-xl flex items-center gap-1.5 border border-red-400/50 shadow-md active:scale-95"
              >
                🛑 EMERGENCY BRAKE
              </button>

              <button
                onClick={handleAccelerate}
                className="px-3 py-2.5 bg-cyan-600/90 hover:bg-cyan-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 border border-cyan-400/50 shadow-md active:scale-95"
              >
                ⚡ ACCELERATE
              </button>
            </div>

            {/* On-screen touch buttons */}
            <div className="flex items-center gap-2">
              <button
                onMouseDown={() => sendKey('a', true)}
                onMouseUp={() => sendKey('a', false)}
                onTouchStart={() => sendKey('a', true)}
                onTouchEnd={() => sendKey('a', false)}
                className="w-11 h-11 bg-slate-900 border border-white/10 rounded-xl text-white flex items-center justify-center active:bg-slate-700"
              >
                <ArrowLeft size={18} />
              </button>

              <button
                onMouseDown={() => sendKey('s', true)}
                onMouseUp={() => sendKey('s', false)}
                onTouchStart={() => sendKey('s', true)}
                onTouchEnd={() => sendKey('s', false)}
                className="w-12 h-11 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center justify-center active:scale-95 border border-red-400/40"
              >
                BRAKE
              </button>

              <button
                onMouseDown={() => sendKey('w', true)}
                onMouseUp={() => sendKey('w', false)}
                onTouchStart={() => sendKey('w', true)}
                onTouchEnd={() => sendKey('w', false)}
                className="w-14 h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wider rounded-xl flex items-center justify-center active:scale-95 border border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                GAS ▲
              </button>

              <button
                onMouseDown={() => sendKey('d', true)}
                onMouseUp={() => sendKey('d', false)}
                onTouchStart={() => sendKey('d', true)}
                onTouchEnd={() => sendKey('d', false)}
                className="w-11 h-11 bg-slate-900 border border-white/10 rounded-xl text-white flex items-center justify-center active:bg-slate-700"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 5 House Room Destinations & Battery HUD */}
        <div className="space-y-5">
          {/* 5 Room Destination Selector */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flag size={16} className="text-cyan-400" /> 5 House Destinations
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
                5 ROOMS
              </span>
            </div>

            <p className="text-xs text-gray-400 font-mono">
              Click any room to engage Autonomous Waypoint Navigation into that room:
            </p>

            <div className="space-y-2.5">
              {HOUSE_5_ROOMS.map((dest) => {
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
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dest.color, boxShadow: `0 0 10px ${dest.color}` }}
                      />
                      <div>
                        <div className="font-bold text-xs text-white">{dest.name}</div>
                        <div className="text-[10px] text-gray-400">{dest.description}</div>
                      </div>
                    </div>

                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0"
                      style={{ backgroundColor: `${dest.color}25`, color: dest.color }}
                    >
                      {isCurrent ? 'ACTIVE' : 'GO'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High-Voltage Battery Pack & Dock Status */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap size={15} className="text-amber-400" /> Battery & Garage Dock
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
              Drive into <span className="text-pink-400 font-bold">Room 5: Charging Garage Dock</span> (center hall) for 100W wireless inductive fast charging!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
