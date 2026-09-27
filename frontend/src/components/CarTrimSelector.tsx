import { useCarTrim, CarTrim } from '../context/CarTrimContext';
import { Flame, Sparkles, Award } from 'lucide-react';

export const CarTrimSelector = () => {
  const { trim, setTrim, config } = useCarTrim();

  const trimsList: { id: CarTrim; label: string; icon: any; color: string; desc: string }[] = [
    {
      id: 'pagani',
      label: 'Pagani Huayra R',
      icon: Sparkles,
      color: '#06b6d4',
      desc: 'V12-R Titanium Carbon'
    },
    {
      id: 'hellcat',
      label: 'SRT Hellcat Redeye',
      icon: Flame,
      color: '#ef4444',
      desc: 'Supercharged 6.2L HEMI'
    },
    {
      id: 'mustang',
      label: 'Mustang Shelby GT500',
      icon: Award,
      color: '#3b82f6',
      desc: 'Track Pack Carbon Splitter'
    }
  ];

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-white/10 shadow-lg">
      <span className="text-[10px] uppercase font-bold text-gray-400 px-2 hidden lg:inline">
        Chassis Trim:
      </span>
      {trimsList.map((t) => {
        const Icon = t.icon;
        const isSelected = trim === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTrim(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              isSelected
                ? 'bg-slate-800 text-white shadow-md border border-white/20'
                : 'text-gray-400 hover:text-white hover:bg-slate-900/60'
            }`}
            style={{
              color: isSelected ? t.color : undefined,
              boxShadow: isSelected ? `0 0 14px ${t.color}35` : undefined
            }}
            title={t.desc}
          >
            <Icon size={14} style={{ color: isSelected ? t.color : undefined }} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
