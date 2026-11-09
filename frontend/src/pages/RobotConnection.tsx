import React from 'react';
import { ApiKeyManager } from '../components/ApiKeyManager';
import { HardwareIndicators } from '../components/HardwareIndicators';
import { WifiConnectionManager } from '../components/WifiConnectionManager';

export const RobotConnection = () => {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-wider uppercase text-white mb-1">
          ESP32-S3 Wi-Fi Link & Hardware Authentication
        </h2>
        <p className="text-xs text-gray-400 font-mono">
          Manage Wi-Fi credentials, live telemetry link, and security handshake between the Ubuntu Laptop and ESP32-S3 Robot.
        </p>
      </div>

      {/* Primary Wi-Fi Connection Manager */}
      <WifiConnectionManager />

      <HardwareIndicators />

      <ApiKeyManager robotId="ESP32S3-CAM-001" />
    </div>
  );
};

