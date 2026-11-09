import React, { useState, useEffect } from 'react';
import { Eye, ShieldAlert, Sparkles, Activity, AlertTriangle, Compass } from 'lucide-react';

export type EyeExpression =
  | 'FORWARD'
  | 'REVERSE'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'U_TURN_LEFT'
  | 'U_TURN_RIGHT'
  | 'OBSTACLE'
  | 'ALERT'
  | 'E_STOP'
  | 'ARRIVED'
  | 'OFFLINE'
  | 'IDLE'
  | 'HAPPY';

interface DirectionalRobotEyesProps {
  expression?: string;
  direction?: string;
  speedMode?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  showLabel?: boolean;
  showOledBezel?: boolean;
}

export const DirectionalRobotEyes: React.FC<DirectionalRobotEyesProps> = ({
  expression = 'IDLE',
  direction = 'STOPPED',
  speedMode = 'TURTLE',
  size = 'md',
  interactive = false,
  showLabel = true,
  showOledBezel = true,
}) => {
  const [blink, setBlink] = useState(false);
  const [internalExpr, setInternalExpr] = useState<EyeExpression>('IDLE');
  const [subtleScan, setSubtleScan] = useState(0);

  // Map incoming expression / direction with priority
  useEffect(() => {
    const raw = (expression || direction || 'IDLE').toUpperCase();
    if (raw.includes('STOP!') || raw.includes('EMERGENCY') || raw === 'E_STOP') {
      setInternalExpr('E_STOP');
    } else if (raw.includes('OFFLINE') || raw.includes('DISCONNECTED')) {
      setInternalExpr('OFFLINE');
    } else if (raw.includes('ALERT') || raw.includes('OBSTACLE!')) {
      setInternalExpr('ALERT');
    } else if (raw.includes('OBSERV') || raw.includes('OBSTACLE')) {
      setInternalExpr('OBSTACLE');
    } else if (raw.includes('ARRIV') || raw.includes('CELEBRATE')) {
      setInternalExpr('ARRIVED');
    } else if (raw.includes('U_TURN_LEFT') || raw.includes('U-TURN LEFT')) {
      setInternalExpr('U_TURN_LEFT');
    } else if (raw.includes('U_TURN_RIGHT') || raw.includes('U-TURN RIGHT')) {
      setInternalExpr('U_TURN_RIGHT');
    } else if (raw.includes('TURN_LEFT') || raw.includes('LEFT')) {
      setInternalExpr('TURN_LEFT');
    } else if (raw.includes('TURN_RIGHT') || raw.includes('RIGHT')) {
      setInternalExpr('TURN_RIGHT');
    } else if (raw.includes('REVERSE') || raw.includes('BACK')) {
      setInternalExpr('REVERSE');
    } else if (raw.includes('FORWARD')) {
      setInternalExpr('FORWARD');
    } else {
      setInternalExpr('HAPPY');
    }
  }, [expression, direction]);

  // Natural blinking interval
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Subtle scanning motion for observation
  useEffect(() => {
    if (internalExpr === 'OBSTACLE' || internalExpr === 'REVERSE') {
      const scanInterval = setInterval(() => {
        setSubtleScan((prev) => (prev === 0 ? 4 : prev === 4 ? -4 : 0));
      }, 700);
      return () => clearInterval(scanInterval);
    } else {
      setSubtleScan(0);
    }
  }, [internalExpr]);

  // Compute pupil offsets and styles
  const getEyeStyles = () => {
    let pupilX = 0;
    let pupilY = 0;
    let eyeScaleY = blink ? 0.08 : 1;
    let eyeScaleX = 1;
    let eyeRotationL = 0;
    let eyeRotationR = 0;
    let eyeColor = 'from-cyan-400 via-sky-300 to-blue-500';
    let glowColor = 'rgba(6, 182, 212, 0.6)';
    let eyeShape = 'rounded-3xl';
    let statusLabel = 'ROBONAV READY';
    let statusSub = 'NORMAL TURTLE MODE';

    switch (internalExpr) {
      case 'FORWARD':
        pupilX = 0;
        pupilY = -2;
        eyeScaleX = 1.05;
        eyeScaleY = blink ? 0.08 : 1.0;
        statusLabel = 'MOVING FORWARD';
        statusSub = speedMode === 'BOOST' ? 'ACCELERATION BOOST ACTIVE' : 'TURTLE MODE (SLOW)';
        break;

      case 'REVERSE':
        pupilX = subtleScan !== 0 ? subtleScan : -8;
        pupilY = 6;
        eyeRotationL = 5;
        eyeRotationR = -5;
        eyeColor = 'from-amber-400 via-yellow-300 to-orange-500';
        glowColor = 'rgba(245, 158, 11, 0.6)';
        statusLabel = 'LOOKING BACK';
        statusSub = 'OBSERVING REAR TRAJECTORY';
        break;

      case 'TURN_LEFT':
        pupilX = -14;
        pupilY = 0;
        eyeRotationL = -6;
        eyeRotationR = -6;
        statusLabel = 'TURNING LEFT';
        statusSub = 'OBSERVING LEFT ARC';
        break;

      case 'TURN_RIGHT':
        pupilX = 14;
        pupilY = 0;
        eyeRotationL = 6;
        eyeRotationR = 6;
        statusLabel = 'TURNING RIGHT';
        statusSub = 'OBSERVING RIGHT ARC';
        break;

      case 'U_TURN_LEFT':
        pupilX = -18;
        pupilY = 2;
        eyeRotationL = -10;
        eyeRotationR = -10;
        statusLabel = 'U-TURN LEFT';
        statusSub = 'HOLDING LEFT U-TURN ARC';
        break;

      case 'U_TURN_RIGHT':
        pupilX = 18;
        pupilY = 2;
        eyeRotationL = 10;
        eyeRotationR = 10;
        statusLabel = 'U-TURN RIGHT';
        statusSub = 'HOLDING RIGHT U-TURN ARC';
        break;

      case 'OBSTACLE':
        pupilX = subtleScan;
        pupilY = -4;
        eyeScaleX = 1.15;
        eyeScaleY = blink ? 0.08 : 1.15;
        eyeColor = 'from-amber-300 via-yellow-200 to-amber-500';
        glowColor = 'rgba(251, 191, 36, 0.7)';
        statusLabel = 'OBSERVING';
        statusSub = 'FRONT OBSTACLE DETECTED';
        break;

      case 'ALERT':
        pupilX = 0;
        pupilY = 0;
        eyeScaleX = 1.1;
        eyeScaleY = blink ? 0.08 : 0.65;
        eyeRotationL = 12;
        eyeRotationR = -12;
        eyeColor = 'from-orange-500 via-amber-400 to-red-500';
        glowColor = 'rgba(249, 115, 22, 0.8)';
        statusLabel = 'OBSTACLE!';
        statusSub = 'CLOSE PROXIMITY CAUTION';
        break;

      case 'E_STOP':
        pupilX = 0;
        pupilY = 0;
        eyeScaleX = 0.95;
        eyeScaleY = blink ? 0.08 : 0.55;
        eyeRotationL = 18;
        eyeRotationR = -18;
        eyeColor = 'from-red-600 via-rose-500 to-red-700';
        glowColor = 'rgba(239, 68, 68, 0.9)';
        statusLabel = 'STOP!';
        statusSub = 'EMERGENCY BRAKE ENGAGED';
        break;

      case 'ARRIVED':
        pupilX = 0;
        pupilY = -6;
        eyeScaleY = blink ? 0.08 : 0.85;
        eyeShape = 'rounded-t-full rounded-b-lg';
        eyeColor = 'from-emerald-400 via-teal-300 to-green-500';
        glowColor = 'rgba(16, 185, 129, 0.7)';
        statusLabel = 'ARRIVED!';
        statusSub = 'DESTINATION REACHED';
        break;

      case 'OFFLINE':
        pupilX = 0;
        pupilY = 4;
        eyeScaleY = blink ? 0.08 : 0.45;
        eyeRotationL = -14;
        eyeRotationR = 14;
        eyeColor = 'from-slate-400 via-gray-300 to-slate-500';
        glowColor = 'rgba(148, 163, 184, 0.4)';
        statusLabel = 'OFFLINE';
        statusSub = 'WAITING FOR ROBOT WI-FI';
        break;

      case 'HAPPY':
      case 'IDLE':
      default:
        pupilX = 0;
        pupilY = 0;
        eyeScaleX = 1.0;
        eyeScaleY = blink ? 0.08 : 1.0;
        statusLabel = 'ROBONAV';
        statusSub = speedMode === 'BOOST' ? 'BOOST ACTIVE' : 'TURTLE MODE (SLOW)';
        break;
    }

    return {
      pupilX,
      pupilY,
      eyeScaleX,
      eyeScaleY,
      eyeRotationL,
      eyeRotationR,
      eyeColor,
      glowColor,
      eyeShape,
      statusLabel,
      statusSub,
    };
  };

  const currentStyles = getEyeStyles();

  // Size scaling dimensions
  const dims = {
    sm: { container: 'w-40 h-24', eyeW: 'w-10', eyeH: 'h-14', pupil: 'w-5 h-7', gap: 'gap-3' },
    md: { container: 'w-56 h-32', eyeW: 'w-14', eyeH: 'h-20', pupil: 'w-7 h-10', gap: 'gap-4' },
    lg: { container: 'w-72 h-40', eyeW: 'w-18', eyeH: 'h-26', pupil: 'w-9 h-13', gap: 'gap-6' },
    xl: { container: 'w-96 h-52', eyeW: 'w-24', eyeH: 'h-34', pupil: 'w-12 h-18', gap: 'gap-8' },
  }[size];

  return (
    <div className="flex flex-col items-center select-none">
      {/* 1.3" OLED Bezel Frame */}
      <div
        className={`relative ${dims.container} ${
          showOledBezel
            ? 'bg-gradient-to-b from-slate-950 to-black p-3 rounded-2xl border-2 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] ring-1 ring-white/10'
            : ''
        } flex flex-col items-center justify-center overflow-hidden`}
      >
        {/* Subtle OLED Glass Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

        {/* OLED Screen Label */}
        {showOledBezel && (
          <div className="absolute top-1.5 left-3 right-3 flex items-center justify-between text-[8px] font-mono tracking-widest text-cyan-500/60 font-bold uppercase pointer-events-none">
            <span>1.3" OLED SCREEN</span>
            <span>SH1106 / 0x3C</span>
          </div>
        )}

        {/* Eyes Row */}
        <div className={`relative z-10 flex items-center justify-center ${dims.gap} mt-2`}>
          {/* Left Eye */}
          <div
            className={`relative ${dims.eyeW} ${dims.eyeH} ${currentStyles.eyeShape} bg-gradient-to-br ${currentStyles.eyeColor} transition-all duration-200 ease-out flex items-center justify-center shadow-lg overflow-hidden`}
            style={{
              transform: `scaleX(${currentStyles.eyeScaleX}) scaleY(${currentStyles.eyeScaleY}) rotate(${currentStyles.eyeRotationL}deg)`,
              boxShadow: `0 0 25px ${currentStyles.glowColor}, inset 0 0 10px rgba(255,255,255,0.4)`,
            }}
          >
            {/* Animated Inner Pupil */}
            <div
              className={`absolute ${dims.pupil} rounded-full bg-slate-950/80 transition-all duration-150 ease-out flex items-center justify-center`}
              style={{
                transform: `translate(${currentStyles.pupilX}px, ${currentStyles.pupilY}px)`,
              }}
            >
              {/* Highlight Glint */}
              <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90 -translate-x-1 -translate-y-1" />
            </div>

            {/* Arrived celebration sparkles */}
            {internalExpr === 'ARRIVED' && (
              <Sparkles className="absolute text-amber-200 animate-spin w-4 h-4 pointer-events-none" />
            )}
            {/* E-Stop warning icon */}
            {internalExpr === 'E_STOP' && (
              <AlertTriangle className="absolute text-white animate-pulse w-4 h-4 pointer-events-none" />
            )}
          </div>

          {/* Right Eye */}
          <div
            className={`relative ${dims.eyeW} ${dims.eyeH} ${currentStyles.eyeShape} bg-gradient-to-br ${currentStyles.eyeColor} transition-all duration-200 ease-out flex items-center justify-center shadow-lg overflow-hidden`}
            style={{
              transform: `scaleX(${currentStyles.eyeScaleX}) scaleY(${currentStyles.eyeScaleY}) rotate(${currentStyles.eyeRotationR}deg)`,
              boxShadow: `0 0 25px ${currentStyles.glowColor}, inset 0 0 10px rgba(255,255,255,0.4)`,
            }}
          >
            {/* Animated Inner Pupil */}
            <div
              className={`absolute ${dims.pupil} rounded-full bg-slate-950/80 transition-all duration-150 ease-out flex items-center justify-center`}
              style={{
                transform: `translate(${currentStyles.pupilX}px, ${currentStyles.pupilY}px)`,
              }}
            >
              {/* Highlight Glint */}
              <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90 -translate-x-1 -translate-y-1" />
            </div>

            {/* Arrived celebration sparkles */}
            {internalExpr === 'ARRIVED' && (
              <Sparkles className="absolute text-amber-200 animate-spin w-4 h-4 pointer-events-none" />
            )}
            {/* E-Stop warning icon */}
            {internalExpr === 'E_STOP' && (
              <AlertTriangle className="absolute text-white animate-pulse w-4 h-4 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Screen Bottom Status Text */}
        <div className="absolute bottom-1.5 text-[9px] font-mono font-black tracking-wider text-cyan-300 drop-shadow flex items-center gap-1 uppercase pointer-events-none">
          <span>{currentStyles.statusLabel}</span>
        </div>
      </div>

      {/* Optional User-Facing Label Badge */}
      {showLabel && (
        <div className="mt-2 flex flex-col items-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-wide">
            <span
              className={`w-2 h-2 rounded-full ${
                internalExpr === 'E_STOP'
                  ? 'bg-red-500 animate-ping'
                  : internalExpr === 'ALERT'
                  ? 'bg-amber-500 animate-pulse'
                  : internalExpr === 'ARRIVED'
                  ? 'bg-emerald-400'
                  : internalExpr === 'OFFLINE'
                  ? 'bg-gray-500'
                  : 'bg-cyan-400'
              }`}
            />
            <span>{currentStyles.statusLabel}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">
              {speedMode}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono mt-0.5">{currentStyles.statusSub}</span>
        </div>
      )}

      {/* Interactive Expression Selector (for debugging / testing) */}
      {interactive && (
        <div className="mt-3 flex flex-wrap justify-center gap-1 max-w-sm">
          {(
            [
              'FORWARD',
              'REVERSE',
              'TURN_LEFT',
              'TURN_RIGHT',
              'U_TURN_LEFT',
              'U_TURN_RIGHT',
              'OBSTACLE',
              'ALERT',
              'E_STOP',
              'ARRIVED',
              'OFFLINE',
              'IDLE',
            ] as EyeExpression[]
          ).map((exp) => (
            <button
              key={exp}
              onClick={() => setInternalExpr(exp)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-all ${
                internalExpr === exp
                  ? 'bg-cyan-500 text-black border-cyan-400 font-black'
                  : 'bg-slate-900/60 text-gray-400 border-white/10 hover:border-cyan-500/40'
              }`}
            >
              {exp}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DirectionalRobotEyes;
