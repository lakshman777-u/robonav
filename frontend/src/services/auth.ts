import { login as apiLogin } from './api';

export const setToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const getToken = () => {
  return localStorage.getItem('auth_token');
};

export const removeToken = () => {
  localStorage.removeItem('auth_token');
};

export const getUser = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (e) {
    return null;
  }
};

export const isAdmin = () => {
  const user = getUser();
  return user?.role === 'admin';
};

export const logout = () => {
  removeToken();
  window.location.href = '/login';
};

export const login = async (username: string, password: string) => {
  const res = await apiLogin(username, password);
  if (res.data && res.data.access_token) {
    setToken(res.data.access_token);
  }
  return res.data;
};
