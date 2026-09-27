import React from 'react';

export const ApiDocs = () => {
  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border max-w-4xl overflow-y-auto h-full">
      <h2 className="text-2xl font-bold mb-6 text-blue-500">API Documentation</h2>
      
      <div className="space-y-8">
        <section>
          <h3 className="text-xl font-bold mb-3 border-b border-dark-border pb-2">Authentication</h3>
          <div className="bg-slate-900 p-4 rounded text-sm font-mono text-gray-300">
            POST /api/auth/login<br/>
            Body: {'{'} username, password {'}'}<br/>
            Response: {'{'} token {'}'}
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold mb-3 border-b border-dark-border pb-2">Robot Control</h3>
          <div className="bg-slate-900 p-4 rounded text-sm font-mono text-gray-300">
            POST /api/robots/:id/command<br/>
            Body: {'{'} command: 'MOVE_FORWARD' | 'STOP' {'}'}<br/>
            <br/>
            POST /api/robots/:id/emergency-stop
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold mb-3 border-b border-dark-border pb-2">WebSocket</h3>
          <div className="bg-slate-900 p-4 rounded text-sm font-mono text-gray-300">
            URL: ws://HOST/ws/browser?token=TOKEN<br/>
            Events: robot_status, sensor_data, map_update, log_event
          </div>
        </section>
      </div>
    </div>
  );
};
