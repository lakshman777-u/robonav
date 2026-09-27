import { useState } from 'react';
import { generateApiKey, revokeApiKey, regenerateApiKey } from '../services/api';
import { Key, Eye, EyeOff, Copy, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const ApiKeyManager = ({ robotId }: { robotId: string }) => {
  const [key, setKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const handleGenerate = async () => {
    try {
      const res = await generateApiKey(robotId);
      setKey(res.data.key);
      toast.success('Key generated');
    } catch (e) {
      toast.error('Failed to generate key');
    }
  };

  const handleRegenerate = async () => {
    try {
      const res = await regenerateApiKey(robotId);
      setKey(res.data.key);
      toast.success('Key regenerated');
    } catch (e) {
      toast.error('Failed to regenerate key');
    }
  };

  const handleRevoke = async () => {
    try {
      await revokeApiKey(robotId);
      setKey(null);
      toast.success('Key revoked');
    } catch (e) {
      toast.error('Failed to revoke key');
    }
  };

  const copy = () => {
    if (key) {
      navigator.clipboard.writeText(key);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border mt-4">
      <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Key size={20} /> API Key Management</h3>
      
      {!key ? (
        <button onClick={handleGenerate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold">
          Generate New API Key
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-slate-900 p-3 rounded font-mono text-sm border border-slate-700">
            <span className="flex-1">{visible ? key : '••••••••••••••••••••••••••••••••'}</span>
            <button onClick={() => setVisible(!visible)} className="p-2 hover:bg-slate-700 rounded text-gray-400">
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={copy} className="p-2 hover:bg-slate-700 rounded text-gray-400">
              <Copy size={16} />
            </button>
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleRegenerate} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm flex items-center gap-2">
              <RefreshCw size={14} /> Regenerate
            </button>
            <button onClick={handleRevoke} className="px-3 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 rounded text-sm flex items-center gap-2">
              <Trash2 size={14} /> Revoke
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-400">
        <p className="font-bold mb-2">Setup Instructions:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Generate and copy the API key above.</li>
          <li>Configure your Raspberry Pi with the key.</li>
          <li>Start the robot software to connect.</li>
        </ol>
      </div>
    </div>
  );
};
