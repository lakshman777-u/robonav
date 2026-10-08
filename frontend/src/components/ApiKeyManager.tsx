import { useState, useEffect } from 'react';
import { generateApiKey, revokeApiKey, regenerateApiKey, getRobotStatus } from '../services/api';
import { Key, Eye, EyeOff, Copy, RefreshCw, Trash2, Cpu, Wifi, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const ApiKeyManager = ({ robotId = 'ESP32CAM-001' }: { robotId?: string }) => {
  const { robotStatus, wsConnected } = useRobotStatus();
  const [key, setKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const isOnline = robotStatus?.connection_status === 'ONLINE';

  useEffect(() => {
    // Check initial status
    getRobotStatus(robotId).then(() => {
      setIsAuthenticated(true);
    }).catch(() => {
      setIsAuthenticated(false);
    });
  }, [robotId]);

  const handleGenerate = async () => {
    try {
      const res = await generateApiKey(robotId);
      setKey(res.data.api_key || res.data.key);
      setIsAuthenticated(true);
      toast.success('API key generated for ESP32-CAM');
    } catch (e) {
      toast.error('Failed to generate key');
    }
  };

  const handleRegenerate = async () => {
    try {
      const res = await regenerateApiKey(robotId);
      setKey(res.data.api_key || res.data.key);
      setIsAuthenticated(true);
      toast.success('API key regenerated');
    } catch (e) {
      toast.error('Failed to regenerate key');
    }
  };

  const handleRevoke = async () => {
    try {
      await revokeApiKey(robotId);
      setKey(null);
      setIsAuthenticated(false);
      toast.success('API key revoked');
    } catch (e) {
      toast.error('Failed to revoke key');
    }
  };

  const copy = () => {
    if (key) {
      navigator.clipboard.writeText(key);
      toast.success('API Key copied to clipboard');
    } else {
      toast.error('Generate a key first');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-6">
      {/* Background carbon styling */}
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Cpu size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-wider uppercase flex items-center gap-2">
              ROBOT CONNECTION
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              ESP32-CAM Embedded Hardware Authentication Vault
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-mono font-bold">
              <CheckCircle2 size={13} /> ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono font-bold">
              <XCircle size={13} /> OFFLINE
            </span>
          )}
        </div>
      </div>

      {/* Robot Specifications Table */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
        <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 flex justify-between items-center">
          <span className="text-gray-400">Robot Type:</span>
          <span className="font-bold text-cyan-400">ESP32-CAM</span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 flex justify-between items-center">
          <span className="text-gray-400">Robot Name:</span>
          <span className="font-bold text-white">Autonomous Robot 01</span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 flex justify-between items-center">
          <span className="text-gray-400">Robot ID:</span>
          <span className="font-bold text-cyan-300">ESP32CAM-001</span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 flex justify-between items-center">
          <span className="text-gray-400">Authentication:</span>
          <span className={`font-bold ${isAuthenticated ? 'text-green-400' : 'text-red-400'}`}>
            {isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}
          </span>
        </div>
      </div>

      {/* API Key Box */}
      <div className="relative z-10 space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-mono font-bold text-gray-300 flex items-center gap-1.5">
            <Key size={14} className="text-amber-400" /> API Key (Robot Secret Credential):
          </label>
          <span className="text-[10px] font-mono text-gray-500">
            Never committed to Git or exposed in client bundles
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/90 p-3 rounded-xl font-mono text-xs border border-white/10 shadow-inner">
          <span className="flex-1 tracking-wider text-cyan-300 truncate">
            {key ? (visible ? key : '••••••••••••••••••••••••••••••••') : '••••••••••••••••••••'}
          </span>

          <button
            onClick={() => setVisible(!visible)}
            className="p-2 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white transition-colors"
            title={visible ? 'Hide Key' : 'Reveal Key'}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          <button
            onClick={copy}
            className="p-2 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Copy API Key"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Buttons Row */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            onClick={handleGenerate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-mono tracking-wider transition-all shadow-md flex items-center gap-2"
          >
            <Key size={14} /> GENERATE API KEY
          </button>

          <button
            onClick={copy}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border border-white/10 flex items-center gap-2"
          >
            <Copy size={14} /> COPY API KEY
          </button>

          <button
            onClick={() => setVisible(!visible)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border border-white/10 flex items-center gap-2"
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />} {visible ? 'HIDE KEY' : 'REVEAL KEY'}
          </button>

          <button
            onClick={handleRegenerate}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl text-xs font-bold font-mono tracking-wider transition-all border border-white/10 flex items-center gap-2"
          >
            <RefreshCw size={14} /> REGENERATE KEY
          </button>

          <button
            onClick={handleRevoke}
            className="px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center gap-2"
          >
            <Trash2 size={14} /> REVOKE KEY
          </button>
        </div>
      </div>

      {/* ESP32-CAM Setup Instructions */}
      <div className="relative z-10 p-4 rounded-xl bg-slate-950/60 border border-white/10 font-mono text-xs space-y-2">
        <div className="text-gray-300 font-bold flex items-center gap-2">
          <Wifi size={14} className="text-cyan-400" />
          <span>ESP32-CAM Firmware Configuration:</span>
        </div>
        <p className="text-gray-400 text-[11px]">
          Copy the generated API key and configure your ESP32-CAM in <code className="text-cyan-300">esp32_robot/src/config.h</code>:
        </p>
        <pre className="p-3 bg-black/60 rounded-lg text-green-400 text-[11px] overflow-x-auto border border-white/5">
{`ROBOT_ID="ESP32CAM-001"
ROBOT_API_KEY="${key || 'your_generated_key'}"
SERVER_IP="192.168.1.100"
SERVER_PORT=8000`}
        </pre>
      </div>
    </div>
  );
};
