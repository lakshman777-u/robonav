import React from 'react';
import { ApiKeyManager } from '../components/ApiKeyManager';
import { HardwareIndicators } from '../components/HardwareIndicators';

export const RobotConnection = () => {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-wider uppercase text-white mb-1">
          ESP32-CAM Hardware Link & Authentication Vault
        </h2>
        <p className="text-xs text-gray-400 font-mono">
          Manage hardware credentials, network pairing, and connection telemetry between the PC Server and ESP32-CAM.
        </p>
      </div>

      <HardwareIndicators />

      <ApiKeyManager robotId="ESP32CAM-001" />
    </div>
  );
};
