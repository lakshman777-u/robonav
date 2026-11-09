import { useState, useEffect, useRef } from 'react';
import { Camera, Radio, Maximize2, Minimize2, VideoOff, ShieldAlert, Cpu } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';

export const LiveCamera = () => {
  const { robotStatus, sensorData, simulationMode } = useRobotStatus();
  const { config } = useCarTrim();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [streamError, setStreamError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [streamSource, setStreamSource] = useState<'proxy' | 'direct'>('proxy');
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const robotIp = robotStatus?.ip || '';

  // Auto-reconnect stream if an error occurs
  useEffect(() => {
    if (streamError) {
      const timer = setTimeout(() => {
        setStreamError(false);
        setRetryKey(k => k + 1);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [streamError]);

  // Determine if stream is truly active
  const isOnline = robotStatus?.connection_status === 'ONLINE' || simulationMode;
  const isStreaming = true; // Stream generator provides live or standby frames
  const fps = sensorData?.camera?.fps || (isStreaming ? (simulationMode ? 24 : 15) : 0);
  const resolution = sensorData?.camera?.resolution || '640x480 (VGA)';

  // Live timestamp clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString() + '.' + String(now.getMilliseconds()).padStart(3, '0').slice(0, 2));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Synthetic POV rendering for simulation / demo fallback
  useEffect(() => {
    if (!simulationMode || streamError === false) {
      // If native MJPEG stream is working, native img will display it
    }

    const canvas = canvasRef.current;
    if (!canvas || !simulationMode) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderSyntheticPov = () => {
      const w = canvas.width;
      const h = canvas.height;
      phase += (robotStatus?.velocity || 0.1) * 4;

      // Dark futuristic corridor perspective
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, w, h * 0.5);

      // Floor
      const floorGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
      floorGrad.addColorStop(0, '#090d1a');
      floorGrad.addColorStop(1, '#020408');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      // Horizon line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();

      // Vanishing point perspective lines
      const vpx = w * 0.5 + Math.sin((robotStatus?.orientation || 0) * Math.PI / 180) * 40;
      const vpy = h * 0.5;

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = -200; x <= w + 200; x += 60) {
        ctx.beginPath();
        ctx.moveTo(vpx, vpy);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Moving floor stripes
      ctx.strokeStyle = '#141e33';
      const offset = phase % 30;
      for (let y = h * 0.5; y < h; y += 18) {
        const curY = y + (offset * (y - h * 0.5)) / (h * 0.5);
        if (curY < h) {
          ctx.beginPath();
          ctx.moveTo(0, curY);
          ctx.lineTo(w, curY);
          ctx.stroke();
        }
      }

      // Bumper HUD
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(w * 0.28, h);
      ctx.lineTo(w * 0.36, h * 0.84);
      ctx.lineTo(w * 0.64, h * 0.84);
      ctx.lineTo(w * 0.72, h);
      ctx.fill();
      ctx.strokeStyle = config.primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Central crosshair reticle
      ctx.strokeStyle = `${config.primaryColor}80`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(vpx, vpy, 16, 0, Math.PI * 2);
      ctx.moveTo(vpx - 24, vpy);
      ctx.lineTo(vpx + 24, vpy);
      ctx.moveTo(vpx, vpy - 24);
      ctx.lineTo(vpx, vpy + 24);
      ctx.stroke();

      animId = requestAnimationFrame(renderSyntheticPov);
    };

    animId = requestAnimationFrame(renderSyntheticPov);
    return () => cancelAnimationFrame(animId);
  }, [simulationMode, robotStatus, config.primaryColor]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`glass-panel rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-black' : 'h-full w-full'
      }`}
    >
      {/* Carbon Texture */}
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Top Video Header & Badges */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2.5 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600/20 border border-red-500/40 text-[10px] font-mono font-bold text-red-400">
            <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-500 animate-ping' : 'bg-gray-500'}`} />
            <span>{isStreaming ? 'LIVE' : 'STANDBY'}</span>
          </div>

          <h3 className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-2">
            <Camera size={14} style={{ color: config.primaryColor }} />
            <span>LIVE ROBOT CAMERA</span>
            <span className="text-[10px] font-mono text-cyan-400/90 font-normal">
              // ESP32-CAM VIDEO
            </span>
          </h3>
        </div>

        {/* Telemetry Chips (FPS, Res, Time, Fullscreen) */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          {robotIp && (
            <button
              onClick={() => {
                setStreamSource(s => s === 'proxy' ? 'direct' : 'proxy');
                setStreamError(false);
                setRetryKey(k => k + 1);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                streamSource === 'direct'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
              }`}
              title={streamSource === 'direct' ? 'Streaming directly from ESP32 IP' : 'Streaming proxied via laptop backend'}
            >
              {streamSource === 'direct' ? `ESP32 (${robotIp})` : 'PROXY'}
            </button>
          )}
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
            {fps} FPS
          </span>
          <span className="hidden sm:inline px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
            {resolution}
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
            {currentTime}
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Video Content Canvas / Stream View */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {/* Real Video Stream from PC MJPEG Endpoint or Direct ESP32 Stream */}
        {!simulationMode ? (
          <>
            <img
              key={`stream-${retryKey}-${streamSource}`}
              src={streamSource === 'direct' && robotIp ? `http://${robotIp}:80/stream` : `/api/robot/video?_t=${retryKey}`}
              alt="ESP32-CAM Live Stream"
              className="w-full h-full object-cover"
              onError={() => setStreamError(true)}
            />

            {streamError && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-30">
                <VideoOff size={32} className="text-amber-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white tracking-wide">CONNECTING TO CAMERA STREAM...</span>
                <span className="text-[10px] font-mono text-gray-400">Reconnecting automatically...</span>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => { setStreamError(false); setRetryKey(k => k + 1); }}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
                  >
                    Retry Now
                  </button>
                  {robotIp && (
                    <button
                      onClick={() => {
                        setStreamSource(s => s === 'proxy' ? 'direct' : 'proxy');
                        setStreamError(false);
                        setRetryKey(k => k + 1);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-bold transition-all active:scale-95"
                    >
                      Try {streamSource === 'proxy' ? 'Direct ESP32' : 'Backend Proxy'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Simulated POV Canvas in Simulation Mode */
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="w-full h-full object-cover"
          />
        )}

        {/* In-Video HUD Overlays */}
        <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1.5 z-10">
          <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white flex items-center gap-2">
            <Radio size={12} className="text-green-400 animate-pulse" />
            <span>LINK: {simulationMode ? 'SIMULATED POV' : (streamSource === 'direct' ? `ESP32 DIRECT (${robotIp})` : 'ESP32-CAM (OV2640)')}</span>
          </div>

              {sensorData?.camera?.obstacle_detected && (
                <div className="px-2.5 py-1 rounded-lg bg-red-950/80 backdrop-blur-md border border-red-500 text-[10px] font-mono text-red-300 flex items-center gap-2 animate-bounce">
                  <ShieldAlert size={12} className="text-red-400" />
                  <span>OBSTACLE DETECTED ({sensorData.camera.obstacle_type || 'HAZARD'})</span>
                </div>
              )}
            </div>

            {/* Bottom HUD: Coordinates & Compass Heading */}
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none flex justify-between items-center z-10">
              <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-300">
                X: {(robotStatus?.position.x || 0).toFixed(2)}m | Y: {(robotStatus?.position.y || 0).toFixed(2)}m
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-amber-300">
                θ: {(robotStatus?.orientation || 0).toFixed(1)}°
              </div>
            </div>
      </div>
    </div>
  );
};
