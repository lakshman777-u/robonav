import React from 'react';

// Mock dialog component for now
export const DestinationDialog = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-card p-6 rounded-lg border border-dark-border w-96">
        <h2 className="text-xl font-bold mb-4">Add Destination</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <select className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white">
              <option>room</option>
              <option>reception</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};
