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
    if (payload.exp && payload.exp < Date.now() / 1000) {
      removeToken();
      return null;
    }
    return payload;
  } catch (e) {
    removeToken();
    return null;
  }
};

export const isAdmin = () => {
  const user = getUser();
  return user?.role === 'admin';
};

export const logout = () => {
  removeToken();
  window.location.hash = '#/login';
};

export const login = async (username: string, password: string) => {
  try {
    const res = await apiLogin(username, password);
    if (res.data && res.data.access_token) {
      setToken(res.data.access_token);
      return res.data;
    }
  } catch (err: any) {
    // When running on GitHub Pages (static cloud hosting) without a live backend,
    // gracefully fall back to local demo authentication for admin & user
    const u = username.trim().toLowerCase();
    const p = password.trim();
    const isAdmin = (u === 'robo_nav admin' || u === 'admin') && (p === 'ECE4 BT 8' || p === 'ece4 bt 8' || p === 'admin123');
    const isUser = (u === 'user') && (p === 'user112233' || p === 'user123');

    if (isAdmin || isUser) {
      const role = isAdmin ? 'admin' : 'user';
      const displayName = isAdmin ? 'ROBO_NAV Admin' : 'user';
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
      const payload = btoa(JSON.stringify({ sub: displayName, role, exp, mode: "cloud_demo" }));
      const mockToken = `${header}.${payload}.signature_demo`;
      setToken(mockToken);
      return { access_token: mockToken, token_type: "bearer", role };
    }
    throw err;
  }
};
