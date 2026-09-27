import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { RobotProvider } from './context/RobotContext';
import { CarTrimProvider } from './context/CarTrimContext';
import { AnimatedCyberBackground } from './components/AnimatedCyberBackground';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';

const App = () => {
  return (
    <BrowserRouter>
      <CarTrimProvider>
        <AuthProvider>
          <RobotProvider>
            <div className="relative min-h-screen bg-black text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-black">
              {/* Dynamic Animated Cyber Background in Black with subtle transparency */}
              <AnimatedCyberBackground />

              {/* Main Application Layers */}
              <div className="relative z-10">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/*" element={<AdminDashboard />} />
                  <Route path="/user/*" element={<UserDashboard />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </div>

              <Toaster
                position="top-right"
                toastOptions={{
                  className: '!bg-slate-950/90 !text-white !border !border-white/10 !backdrop-blur-md !shadow-2xl'
                }}
              />
            </div>
          </RobotProvider>
        </AuthProvider>
      </CarTrimProvider>
    </BrowserRouter>
  );
};

export default App;
