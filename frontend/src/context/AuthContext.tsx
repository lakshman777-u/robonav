import { createContext, useState, useEffect, ReactNode } from 'react';
import { getToken, getUser, isAdmin as checkIsAdmin, login as authLogin, logout as authLogout, setToken } from '../services/auth';

interface AuthContextType {
  user: any;
  token: string | null;
  role: string | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<any>(getUser());

  useEffect(() => {
    if (token) {
      setToken(token);
      setUser(getUser());
    }
  }, [token]);

  const login = async (u: string, p: string) => {
    const data = await authLogin(u, p);
    if (data && data.access_token) {
      setToken(data.access_token);
      setTokenState(data.access_token);
      setUser(getUser());
    }
  };

  const logout = () => {
    authLogout();
    setTokenState(null);
    setUser(null);
  };

  const currentUser = user || getUser();

  return (
    <AuthContext.Provider value={{
      user: currentUser,
      token: token || getToken(),
      role: currentUser?.role || null,
      login,
      logout,
      isAdmin: checkIsAdmin(),
      isAuthenticated: !!(token || getToken())
    }}>
      {children}
    </AuthContext.Provider>
  );
};
