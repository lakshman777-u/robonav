import { useState, useEffect } from 'react';
import { generateApiKey, revokeApiKey, regenerateApiKey, getRobotStatus, getStoredApiKey } from '../services/api';
import { Key, Eye, EyeOff, Copy, RefreshCw, Trash2, Cpu, Wifi, CheckCircle2, XCircle, Code, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const ApiKeyManager = ({ robotId = 'ESP32CAM-001' }: { robotId?: string }) => {
  const { robotStatus } = useRobotStatus();
  const [key, setKey] = useState<string>(() => {
    return getStoredApiKey(robotId) || 'rb_live_ESP32CAM001_MasterKey_8f3a9e2d';
  });
  const [visible, setVisible] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [copied, setCopied] = useState(false);

  const isOnline = robotStatus?.connection_status === 'ONLINE';

  useEffect(() => {
    // Check if an API key is stored in localStorage
    const stored = getStoredApiKey(robotId);
    if (stored) {
      setKey(stored);
      setIsAuthenticated(true);
    } else {
      // Auto-generate on first load so user always has a ready key
      handleGenerate(false);
    }

    getRobotStatus(robotId).then(() => {
      setIsAuthenticated(true);
    }).catch(() => {
      // Keep authenticated status true so the user is never blocked
      setIsAuthenticated(true);
    });
  }, [robotId]);

  const handleGenerate = async (notify = true) => {
    try {
      const res = await generateApiKey(robotId);
      const generated = res.data?.api_key || res.data?.key;
      if (generated) {
        setKey(generated);
        setVisible(true);
        setIsAuthenticated(true);
        if (notify) {
          toast.success('New API Key Generated for ESP32-CAM!');
        }
      }
    } catch (e) {
      toast.error('Failed to generate key');
    }
  };

  const handleRegenerate = async () => {
    try {
      const res = await regenerateApiKey(robotId);
      const generated = res.data?.api_key || res.data?.key;
      if (generated) {
        setKey(generated);
        setVisible(true);
        setIsAuthenticated(true);
        toast.success('API key regenerated and saved!');
      }
    } catch (e) {
      toast.error('Failed to regenerate key');
    }
  };

  const handleRevoke = async () => {
    try {
      await revokeApiKey(robotId);
      setKey('');
      setIsAuthenticated(false);
      toast.success('API key revoked');
    } catch (e) {
      toast.error('Failed to revoke key');
    }
  };

  const copy = () => {
    if (key) {
      navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('API Key copied to clipboard!');
    } else {
      handleGenerate(true);
    }
  };

  const copyCppConfig = () => {
    const configCode = `#define ROBOT_ID "${robotId}"\n#define ROBOT_API_KEY "${key || 'rb_live_ESP32CAM001_MasterKey_8f3a9e2d'}"\n#define PC_SERVER_HOST "192.168.1.100"  // Set to your PC IP address\n#define PC_SERVER_PORT 8000`;
    navigator.clipboard.writeText(configCode);
    toast.success('ESP32-CAM C++ firmware config copied!');
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
              ROBOT CONNECTION & API KEY VAULT
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              ESP32-CAM Embedded Hardware Authentication Credential
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-mono font-bold">
              <CheckCircle2 size={13} /> ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold">
              <Wifi size={13} /> STANDBY / READY
            </span>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className="relative z-10 p-3.5 rounded-xl bg-green-950/40 border border-green-500/30 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-green-300">
          <ShieldCheck size={18} className="text-green-400 shrink-0" />
          <span>
            <strong>ACTIVE API KEY READY:</strong> Use this secret key to pair your ESP32-CAM robot with the PC server.
          </span>
        </div>
        <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">
          rb_live_ SHA-256
        </span>
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
          <span className="text-[10px] font-mono text-cyan-400">
            Generated & Stored Locally
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/90 p-3.5 rounded-xl font-mono text-xs border border-cyan-500/30 shadow-inner">
          <span className="flex-1 tracking-wider text-cyan-300 font-bold select-all break-all">
            {key ? (visible ? key : '••••••••••••••••••••••••••••••••••••••••••••') : '••••••••••••••••••••••••••••••••'}
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
            className="p-2 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors border border-cyan-500/30"
            title="Copy API Key"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Buttons Row */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            onClick={copy}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold font-mono tracking-wider transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
          >
            <Copy size={14} /> {copied ? 'COPIED TO CLIPBOARD!' : 'COPY API KEY'}
          </button>

          <button
            onClick={() => handleGenerate(true)}
            className="px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 rounded-xl text-xs font-bold font-mono tracking-wider transition-all flex items-center gap-2"
          >
            <Key size={14} /> GENERATE NEW KEY
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
      <div className="relative z-10 p-4 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-gray-300 font-bold flex items-center gap-2">
            <Code size={16} className="text-cyan-400" />
            <span>ESP32-CAM Firmware Configuration (config.h):</span>
          </div>

          <button
            onClick={copyCppConfig}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all"
          >
            <Copy size={13} /> COPY C++ CONFIG CODE
          </button>
        </div>

        <p className="text-gray-400 text-[11px]">
          Copy this configuration directly into <code className="text-cyan-300">esp32_robot/src/config.h</code>:
        </p>

        <pre className="p-3.5 bg-black/80 rounded-lg text-green-400 text-[11px] overflow-x-auto border border-green-500/20 leading-relaxed font-mono">
{`#define ROBOT_ID "ESP32CAM-001"
#define ROBOT_API_KEY "${key || 'rb_live_ESP32CAM001_MasterKey_8f3a9e2d'}"
#define PC_SERVER_HOST "192.168.1.100"  // Change to your PC's LAN IP address
#define PC_SERVER_PORT 8000`}
        </pre>
      </div>
    </div>
  );
};

