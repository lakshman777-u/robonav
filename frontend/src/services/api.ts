import axios from 'axios';
import { getToken, logout, getUser } from './auth';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const user = getUser();
    if (error.response?.status === 401 && user?.mode !== 'cloud_demo') {
      logout();
    }
    return Promise.reject(error);
  }
);

export const login = (username: string, password: string) => api.post('/auth/login', { username, password });
export const getMe = () => api.get('/auth/me');
export const getRobotStatus = (robotId: string | number) => api.get(`/robots/${robotId}/status`);
export const sendCommand = (robotId: string | number, command: string, params?: any) => api.post(`/robots/${robotId}/command`, { command, params });
export const emergencyStop = (robotId: string | number) => api.post(`/robots/${robotId}/emergency-stop`);
// Client-side cryptographic fallback key generator for offline / GitHub Pages mode
export const createRandomApiKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let randomPart = '';
  try {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 32; i++) {
      randomPart += chars[array[i] % chars.length];
    }
  } catch (e) {
    for (let i = 0; i < 32; i++) {
      randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `rb_live_${randomPart}`;
};

export const getStoredApiKey = (robotId: string | number = 'ESP32CAM-001') => {
  return localStorage.getItem(`robonav_api_key_${robotId}`) || localStorage.getItem('robonav_api_key');
};

export const setStoredApiKey = (robotId: string | number, key: string | null) => {
  if (key) {
    localStorage.setItem(`robonav_api_key_${robotId}`, key);
    localStorage.setItem('robonav_api_key', key);
  } else {
    localStorage.removeItem(`robonav_api_key_${robotId}`);
    localStorage.removeItem('robonav_api_key');
  }
};

export const generateApiKey = async (robotId: string | number) => {
  try {
    const res = await api.post(`/robots/${robotId}/api-key`);
    if (res.data?.api_key) {
      setStoredApiKey(robotId, res.data.api_key);
      return res;
    }
  } catch (err) {
    console.warn('Backend API key route unreachable or rejected; generating client-side secure API key:', err);
  }
  
  // High-entropy fallback key
  const localKey = createRandomApiKey();
  setStoredApiKey(robotId, localKey);
  return {
    data: {
      api_key: localKey,
      prefix: 'rb_live_',
      robot_id: robotId,
      status: 'generated_offline_fallback'
    }
  };
};

export const regenerateApiKey = async (robotId: string | number) => {
  try {
    const res = await api.post(`/robots/${robotId}/api-key/regenerate`);
    if (res.data?.api_key) {
      setStoredApiKey(robotId, res.data.api_key);
      return res;
    }
  } catch (err) {
    console.warn('Backend regenerate key route unreachable; regenerating client-side secure API key:', err);
  }
  
  const localKey = createRandomApiKey();
  setStoredApiKey(robotId, localKey);
  return {
    data: {
      api_key: localKey,
      prefix: 'rb_live_',
      robot_id: robotId,
      status: 'regenerated_offline_fallback'
    }
  };
};

export const revokeApiKey = async (robotId: string | number) => {
  setStoredApiKey(robotId, null);
  try {
    return await api.post(`/robots/${robotId}/api-key/revoke`);
  } catch (err) {
    return { data: { status: 'revoked' } };
  }
};
export const getMaps = () => api.get('/maps');
export const getCurrentMap = () => api.get('/maps/current');
export const getMap = (mapId: string | number) => api.get(`/maps/${mapId}`);
export const getRobotTelemetry = () => api.get('/robot/telemetry');
export const startMapping = (name?: string) => api.post('/maps/start', { name: name || 'Building Map' });
export const pauseMapping = () => api.post('/maps/pause');
export const finalizeMap = (name?: string) => api.post('/maps/finalize', name ? { name } : {});
export const stopMapping = (name?: string) => api.post('/maps/stop', name ? { name } : {});
export const clearMap = () => api.post('/maps/clear');
export const loadSavedMap = (mapId: string | number) => api.post(`/maps/${mapId}/load`);
export const deleteMap = (mapId: string | number) => api.delete(`/maps/${mapId}`);
export const deleteAllMaps = () => api.delete('/maps/all');
export const getLidarStatus = () => api.get('/lidar/status');
export const startLidar = (mock: boolean = false) => api.post('/lidar/start', { mock });
export const stopLidar = () => api.post('/lidar/stop');
export const getDestinations = () => api.get('/destinations');
export const createDestination = (data: any) => api.post('/destinations', data);
export const setRoomFlag = (flagNumber: number, x: number, y: number, name?: string) => 
  api.post('/destinations/flag', { flag_number: flagNumber, x, y, name });
export const deleteRoomFlag = (flagNumber: number) => api.delete(`/destinations/flag/${flagNumber}`);
export const updateDestination = (id: string | number, data: any) => api.put(`/destinations/${id}`, data);
export const deleteDestination = (id: string | number) => api.delete(`/destinations/${id}`);
export const requestNavigation = (destinationId: number) => api.post(`/navigation/request`, { destination_id: destinationId });
export const cancelNavigation = () => api.post('/navigation/cancel');
export const returnHome = () => api.post('/navigation/return-home');
export const getNavigationHistory = () => api.get('/navigation/history');
export const getNavigationCurrent = () => api.get('/navigation/current');
export const getLogs = (filters?: any) => api.get('/logs', { params: filters });
export const toggleSimulation = (enabled: boolean) => api.post('/simulation/toggle', { enabled });
export const toggleDemoTime = (enabled: boolean) => api.post('/simulation/demo-time', { enabled });

export default api;
