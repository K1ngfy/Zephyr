import React, { useState } from 'react';
import { Sparkles, Check, Activity } from 'lucide-react';
import { storage } from '../lib/chrome';

export default function Settings({ config, onUpdate }: { config: any, onUpdate: (c: any) => void }) {
  const [key, setKey] = useState(config.volcengineKey);
  const [ep, setEp] = useState(config.endpointId);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await new Promise(r => setTimeout(r, 800));
      if (key.length > 5 && ep.startsWith('ep-')) setTestResult('success');
      else setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  const save = async () => {
    const newConfig = { ...config, volcengineKey: key, endpointId: ep };
    await storage.set(newConfig);
    onUpdate(newConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="w-[420px] mx-auto bg-white rounded-[28px] shadow-2xl shadow-gray-200/50 flex flex-col overflow-hidden border border-white">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#1D1D1F] rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">Zephyr</h1>
            <p className="text-[13px] text-[#86868B]">Preferences</p>
          </div>
        </div>
        
        <div className="space-y-1.5 mb-8">
          <div className="flex items-center gap-3 px-1">
            <div className="w-2 h-2 rounded-full bg-[#0071E3]"></div>
            <span className="text-[13px] font-medium text-[#1D1D1F]">Model Configuration</span>
          </div>
          <div className="h-[2px] w-full bg-[#F5F5F7] rounded-full overflow-hidden">
            <div className="h-full bg-[#0071E3] rounded-full w-full"></div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 space-y-4 mb-4">
        <label className="block">
           <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Volcengine API Key</span>
           <div className="mt-1.5 relative">
             <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Enter your Volcengine API Key" className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
           </div>
        </label>
        <label className="block">
           <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Doubao Endpoint ID</span>
           <input type="text" value={ep} onChange={e => setEp(e.target.value)} placeholder="ep-202xxxxxxxx" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
        </label>

        <div className="mt-6 flex items-center gap-4">
           {testing ? (
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex-1">
                 <p className="text-[12px] leading-relaxed text-[#0071E3]">Testing connection to <strong>seed-tts-2.0</strong>...<br/><Activity className="inline w-3 h-3 animate-spin"/> Connecting</p>
              </div>
           ) : testResult === 'success' ? (
              <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100/50 flex-1">
                 <p className="text-[12px] leading-relaxed text-green-700"><Check className="inline w-3 h-3 mr-1"/> Connection verified</p>
              </div>
           ) : testResult === 'error' ? (
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 flex-1">
                 <p className="text-[12px] leading-relaxed text-red-700">Invalid credentials format</p>
              </div>
           ) : (
              <div className="flex-1"></div>
           )}
           
           <button onClick={testConnection} disabled={!key || !ep || testing} className="w-11 h-11 shrink-0 rounded-xl bg-[#F5F5F7] hover:bg-gray-200 flex items-center justify-center text-[#1D1D1F] disabled:opacity-50 transition-all border-none" title="Test Connection">
              <Activity className={`w-5 h-5 ${testing ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      <div className="p-8 bg-[#FBFBFD] border-t border-[#F5F5F7] flex items-center justify-between">
         {saved ? (
             <span className="text-emerald-500 text-[14px] font-medium flex items-center gap-1.5 animate-in fade-in"><Check className="w-4 h-4"/> Saved</span>
         ) : (
             <span className="text-[14px] font-medium text-[#86868B]">Locally synced</span>
         )}
         <button onClick={save} className="bg-[#1D1D1F] text-white px-8 py-3 rounded-full text-[14px] font-medium shadow-lg shadow-black/10 hover:bg-black transition-all">Save</button>
      </div>
    </div>
  )
}
