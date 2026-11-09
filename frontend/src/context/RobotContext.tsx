import { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';
import { wsService } from '../services/websocket';
import { RobotStatus, SensorData } from '../types/robot';
import { MapData } from '../types/map';
import { Destination } from '../types/navigation';
import { 
  getDestinations, 
  getCurrentMap, 
  getRobotTelemetry, 
  requestNavigation as apiRequestNavigation, 
  cancelNavigation as apiCancelNavigation 
} from '../services/api';
import { getToken } from '../services/auth';
import { updateOccupancyPixels, initOccupancyCanvas } from '../utils/mapRenderer';

export interface CommandRecord {
  command: string;
  source: 'website' | 'laptop' | 'ros2' | 'keyboard' | 'system';
  timestamp: number;
  speed?: number;
  speed_mode?: 'TURTLE' | 'BOOST';
  parameters?: Record<string, any>;
  status?: 'SENT' | 'RECEIVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
}

export interface RobotContextType {
  // Telemetry & Hardware State
  robotStatus: RobotStatus | null;
  sensorData: SensorData | null;
  mapData: MapData | null;
  destinations: Destination[];
  navigationPath: any;
  logs: any[];
  wsConnected: boolean;
  simulationMode: boolean;
  demoMode: boolean;
  
  // Command & Speed State
  lastCommand: CommandRecord | null;
  speedMode: 'TURTLE' | 'BOOST';

  // Command Dispatchers & Receivers
  sendCommand: (command: string, speedOrParams?: any, extraParams?: any) => void;
  emergencyStop: () => void;
  setSpeedMode: (mode: 'TURTLE' | 'BOOST') => Promise<void>;
  navigateTo: (destinationId: number) => Promise<void>;
  cancelNavigation: () => Promise<void>;
  setSimulationMode: (enabled: boolean) => void;
  reloadDestinations: () => Promise<void>;
}

export const RobotContext = createContext<RobotContextType | null>(null);

export const RobotProvider = ({ children }: { children: ReactNode }) => {
  const auth = useContext(AuthContext);

  // Core Robot Telemetry States
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [navigationPath, setNavigationPath] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Command & Speed Mode States
  const [lastCommand, setLastCommand] = useState<CommandRecord | null>(null);
  const [speedMode, setSpeedModeState] = useState<'TURTLE' | 'BOOST'>('TURTLE');

  // BroadcastChannel for cross-tab or external laptop browser script sync
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Fetch Destination Waypoints
  const fetchDestinations = useCallback(async () => {
    try {
      const res = await getDestinations();
      if (res?.data && res.data.length > 0) {
        setDestinations(res.data);
      } else {
        setDestinations([
          { id: 1, name: 'Entrance', type: 'waypoint', x: 1.5, y: 1.5, status: 'active' },
          { id: 2, name: 'Room A', type: 'room', x: 4.0, y: 2.0, status: 'active' },
          { id: 3, name: 'Room B', type: 'room', x: 4.0, y: 6.0, status: 'active' },
          { id: 4, name: 'Charging Station', type: 'dock', x: 1.0, y: 1.0, status: 'active' },
        ]);
      }
    } catch {
      setDestinations([
        { id: 1, name: 'Entrance', type: 'waypoint', x: 1.5, y: 1.5, status: 'active' },
        { id: 2, name: 'Room A', type: 'room', x: 4.0, y: 2.0, status: 'active' },
        { id: 3, name: 'Room B', type: 'room', x: 4.0, y: 6.0, status: 'active' },
        { id: 4, name: 'Charging Station', type: 'dock', x: 1.0, y: 1.0, status: 'active' },
      ]);
    }
  }, []);

  // Synchronize telemetry payload from WebSocket or HTTP
  const applyTelemetry = useCallback((td: any) => {
    if (!td) return;

    if (td.speed_control?.mode) {
      setSpeedModeState(td.speed_control.mode as 'TURTLE' | 'BOOST');
    }

    setRobotStatus(prev => ({
      robot_id: td.robot_id || prev?.robot_id || 'ESP32DEVKIT-001',
      name: prev?.name || 'Autonomous Robot 01',
      robot_type: prev?.robot_type || 'ESP32-CAM',
      state: td.connection === 'ONLINE' ? (prev?.state || 'IDLE') : (prev?.state || 'IDLE'),
      connection_status: 'ONLINE',
      battery: td.battery ?? prev?.battery ?? 100,
      charging: td.charging ?? false,
      position: td.position || prev?.position || { x: 0.0, y: 0.0 },
      orientation: td.orientation ?? prev?.orientation ?? 0.0,
      velocity: td.speed ?? td.velocity ?? prev?.velocity ?? 0.0,
      current_destination: prev?.current_destination ?? null,
      navigation_progress: prev?.navigation_progress ?? 0,
      distance_remaining: prev?.distance_remaining ?? 0,
      estimated_time_remaining: prev?.estimated_time_remaining ?? 0,
      hardware: td.hardware || prev?.hardware,
      bridge: td.bridge || prev?.bridge,
      trajectory: td.trajectory || prev?.trajectory,
      lidar: td.lidar || (prev as any)?.lidar,
      direction: td.direction || prev?.direction || 'STOPPED',
      speed_control: td.speed_control || prev?.speed_control,
      mpu9250: td.mpu9250 || prev?.mpu9250,
      ultrasonic: td.ultrasonic || prev?.ultrasonic,
      camera: td.camera || prev?.camera,
      hardware_config: td.hardware_config || prev?.hardware_config,
      wifi: td.wifi || prev?.wifi,
      oled_expression: td.oled_expression || prev?.oled_expression,
      motors: td.motors || prev?.motors,
    }));

    if (td.lidar || td.ultrasonic || td.camera || td.mpu9250) {
      setSensorData(prev => ({
        lidar: {
          active: td.lidar?.status === 'ACTIVE' || Boolean(td.lidar?.active) || (td.lidar?.rays && td.lidar.rays.length > 0) || false,
          scan_rate: td.lidar?.scan_rate || td.lidar?.hz || td.bridge?.scan_hz || 9.3,
          points: td.lidar?.points || (td.lidar?.rays ? td.lidar.rays.length : 360),
          range: td.lidar?.range || 8.0,
          rays: td.lidar?.rays || prev?.lidar?.rays || [],
          status: td.lidar?.status || 'ACTIVE',
          packets: td.lidar?.packets ?? td.bridge?.udp_packets_rx ?? 0
        },
        camera: td.camera || prev?.camera || { 
          connected: true, 
          obstacle_detected: false, 
          obstacle_type: null, 
          distance: null 
        },
        ultrasonic: td.ultrasonic || prev?.ultrasonic || { 
          front: 1.25, 
          left: 2.1, 
          right: 1.7, 
          rear: 2.1 
        },
        oled_expression: td.oled_expression || prev?.oled_expression,
        glass_detected: td.glass_detected ?? false,
        bridge: td.bridge || prev?.bridge
      }));
    }
  }, []);

  // Primary setup effect: WebSockets, Listeners, BroadcastChannel
  useEffect(() => {
    fetchDestinations();

    // 1. Connect WebSocket using auth token or fallback
    const tokenToUse = auth?.token || getToken() || 'anonymous';
    wsService.connect(tokenToUse);

    const checkConn = setInterval(() => {
      setWsConnected(wsService.getState() === 'connected');
    }, 1000);

    // 2. Incoming Telemetry and Status Listeners
    const onStatus = (msg: any) => {
      if (msg.data) applyTelemetry(msg.data);
    };

    const onSensor = (msg: any) => {
      if (msg.data) {
        setSensorData(prev => ({
          ...prev,
          ...msg.data,
          lidar: msg.data.lidar || prev?.lidar || { active: true, scan_rate: 9.3, points: 360, range: 8.0, rays: [] },
          camera: msg.data.camera || prev?.camera || { connected: true, obstacle_detected: false, obstacle_type: null, distance: null },
          ultrasonic: msg.data.ultrasonic || prev?.ultrasonic || { front: 1.25 },
          glass_detected: msg.data.glass_detected ?? false
        }));
      }
    };

    // 3. Incoming 2D SLAM Map Updates
    const onMap = (msg: any) => {
      if (msg.data && msg.data.updates) {
        setMapData((prev) => {
          const width = msg.data.width || prev?.width || 600;
          const height = msg.data.height || prev?.height || 600;
          updateOccupancyPixels(msg.data.updates, width, height);

          let grid = prev?.occupancy_grid;
          if (!grid) {
            grid = new Array(width * height).fill(-1);
          }
          for (let i = 0; i < msg.data.updates.length; i++) {
            const u = msg.data.updates[i];
            const idx = u.y * width + u.x;
            if (idx >= 0 && idx < grid.length) {
              grid[idx] = u.val;
            }
          }

          return {
            map_id: prev?.map_id || 'MAP-LIVE',
            name: prev?.name || 'Live SLAM Map',
            resolution: prev?.resolution || 0.05,
            width,
            height,
            origin: prev?.origin || { x: msg.data.origin_x ?? -15.0, y: msg.data.origin_y ?? -15.0 },
            occupancy_grid: grid,
            start_position: prev?.start_position || { x: 0.0, y: 0.0 },
            status: prev?.status || 'building'
          };
        });
      } else if (msg.data && msg.data.occupancy_grid) {
        initOccupancyCanvas(msg.data.occupancy_grid, msg.data.width || 600, msg.data.height || 600);
        setMapData(msg.data);
      }
    };

    // 4. Incoming Command Events from Laptop, ROS 2, or Other Clients
    const onIncomingCommand = (msg: any) => {
      const cmdName = msg.command || msg.action || msg.data?.command;
      if (!cmdName) return;

      const record: CommandRecord = {
        command: cmdName,
        source: msg.source || 'laptop',
        timestamp: msg.timestamp || Date.now(),
        speed: msg.speed || msg.params?.speed || (speedMode === 'BOOST' ? 0.18 : 0.10),
        speed_mode: msg.speed_mode || speedMode,
        parameters: msg.parameters || msg.params || {},
        status: msg.status || 'EXECUTING'
      };

      setLastCommand(record);
      setLogs(prev => [
        {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          source: 'CMD_RECEIVER',
          message: `Received command: ${cmdName} from ${record.source}`
        },
        ...prev
      ].slice(0, 200));

      // Optimistically update robot direction for immediate visual feedback
      const cmdUpper = cmdName.toUpperCase();
      let direction = 'STOPPED';
      if (cmdUpper.includes('FORWARD')) direction = 'FORWARD';
      else if (cmdUpper.includes('BACK') || cmdUpper.includes('REVERSE')) direction = 'REVERSE';
      else if (cmdUpper.includes('LEFT')) direction = 'TURN_LEFT';
      else if (cmdUpper.includes('RIGHT')) direction = 'TURN_RIGHT';

      setRobotStatus(prev => prev ? {
        ...prev,
        direction,
        state: cmdUpper === 'EMERGENCY_STOP' ? 'EMERGENCY_STOP' : (direction === 'STOPPED' ? 'IDLE' : 'MANUAL_CONTROL')
      } : null);
    };

    // 5. Incoming Navigation and System Logs
    const onNavigationStatus = (msg: any) => {
      if (msg.data?.path) setNavigationPath(msg.data.path);
      if (msg.data) {
        setRobotStatus(prev => prev ? {
          ...prev,
          navigation_progress: msg.data.progress ?? prev.navigation_progress,
          distance_remaining: msg.data.distance_remaining ?? prev.distance_remaining,
          estimated_time_remaining: msg.data.time_remaining ?? prev.estimated_time_remaining,
          current_destination: msg.data.destination_name ?? prev.current_destination,
          state: msg.data.state || prev.state
        } : null);
      }
    };

    const onLog = (msg: any) => {
      if (msg.data) setLogs(prev => [msg.data, ...prev].slice(0, 200));
    };

    const onSpeedModeUpdate = (msg: any) => {
      if (msg.mode) {
        setSpeedModeState(msg.mode);
      }
    };

    const onEmergencyStopTriggered = (msg: any) => {
      setRobotStatus(prev => prev ? {
        ...prev,
        state: 'EMERGENCY_STOP',
        direction: 'STOPPED',
        oled_expression: 'EMERGENCY_STOP'
      } : null);
      setLogs(prev => [
        {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          source: 'EMERGENCY_WATCHDOG',
          message: msg.reason || 'Emergency stop triggered by hardware or watchdog.'
        },
        ...prev
      ].slice(0, 200));
    };

    // Register WebSocket Handlers
    wsService.onMessage('robot_status', onStatus);
    wsService.onMessage('sensor_data', onSensor);
    wsService.onMessage('map_update', onMap);
    wsService.onMessage('log_event', onLog);
    wsService.onMessage('command', onIncomingCommand);
    wsService.onMessage('manual_command', onIncomingCommand);
    wsService.onMessage('robot_command', onIncomingCommand);
    wsService.onMessage('speed_mode', onSpeedModeUpdate);
    wsService.onMessage('navigation_status', onNavigationStatus);
    wsService.onMessage('emergency_stop', onEmergencyStopTriggered);
    wsService.onMessage('destination_update', fetchDestinations);

    // 6. Window CustomEvent Listener for Local Laptop Commands
    // Allows scripts, DevTools console, or tests to dispatch commands:
    // window.dispatchEvent(new CustomEvent('robonav:command', { detail: { command: 'MOVE_FORWARD', speed: 0.12 } }))
    const handleWindowEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.command) {
        const { command, speed, speed_mode, parameters } = customEvent.detail;
        onIncomingCommand({
          command,
          source: 'laptop',
          speed,
          speed_mode,
          parameters,
          timestamp: Date.now()
        });
      }
    };
    window.addEventListener('robonav:command', handleWindowEvent);

    // 7. Cross-tab BroadcastChannel for multi-window sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('robonav_commands');
        channel.onmessage = (event) => {
          if (event.data?.command) {
            onIncomingCommand(event.data);
          }
        };
        broadcastChannelRef.current = channel;
      } catch (err) {
        console.warn('BroadcastChannel not supported in this environment', err);
      }
    }

    // 8. Initial Map and Telemetry Fetch on Mount
    getCurrentMap().then(res => {
      if (res?.data && res.data.occupancy_grid) {
        const md = res.data;
        initOccupancyCanvas(md.occupancy_grid, md.width || 600, md.height || 600);
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

    getRobotTelemetry().then(res => {
      if (res?.data) applyTelemetry(res.data);
    }).catch(() => {});

    // 9. HTTP Telemetry Fallback Polling (Only when WebSocket is disconnected)
    const syncHttpFallback = async () => {
      if (wsService.getState() === 'connected') return;
      try {
        const telemRes = await getRobotTelemetry();
        if (telemRes?.data) {
          applyTelemetry(telemRes.data);
        }
      } catch {
        // Fallback polling silence
      }
    };
    const syncInterval = setInterval(syncHttpFallback, 3000);

    return () => {
      clearInterval(checkConn);
      clearInterval(syncInterval);
      wsService.offMessage('robot_status', onStatus);
      wsService.offMessage('sensor_data', onSensor);
      wsService.offMessage('map_update', onMap);
      wsService.offMessage('log_event', onLog);
      wsService.offMessage('command', onIncomingCommand);
      wsService.offMessage('manual_command', onIncomingCommand);
      wsService.offMessage('robot_command', onIncomingCommand);
      wsService.offMessage('speed_mode', onSpeedModeUpdate);
      wsService.offMessage('navigation_status', onNavigationStatus);
      wsService.offMessage('emergency_stop', onEmergencyStopTriggered);
      wsService.offMessage('destination_update', fetchDestinations);
      window.removeEventListener('robonav:command', handleWindowEvent);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      wsService.disconnect();
    };
  }, [auth?.token, applyTelemetry, fetchDestinations, speedMode]);

  /**
   * Primary Command Dispatcher
   * Sends command over authenticated WebSocket with instant REST API fallback
   */
  const sendCommand = useCallback((command: string, speedOrParams?: any, extraParams?: any) => {
    const isTurtle = speedMode === 'TURTLE';
    const defaultSpeed = isTurtle ? 0.10 : 0.18;

    let targetSpeed = defaultSpeed;
    let parameters: Record<string, any> = {};

    if (typeof speedOrParams === 'number') {
      targetSpeed = speedOrParams;
      if (extraParams && typeof extraParams === 'object') {
        parameters = { ...extraParams };
      }
    } else if (speedOrParams && typeof speedOrParams === 'object') {
      if (typeof speedOrParams.speed === 'number') targetSpeed = speedOrParams.speed;
      parameters = { ...speedOrParams };
    }

    const payload: any = {
      type: 'command',
      command,
      speed: targetSpeed,
      speed_mode: speedMode,
      parameters,
      timestamp: Date.now()
    };

    // 1. Send via WebSocket (Lowest latency < 10ms)
    wsService.send(payload);

    // 2. Broadcast to other tabs / laptop windows
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          ...payload,
          source: 'website'
        });
      } catch {}
    }

    // 3. Fallback / Guarantee Dispatch via Backend REST API
    fetch('/api/robot/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {})
      },
      body: JSON.stringify({
        command,
        speed: targetSpeed,
        speed_mode: speedMode,
        parameters
      })
    }).catch(() => {});

    // 4. Update local command state and history
    const record: CommandRecord = {
      command,
      source: 'website',
      timestamp: Date.now(),
      speed: targetSpeed,
      speed_mode: speedMode,
      parameters,
      status: 'SENT'
    };
    setLastCommand(record);

    // 5. Optimistic UI update for instantaneous responsiveness
    const cmdUpper = command.toUpperCase();
    let direction = 'STOPPED';
    if (cmdUpper.includes('FORWARD')) direction = 'FORWARD';
    else if (cmdUpper.includes('BACK') || cmdUpper.includes('REVERSE')) direction = 'REVERSE';
    else if (cmdUpper.includes('LEFT')) direction = 'TURN_LEFT';
    else if (cmdUpper.includes('RIGHT')) direction = 'TURN_RIGHT';

    setRobotStatus(prev => prev ? {
      ...prev,
      direction,
      state: cmdUpper === 'EMERGENCY_STOP' ? 'EMERGENCY_STOP' : (direction === 'STOPPED' ? 'IDLE' : 'MANUAL_CONTROL')
    } : null);
  }, [auth?.token, speedMode]);

  /**
   * Emergency Stop
   * Multicast hard-brake to backend, WebSocket, and local state
   */
  const emergencyStop = useCallback(() => {
    // 1. Backend REST emergency stop
    fetch('/api/robot/emergency-stop', {
      method: 'POST',
      headers: {
        ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {})
      }
    }).catch(() => {});

    // 2. WebSocket command
    wsService.send({ type: 'command', command: 'EMERGENCY_STOP' });
    wsService.send({ type: 'emergency_stop' });

    // 3. Broadcast to tabs
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          command: 'EMERGENCY_STOP',
          source: 'website',
          timestamp: Date.now()
        });
      } catch {}
    }

    // 4. Immediate state lock
    setLastCommand({
      command: 'EMERGENCY_STOP',
      source: 'website',
      timestamp: Date.now(),
      status: 'SENT'
    });

    setRobotStatus(prev => prev ? {
      ...prev,
      state: 'EMERGENCY_STOP',
      direction: 'STOPPED',
      velocity: 0.0,
      oled_expression: 'EMERGENCY_STOP'
    } : null);
  }, [auth?.token]);

  /**
   * Set Speed Mode (TURTLE vs BOOST)
   */
  const setSpeedMode = useCallback(async (mode: 'TURTLE' | 'BOOST') => {
    setSpeedModeState(mode);

    // Send via REST
    try {
      await fetch('/api/speed/mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {})
        },
        body: JSON.stringify({ mode })
      });
    } catch {}

    // Send via WebSocket
    wsService.send({ type: 'speed_mode', mode });

    // Optimistic status update
    setRobotStatus(prev => prev ? {
      ...prev,
      speed_control: {
        ...(prev.speed_control || {}),
        mode,
        boost_active: mode === 'BOOST'
      }
    } : null);
  }, [auth?.token]);

  /**
   * Dispatch Autonomous Navigation Goal
   */
  const navigateTo = useCallback(async (destinationId: number) => {
    try {
      await apiRequestNavigation(destinationId);
    } catch {
      // Fallback via WebSocket
      wsService.send({
        type: 'navigation_request',
        destination_id: destinationId
      });
    }
  }, []);

  /**
   * Cancel Active Autonomous Navigation Goal
   */
  const cancelNavigation = useCallback(async () => {
    try {
      await apiCancelNavigation();
    } catch {
      // Fallback via WebSocket
      wsService.send({ type: 'cancel_navigation' });
    }
  }, []);

  return (
    <RobotContext.Provider value={{
      robotStatus,
      sensorData,
      mapData,
      destinations,
      navigationPath,
      logs,
      wsConnected,
      simulationMode,
      demoMode,
      lastCommand,
      speedMode,
      setSimulationMode,
      sendCommand,
      emergencyStop,
      setSpeedMode,
      navigateTo,
      cancelNavigation,
      reloadDestinations: fetchDestinations
    }}>
      {children}
    </RobotContext.Provider>
  );
};

export const useRobot = () => {
  const context = useContext(RobotContext);
  if (!context) throw new Error('useRobot must be used within RobotProvider');
  return context;
};


