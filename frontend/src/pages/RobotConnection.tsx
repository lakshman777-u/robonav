import React from 'react';
import { ApiKeyManager } from '../components/ApiKeyManager';

export const RobotConnection = () => {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Robot Connection</h2>
      <ApiKeyManager robotId="default-robot" />
    </div>
  );
};
