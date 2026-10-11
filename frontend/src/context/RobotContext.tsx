import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { wsService } from '../services/websocket';
import { RobotStatus, SensorData } from '../types/robot';
import { MapData } from '../types/map';
import { Destination } from '../types/navigation';
import toast from 'react-hot-toast';

export interface RobotContextType {
  robotStatus: RobotStatus | null;
  sensorData: SensorData | null;
  mapData: MapData | null;
  destinations: Destination[];
  navigationPath: any;
  logs: any[];
  wsConnected: boolean;
  simulationMode: boolean;
  demoMode: boolean;
  setSimulationMode: (enabled: boolean) => void;
  sendCommand: (command: string, params?: any) => void;
}

export const RobotContext = createContext<RobotContextType | null>(null);

export const RobotProvider = ({ children }: { children: ReactNode }) => {
  const auth = useContext(AuthContext);
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [_destinations, setDestinations] = useState<Destination[]>([]);
  const [_navigationPath, setNavigationPath] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);
  const [_demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (auth?.token) {
      wsService.connect(auth.token);
      
      const checkConn = setInterval(() => {
        setWsConnected(wsService.getState() === 'connected');
      }, 1000);

      const onStatus = (msg: any) => {
        if (msg.data) setRobotStatus(msg.data);
      };
      
      const onSensor = (msg: any) => {
        if (msg.data) setSensorData(msg.data);
      };
      
      const onMap = (msg: any) => {
        if (msg.data && msg.data.updates) {
          setMapData((prev) => {
            const width = prev?.width || 400;
            const height = prev?.height || 300;
            const newGrid = prev?.occupancy_grid ? [...prev.occupancy_grid] : new Array(width * height).fill(-1);
            msg.data.updates.forEach((u: {x: number, y: number, val: number}) => {
              const idx = u.y * width + u.x;
              if (idx >= 0 && idx < newGrid.length) {
                newGrid[idx] = u.val;
              }
            });
            const updated: MapData = {
              map_id: prev?.map_id || 'MAP-LIVE',
              name: prev?.name || 'Live SLAM Map',
              resolution: prev?.resolution || 0.05,
              width,
              height,
              origin: prev?.origin || { x: 0, y: 0 },
              occupancy_grid: newGrid,
              start_position: prev?.start_position || { x: 2.0, y: 2.0 },
              status: prev?.status || 'building'
            };
            return updated;
          });
        } else if (msg.data && msg.data.occupancy_grid) {
          setMapData(msg.data);
        }
      };
      
      const onLog = (msg: any) => {
        if (msg.data) setLogs(prev => [msg.data, ...prev].slice(0, 200));
      };

      const onConnLost = (msg: any) => {
        toast.error(msg.message || '⚠ ROBOT CONNECTION LOST');
      };

      wsService.onMessage('robot_status', onStatus);
      wsService.onMessage('sensor_data', onSensor);
      wsService.onMessage('map_update', onMap);
      wsService.onMessage('log_event', onLog);
      wsService.onMessage('robot_connection_lost', onConnLost);

      return () => {
        clearInterval(checkConn);
        wsService.disconnect();
      };
    }
  }, [auth?.token]);

  const sendCommand = (command: string, params?: any) => {
    wsService.send({ type: 'command', command, params });
  };

  return (
    <RobotContext.Provider value={{
      robotStatus,
      sensorData,
      mapData,
      destinations: _destinations,
      navigationPath: _navigationPath,
      logs,
      wsConnected,
      simulationMode,
      demoMode: _demoMode,
      setSimulationMode,
      sendCommand
    }}>
      {children}
    </RobotContext.Provider>
  );
};
