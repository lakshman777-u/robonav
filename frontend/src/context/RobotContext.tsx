import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { wsService } from '../services/websocket';
import { RobotStatus, SensorData } from '../types/robot';
import { MapData } from '../types/map';
import { Destination } from '../types/navigation';

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
  const [_simulationMode, setSimulationMode] = useState(false);
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
            if (!prev) return prev;
            const newGrid = [...prev.occupancy_grid];
            msg.data.updates.forEach((u: {x: number, y: number, val: number}) => {
              const idx = u.y * prev.width + u.x;
              if (idx >= 0 && idx < newGrid.length) {
                newGrid[idx] = u.val;
              }
            });
            return { ...prev, occupancy_grid: newGrid };
          });
        } else if (msg.data && msg.data.occupancy_grid) {
          // Fallback if full map is sent
          setMapData(msg.data);
        }
      };
      
      const onLog = (msg: any) => {
        if (msg.data) setLogs(prev => [msg.data, ...prev].slice(0, 200));
      };

      wsService.onMessage('robot_status', onStatus);
      wsService.onMessage('sensor_data', onSensor);
      wsService.onMessage('map_update', onMap);
      wsService.onMessage('log_event', onLog);

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
      simulationMode: _simulationMode,
      demoMode: _demoMode,
      sendCommand
    }}>
      {children}
    </RobotContext.Provider>
  );
};
