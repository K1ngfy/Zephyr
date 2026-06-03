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
    
    const top = rect.bottom + 10;
    let left = rect.left;
    
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

  if (type === 'read') {
    return (
      <div 
        className="absolute bg-[#1D1D1F] text-white rounded-full shadow-xl shadow-black/20 p-2 px-4 flex items-center gap-3 transform transition-all font-sans border border-gray-700"
        style={{ 
          top: position.top, 
          left: position.left,
          zIndex: 2147483647
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {ttsState === 'playing' ? (
            <div className="flex gap-1 items-end h-3">
              <div className="w-1 bg-green-400 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 bg-green-400 rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1 bg-green-400 rounded-full animate-bounce h-2.5" style={{ animationDelay: '300ms' }}></div>
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          )}
          <span className="text-[13px] font-medium text-white/90 mr-2">
            Zephyr {ttsState === 'playing' ? 'Reading' : 'Finished'}
          </span>
        </div>
        
        <div className="w-[1px] h-4 bg-white/20"></div>

        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white" title="Stop">
          {ttsState === 'playing' ? <Square className="w-3.5 h-3.5 fill-current" /> : <X className="w-3.5 h-3.5" />}
        </button>
        {onReplay && ttsState === 'idle' && (
          <button onClick={onReplay} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white" title="Replay">
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className="absolute bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 p-4 space-y-4 transform transition-all font-sans"
      style={{ 
        top: position.top, 
        left: position.left,
        width: '288px',
        zIndex: 2147483647
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h3 className="text-[15px] font-bold text-[#1D1D1F] leading-tight flex items-center gap-2">
            Zephyr Explain
            {ttsState === 'playing' && (
              <span className="relative flex h-2 w-2 mt-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </h3>
          <p className="text-[12px] text-[#86868B]">
             {ttsState === 'playing' ? 'Reading aloud...' : 'Explanation'}
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
        <div className="text-[13px] text-[#424245] leading-relaxed font-sans zephyr-markdown">
            {llmOutput === 'Thinking...' ? (
              <div className="flex items-center gap-2 text-[#86868B] font-medium">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
              </div>
            ) : (
              <ReactMarkdown>{llmOutput}</ReactMarkdown>
            )}
        </div>
      </div>
    </div>
  )
}
