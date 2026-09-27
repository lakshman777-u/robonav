import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CarTrim = 'pagani' | 'hellcat' | 'mustang';

export interface TrimConfig {
  id: CarTrim;
  name: string;
  subtitle: string;
  badge: string;
  primaryColor: string; // Tailwind color class or hex
  accentColor: string;
  glowClass: string;
  accentBorder: string;
  textColor: string;
  bgGlow: string;
  topSpeedScaled: string;
  hpOutput: string;
}

export const TRIMS: Record<CarTrim, TrimConfig> = {
  pagani: {
    id: 'pagani',
    name: 'Pagani Huayra R',
    subtitle: 'V12-R Atmosferico Aero Edition',
    badge: 'PAGANI ARTE & SCIENZA',
    primaryColor: '#06b6d4', // Cyan
    accentColor: '#f59e0b',  // Gold
    glowClass: 'glass-panel-glow-cyan',
    accentBorder: 'border-cyan-500/40',
    textColor: 'text-cyan-400',
    bgGlow: 'rgba(6, 182, 212, 0.12)',
    topSpeedScaled: '850 HP // 9,000 RPM',
    hpOutput: 'V12-R 6.0L NA'
  },
  hellcat: {
    id: 'hellcat',
    name: 'SRT Hellcat Redeye',
    subtitle: 'Supercharged 6.2L HEMI Demon Trim',
    badge: 'SRT HELLCAT SUPERCHARGED',
    primaryColor: '#ef4444', // Crimson Red
    accentColor: '#f97316',  // Amber
    glowClass: 'glass-panel-glow-red',
    accentBorder: 'border-red-500/40',
    textColor: 'text-red-400',
    bgGlow: 'rgba(239, 68, 68, 0.12)',
    topSpeedScaled: '797 HP // 2.7L Blower',
    hpOutput: '6.2L HEMI Supercharged'
  },
  mustang: {
    id: 'mustang',
    name: 'Shelby GT500 Cobra',
    subtitle: 'Carbon Fiber Track Pack Edition',
    badge: 'SHELBY GT500 COBRA',
    primaryColor: '#3b82f6', // Cobalt Blue
    accentColor: '#60a5fa',  // Sky Blue
    glowClass: 'glass-panel-glow-cyan',
    accentBorder: 'border-blue-500/40',
    textColor: 'text-blue-400',
    bgGlow: 'rgba(59, 130, 246, 0.12)',
    topSpeedScaled: '760 HP // Dual-Clutch',
    hpOutput: '5.2L Predator Supercharged'
  }
};

interface CarTrimContextType {
  trim: CarTrim;
  config: TrimConfig;
  setTrim: (trim: CarTrim) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
}

const CarTrimContext = createContext<CarTrimContextType | null>(null);

export const CarTrimProvider = ({ children }: { children: ReactNode }) => {
  const [trim, setTrimState] = useState<CarTrim>(() => {
    return (localStorage.getItem('robonav_car_trim') as CarTrim) || 'pagani';
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('robonav_sound') === 'true';
  });

  const setTrim = (newTrim: CarTrim) => {
    setTrimState(newTrim);
    localStorage.setItem('robonav_car_trim', newTrim);
  };

  useEffect(() => {
    localStorage.setItem('robonav_sound', soundEnabled ? 'true' : 'false');
  }, [soundEnabled]);

  return (
    <CarTrimContext.Provider value={{ trim, config: TRIMS[trim], setTrim, soundEnabled, setSoundEnabled }}>
      {children}
    </CarTrimContext.Provider>
  );
};

export const useCarTrim = () => {
  const ctx = useContext(CarTrimContext);
  if (!ctx) throw new Error('useCarTrim must be used within CarTrimProvider');
  return ctx;
};
