import React, { useEffect, useState } from 'react';
import { Square, Loader2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface PopoverProps {
  rect: DOMRect;
  type: 'read' | 'explain';
  llmOutput: string;
  ttsState: 'idle' | 'playing';
  onClose: () => void;
}

export default function Popover({ rect, type, llmOutput, ttsState, onClose }: PopoverProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const top = rect.bottom + window.scrollY + 10;
    const left = rect.left + window.scrollX;
    setPosition({ top, left });
  }, [rect]);

  return (
    <div 
      className="absolute bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-gray-100 p-5 space-y-4 transform transition-all font-sans"
      style={{ 
        top: position.top, 
        left: position.left,
        width: '18rem',
        zIndex: 2147483647
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h3 className="text-[15px] font-bold text-[#1D1D1F] leading-tight">Zephyr {type === 'read' ? 'Reader' : 'Explain'}</h3>
          <p className="text-[12px] text-[#86868B] italic">
             {ttsState === 'playing' ? 'Reading aloud...' : 'Idle'}
          </p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors text-[#86868B] hover:text-[#1D1D1F]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="h-[1px] w-full bg-[#F5F5F7]"></div>

      <div className="space-y-2">
        {type === 'read' ? (
           <div className="flex items-center gap-3">
             <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                <Square className="w-4 h-4 fill-current" />
             </button>
             <div className="text-[13px] text-[#1D1D1F] font-medium">Stop playback</div>
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

      <div className="flex gap-2 pt-2">
        <button onClick={onClose} className="flex-1 py-1.5 rounded-lg bg-[#1D1D1F] text-white text-[11px] font-medium transition-colors hover:bg-black">Dismiss</button>
      </div>
    </div>
  )
}
