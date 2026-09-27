import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { RobotProvider } from './context/RobotContext';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RobotProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/user/*" element={<UserDashboard />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster position="top-right" toastOptions={{ className: '!bg-slate-800 !text-white !border !border-slate-700' }} />
        </RobotProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
