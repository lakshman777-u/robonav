import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCarTrim } from '../context/CarTrimContext';
import { CarTrimSelector } from '../components/CarTrimSelector';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield, KeyRound, Cpu, Gauge, Zap } from 'lucide-react';

export const Login = () => {
  const { login, isAuthenticated, role, isAdmin } = useAuth();
  const { config } = useCarTrim();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={(role === 'admin' || isAdmin) ? '/admin' : '/user'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success(`Access Granted: ${username.toUpperCase()}`);
    } catch (err) {
      toast.error('Authentication Failed: Invalid Credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setLoading(true);
    try {
      await login(u, p);
      toast.success(`Connected as ${u.toUpperCase()}`);
    } catch (err) {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      {/* Central Glassmorphic Hypercar Cockpit Portal */}
      <div className="glass-panel w-full max-w-lg p-8 rounded-3xl relative overflow-hidden shadow-2xl border border-white/10">
        {/* Subtle Carbon Pattern */}
        <div className="absolute inset-0 bg-carbon-pattern opacity-40 pointer-events-none" />

        {/* Top Trim Selector */}
        <div className="relative z-10 flex justify-center mb-6">
          <CarTrimSelector />
        </div>

        {/* Supercar Header Badge */}
        <div className="relative z-10 text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest text-gray-400">
            <Cpu size={14} style={{ color: config.primaryColor }} />
            <span>ROBONAV TELEMETRY OS // {config.badge}</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white flex items-center justify-center gap-3">
            <span>ROBONAV</span>
            <span
              className="px-2.5 py-0.5 rounded-lg text-sm font-black tracking-widest uppercase bg-white/10 border border-white/10"
              style={{ color: config.primaryColor, textShadow: `0 0 16px ${config.primaryColor}` }}
            >
              V12 HYPERCAR
            </span>
          </h1>

          <p className="text-xs text-gray-400 font-mono">
            Autonomous Indoor Navigation & 2D SLAM Cockpit Console
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Pilot / Operator ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter pilot username..."
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder:text-gray-600"
                style={{
                  boxShadow: username ? `0 0 15px ${config.primaryColor}20` : undefined,
                  borderColor: username ? config.primaryColor : undefined
                }}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
              Access Encryption Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all placeholder:text-gray-600"
                style={{
                  boxShadow: password ? `0 0 15px ${config.primaryColor}20` : undefined,
                  borderColor: password ? config.primaryColor : undefined
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wider uppercase text-white transition-all duration-200 shadow-xl flex items-center justify-center gap-2 group disabled:opacity-50"
            style={{
              backgroundColor: config.primaryColor,
              boxShadow: `0 0 24px ${config.primaryColor}50`
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Gauge className="animate-spin" size={18} /> Initializing Cockpit Telemetry...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <KeyRound size={18} /> Ignite System & Engage
              </span>
            )}
          </button>
        </form>

        {/* 1-Click Fast Track Pilot Buttons */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10">
          <div className="text-[11px] font-mono text-gray-400 text-center mb-3">
            QUICK ACCESS DEMO CREDENTIALS
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="p-3 bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-cyan-500/40 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                <Shield size={14} /> Administrator
              </div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">admin / admin123</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('user', 'user123')}
              className="p-3 bg-slate-950/70 hover:bg-slate-900 border border-white/10 hover:border-green-500/40 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-2 text-green-400 font-bold text-xs">
                <Zap size={14} /> Operator
              </div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">user / user123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
