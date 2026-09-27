import axios from 'axios';
import { getToken, logout } from './auth';

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
    if (error.response?.status === 401) {
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
export const generateApiKey = (robotId: string | number) => api.post(`/robots/${robotId}/api-key`);
export const revokeApiKey = (robotId: string | number) => api.post(`/robots/${robotId}/api-key/revoke`);
export const regenerateApiKey = (robotId: string | number) => api.post(`/robots/${robotId}/api-key/regenerate`);
export const getMaps = () => api.get('/maps');
export const getMap = (mapId: string | number) => api.get(`/maps/${mapId}`);
export const startMapping = (name: string) => api.post('/maps/start', { name });
export const stopMapping = () => api.post('/maps/stop');
export const getDestinations = () => api.get('/destinations');
export const createDestination = (data: any) => api.post('/destinations', data);
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
