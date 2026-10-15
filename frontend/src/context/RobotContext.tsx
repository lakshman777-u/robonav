import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { wsService } from '../services/websocket';
import { RobotStatus, SensorData } from '../types/robot';
import { MapData } from '../types/map';
import { Destination } from '../types/navigation';
import { getDestinations, getCurrentMap, getRobotTelemetry } from '../services/api';
import { getToken } from '../services/auth';
import { updateOccupancyPixels } from '../utils/mapRenderer';
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
  reloadDestinations: () => Promise<void>;
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
  const [simulationMode, setSimulationMode] = useState(false);
  const [_demoMode, setDemoMode] = useState(false);

  const fetchDestinations = async () => {
    try {
      const res = await getDestinations();
      if (res.data && res.data.length > 0) {
        setDestinations(res.data);
      } else {
        setDestinations([
          { id: 1, name: 'Entrance', type: 'waypoint', x: 1.5, y: 1.5, status: 'active' },
          { id: 2, name: 'Room A', type: 'room', x: 4.0, y: 2.0, status: 'active' },
          { id: 3, name: 'Room B', type: 'room', x: 4.0, y: 6.0, status: 'active' },
          { id: 4, name: 'Charging Station', type: 'dock', x: 1.0, y: 1.0, status: 'active' }
        ]);
      }
    } catch (e) {
      setDestinations([
        { id: 1, name: 'Entrance', type: 'waypoint', x: 1.5, y: 1.5, status: 'active' },
        { id: 2, name: 'Room A', type: 'room', x: 4.0, y: 2.0, status: 'active' },
        { id: 3, name: 'Room B', type: 'room', x: 4.0, y: 6.0, status: 'active' },
        { id: 4, name: 'Charging Station', type: 'dock', x: 1.0, y: 1.0, status: 'active' }
      ]);
    }
  };

  useEffect(() => {
    fetchDestinations();

    // 1. Always connect WebSocket (authenticated token or fallback)
    const tokenToUse = auth?.token || getToken() || 'anonymous';
    wsService.connect(tokenToUse);
    
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
          const width = msg.data.width || prev?.width || 600;
          const height = msg.data.height || prev?.height || 600;
          updateOccupancyPixels(msg.data.updates, width, height);
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
            origin: prev?.origin || { x: msg.data.origin_x ?? -15.0, y: msg.data.origin_y ?? -15.0 },
            occupancy_grid: newGrid,
            start_position: prev?.start_position || { x: 0.0, y: 0.0 },
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
      console.warn('Robot connection notice:', msg.message);
    };

    const onDestUpdate = () => {
      fetchDestinations();
    };

    wsService.onMessage('robot_status', onStatus);
    wsService.onMessage('sensor_data', onSensor);
    wsService.onMessage('map_update', onMap);
    wsService.onMessage('log_event', onLog);
    wsService.onMessage('destination_update', onDestUpdate);
    wsService.onMessage('robot_connection_lost', onConnLost);

    // 2. Initial Map Load (single fetch on mount)
    getCurrentMap().then(res => {
      if (res?.data && res.data.occupancy_grid) {
        const md = res.data;
        setMapData({
          map_id: md.map_id || 'MAP-LIVE',
          name: md.name || 'Live SLAM Map',
          resolution: md.resolution || 0.05,
          width: md.width || 600,
          height: md.height || 600,
          origin: { x: md.origin_x ?? -15.0, y: md.origin_y ?? -15.0 },
          occupancy_grid: md.occupancy_grid,
          start_position: { x: 0.0, y: 0.0 },
          status: md.status || 'building'
        });
      }
    }).catch(() => {});

    // 3. Relaxed fallback HTTP telemetry sync only when WebSocket is not connected
    const syncHttpFallback = async () => {
      if (wsService.getState() === 'connected') return;
      try {
        const telemRes = await getRobotTelemetry();
        if (telemRes?.data) {
          const td = telemRes.data;
          setRobotStatus(prev => ({
            robot_id: td.robot_id || prev?.robot_id || 'ESP32DEVKIT-001',
            name: prev?.name || 'Autonomous Robot 01',
            robot_type: prev?.robot_type || 'ESP32-CAM',
            state: td.connection === 'ONLINE' ? (prev?.state || 'IDLE') : (prev?.state || 'IDLE'),
            connection_status: 'ONLINE',
            battery: td.battery ?? prev?.battery ?? 100,
            charging: false,
            position: td.position || prev?.position || { x: 0.0, y: 0.0 },
            orientation: td.orientation ?? prev?.orientation ?? 0.0,
            velocity: td.speed ?? 0.0,
            current_destination: prev?.current_destination ?? null,
            navigation_progress: prev?.navigation_progress ?? 0,
            distance_remaining: prev?.distance_remaining ?? 0,
            estimated_time_remaining: prev?.estimated_time_remaining ?? 0,
            hardware: td.hardware || prev?.hardware,
            bridge: td.bridge || prev?.bridge,
            trajectory: td.trajectory || prev?.trajectory
          }));
        }
      } catch (err) {
        // Silent catch for HTTP fallback
      }
    };

    const syncInterval = setInterval(syncHttpFallback, 4000);

    return () => {
      clearInterval(checkConn);
      clearInterval(syncInterval);
      wsService.offMessage('robot_status', onStatus);
      wsService.offMessage('sensor_data', onSensor);
      wsService.offMessage('map_update', onMap);
      wsService.offMessage('log_event', onLog);
      wsService.offMessage('destination_update', onDestUpdate);
      wsService.offMessage('robot_connection_lost', onConnLost);
      wsService.disconnect();
    };
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
      sendCommand,
      reloadDestinations: fetchDestinations
    }}>
      {children}
    </RobotContext.Provider>
  );
};
