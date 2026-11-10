import { useState } from 'react';
import { SlamVideoGuide } from '../components/SlamVideoGuide';
import { Video, Shield, Info, CheckCircle2, Navigation, Compass, Flag, Sliders, Play, Layers } from 'lucide-react';

export const VideoTutorials = () => {
  const [activeTab, setActiveTab] = useState<'video' | 'guide'>('video');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-dark-card border border-dark-border p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Video size={16} /> Official 2D SLAM & Multi-Room Video Guide
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            2D SLAM Mapping, Multi-Room Flags & Autonomous Navigation Guide
          </h2>
          <p className="text-sm text-gray-400 mt-1 max-w-3xl">
            Interactive visual tutorial and operational reference: Learn how to scan with SLAM Toolbox, prevent overlapping walls, drive forward/backward, arrange Flags 1–5, select rooms, and execute the 5-step mapping workflow.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'video' ? 'bg-red-600 text-white shadow-lg shadow-red-950/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Video size={16} /> Interactive Video Guide
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'guide' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield size={16} /> Step-by-Step Operator Manual
          </button>
        </div>
      </div>

      {/* Main Video Guide */}
      <div className="space-y-6">
        <SlamVideoGuide />

        {/* 6 Essential Operational Chapters / Summary Cards */}
        <div className="bg-dark-card border border-dark-border p-6 rounded-2xl space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h4 className="text-lg font-black text-white flex items-center gap-2">
                <Info className="text-red-400" size={20} />
                Mastering the 2D SLAM & Multi-Room Navigation System
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Complete reference addressing all 6 stages of robot setup, LiDAR scanning, and 5-room autonomous navigation.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
              6 CHAPTERS • 60 FPS INTERACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            {/* 1. SLAM Toolbox Scan */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <Compass size={16} />
                <span>1. SLAM TOOLBOX SCAN</span>
              </div>
              <p className="text-gray-300 font-sans text-xs">
                Ensure the YDLIDAR X2 motor cable is facing <strong>North (Forward)</strong>. The sensor pulses 360 rays @ 11.9 Hz across the <code className="text-red-300">/scan</code> ROS 2 topic, displaying glowing red obstacle reflection dots.
              </p>
            </div>

            {/* 2. Non-Overlapping Walls */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Layers size={16} />
                <span>2. NON-OVERLAPPING WALLS</span>
              </div>
              <p className="text-gray-300 font-sans text-xs">
                Walls never shift or duplicate because all LiDAR rays transform into a fixed global world frame with origin at <code className="text-cyan-300">(-15, -15)m</code>. Robot odometry accumulates cleanly without tearing.
              </p>
            </div>

            {/* 3. Forward & Backward Drive */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Sliders size={16} />
                <span>3. DRIVE CONTROLS (W / S / A / D)</span>
              </div>
              <p className="text-gray-300 font-sans text-xs">
                Drive forward with <strong>W / ▲</strong>, backward with <strong>S / ▼</strong>, turn left with <strong>A / ◀</strong>, and turn right with <strong>D / ▶</strong>. Toggle Turtle (0.2 m/s) or Boost (0.6 m/s) and use E-Stop for emergency brakes.
              </p>
            </div>

            {/* 4. Arrange Flags 1 to 5 */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Flag size={16} />
                <span>4. ARRANGE FLAGS 1–5 IN ORDER</span>
              </div>
              <p className="text-gray-300 font-sans text-xs">
                Drive to each target or click the 2D canvas: <strong>Flag 1</strong> (Room 1 Entrance), <strong>Flag 2</strong> (Room 2 Living), <strong>Flag 3</strong> (Room 3 Dining), <strong>Flag 4</strong> (Room 4 Kitchen), <strong>Flag 5</strong> (Room 5 Master Bed).
              </p>
            </div>

            {/* 5. Room 1–5 Navigation */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Navigation size={16} />
                <span>5. ROOM 1–5 AUTONOMOUS NAV</span>
              </div>
              <p className="text-gray-300 font-sans text-xs">
                Click any room button to launch autonomous navigation. The A* global planner renders a cyan ribbon around obstacles, guides the user, waits 5 minutes at the destination, and returns automatically to <code className="text-purple-300">HOME (0,0)</code>.
              </p>
            </div>

            {/* 6. 5-Step Order & Save */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 hover:border-red-500/40 transition-colors">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Play size={16} />
                <span>6. 5-STEP MASTER ORDER</span>
              </div>
              <p className="text-gray-300 font-sans text-xs">
                Follow the strict sequence: <strong>1. START MAPPING</strong> → <strong>2. PAUSE</strong> (if aligning) → <strong>3. STOP MAPPING</strong> → <strong>4. SAVE MAP</strong> (commits to disk/database) → <strong>5. CLEAR / DELETE ALL</strong> (when resetting).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
