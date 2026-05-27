import React, { useEffect, useState } from 'react';
import { storage } from './lib/chrome';
import Onboarding from './components/Onboarding';
import Settings from './components/Settings';

export default function App() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.get(['volcengineKey', 'endpointId', 'onboarded']).then(res => {
      setConfig({
        volcengineKey: res.volcengineKey || '',
        endpointId: res.endpointId || '',
        onboarded: !!res.onboarded
      });
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans flex items-center justify-center p-8 selection:bg-blue-100 selection:text-[#0071E3]">
      <div className="w-full max-w-xl">
        {(!config.volcengineKey || !config.endpointId || !config.onboarded) ? (
          <Onboarding onComplete={(newConfig) => setConfig(newConfig)} />
        ) : (
          <Settings config={config} onUpdate={(newConfig) => setConfig(newConfig)} />
        )}
      </div>
      <div className="fixed bottom-4 right-4 text-xs text-[#86868B] opacity-70 font-medium">
        AI Studio Preview: Mocks Chrome API. Build as Extension to test ContextMenus.
      </div>
    </div>
  );
}
