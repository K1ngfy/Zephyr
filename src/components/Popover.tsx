import React, { useEffect, useState } from 'react';
import { Square, Loader2, X, Play, Bookmark } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { storage } from '../lib/chrome';

interface PopoverProps {
  rect: DOMRect;
  type: 'read' | 'explain';
  text: string;
  llmOutput: string;
  ttsState: 'idle' | 'playing';
  ttsChunks: string[];
  onClose: () => void;
  onReplay?: () => void;
}

export default function Popover({ rect, type, text, llmOutput, ttsState, ttsChunks, onClose, onReplay }: PopoverProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    storage.get(['zephyr_favorites']).then(res => {
      const favs = res.zephyr_favorites || [];
      const isFav = favs.some((f: any) => f.text === text && f.explain === (type === 'explain' ? llmOutput : ''));
      setSaved(isFav);
    });
    
    const top = rect.bottom + window.scrollY + 10;
    let left = rect.left + window.scrollX;
    
    // Prevent rendering offscreen
    if (left + 288 > window.innerWidth) {
      left = window.innerWidth - 300;
    }
    
    setPosition({ top, left });
  }, [rect, text, type, llmOutput]);

  const handleSave = async () => {
    const res = await storage.get(['zephyr_favorites']);
    const favs = res.zephyr_favorites || [];
    
    if (saved) {
      // Remove
      const newFavs = favs.filter((f: any) => !(f.text === text && f.explain === (type === 'explain' ? llmOutput : '')));
      await storage.set({ zephyr_favorites: newFavs });
      setSaved(false);
    } else {
      // Add
      favs.unshift({
        text,
        explain: type === 'explain' ? llmOutput : '',
        audioChunks: ttsChunks,
        date: new Date().toISOString()
      });
      await storage.set({ zephyr_favorites: favs });
      setSaved(true);
    }
  };

  return (
    <div 
      className="absolute bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 p-4 space-y-4 transform transition-all font-sans"
      style={{ 
        top: position.top, 
        left: position.left,
        width: '18rem',
        zIndex: 2147483647
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h3 className="text-[15px] font-bold text-[#1D1D1F] leading-tight flex items-center gap-2">
            Zephyr {type === 'read' ? 'Reader' : 'Explain'}
            {ttsState === 'playing' && (
              <span className="relative flex h-2 w-2 mt-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </h3>
          <p className="text-[12px] text-[#86868B]">
             {ttsState === 'playing' ? 'Reading aloud...' : 'Playback finished'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleSave} className={`p-1.5 rounded-full transition-colors ${saved ? 'text-blue-500 bg-blue-50' : 'text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'}`}>
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F5F5F7] rounded-full transition-colors text-[#86868B] hover:text-[#1D1D1F]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-[1px] w-full bg-[#F5F5F7]"></div>

      <div className="space-y-2">
        {type === 'read' ? (
           <div className="flex items-center gap-3">
             <button 
               onClick={onClose} 
               className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-[13px] font-medium"
             >
                <Square className="w-4 h-4 fill-current" /> Stop
             </button>
             {onReplay && (
               <button 
                 onClick={onReplay} 
                 className="flex-1 py-2 flex items-center justify-center gap-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-[13px] font-medium"
               >
                  <Play className="w-4 h-4 fill-current" /> Replay
               </button>
             )}
           </div>
        ) : (
          <div className="text-[13px] text-[#424245] leading-relaxed font-sans zephyr-markdown">
             {llmOutput === 'Thinking...' ? (
               <div className="flex items-center gap-2 text-[#86868B] font-medium">
                 <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
               </div>
             ) : (
               <ReactMarkdown>{llmOutput}</ReactMarkdown>
             )}
          </div>
        )}
      </div>
    </div>
  )
}
