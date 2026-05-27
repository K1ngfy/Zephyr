import React, { useState, useEffect, useRef } from 'react';
import { AudioStreamer } from '../lib/audio';
import { runtime } from '../lib/chrome';
import { Send, X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Pet({ streamer, ttsState }: { streamer: AudioStreamer, ttsState: 'idle' | 'playing' }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [loading, setLoading] = useState(false);

  // Position for dragging
  const [pos, setPos] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };
    const handleUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    const rect = (e.target as HTMLElement).closest('.zephyr-pet-drag')?.getBoundingClientRect();
    if (rect) {
      dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    } else {
      dragStart.current = { x: 40, y: 40 };
    }
  };

  useEffect(() => {
    const handleMsg = (req: any) => {
      if (req.type === 'LLM_CHUNK' && req.taskId === 'chat') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + req.chunk }];
          } else {
            return [...prev, { role: 'assistant', content: req.chunk }];
          }
        });
      } else if (req.type === 'LLM_DONE' && req.taskId === 'chat') {
        setLoading(false);
      }
    };
    runtime.addMessageListener(handleMsg);
  }, []);

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    if (input.startsWith('/read ')) {
      const text = input.slice(6);
      runtime.sendMessage({ type: 'TTS_START', text });
      setInput('');
      return;
    }

    const newArr = [...messages, { role: 'user', content: input }];
    setMessages(newArr);
    setInput('');
    setLoading(true);

    const prompt = [{ role: 'system', content: 'You are an English tutor assistant. Keep answers brief (under 50 words) and helpful.' }, ...newArr];
    runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'chat' });
  };
  
  if (!open) {
    return (
      <div 
        className="zephyr-pet-drag fixed w-16 h-16 bg-[#1D1D1F] rounded-full shadow-2xl shadow-black/20 flex items-center justify-center cursor-pointer ring-4 ring-white transition-transform hover:scale-110 select-none"
        style={{ left: pos.x, top: pos.y, zIndex: 2147483647 }}
        onPointerDown={handlePointerDown}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="w-7 h-7 text-white" />
        {ttsState === 'playing' && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#1D1D1F] animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div 
      className="fixed bg-white rounded-[28px] shadow-2xl shadow-gray-200/50 border border-white overflow-hidden flex flex-col font-sans"
      style={{ left: pos.x - 260, top: pos.y - 400, width: 340, height: 480, zIndex: 2147483647 }}
    >
      <div 
        className="zephyr-pet-drag p-5 bg-[#FBFBFD] border-b border-[#F5F5F7] flex items-center justify-between cursor-move select-none"
        onPointerDown={handlePointerDown}
      >
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] flex items-center justify-center">
             <Sparkles className="w-4 h-4 text-white" />
           </div>
           <div>
             <span className="block text-[14px] font-semibold tracking-tight text-[#1D1D1F] leading-tight">Zephyr AI</span>
             <span className="block text-[11px] text-[#86868B] font-medium leading-tight mt-0.5">Always listening</span>
           </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full text-[#86868B] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
         {messages.length === 0 && (
           <div className="text-center text-[#86868B] text-[13px] mt-10">
             Need help with anything on this page? I'm listening! Type <code className="bg-[#F5F5F7] text-[#424245] px-1 py-0.5 rounded">/read txt</code> to test TTS.
           </div>
         )}
         {messages.map((m, i) => (
           <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
               m.role === 'user' ? 'bg-[#1D1D1F] text-white border-none rounded-br-sm' : 'bg-[#F5F5F7] text-[#424245] border-none rounded-bl-sm'
             }`}>
                {m.role === 'user' ? m.content : <ReactMarkdown className="zephyr-markdown">{m.content}</ReactMarkdown>}
             </div>
           </div>
         ))}
         {loading && (
           <div className="flex justify-start">
             <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#F5F5F7] rounded-bl-sm flex items-center gap-2 text-[#86868B] shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> <span className="text-[13px]">Thinking...</span>
             </div>
           </div>
         )}
      </div>

      <div className="p-4 border-t border-[#F5F5F7] bg-white">
        <form onSubmit={submit} className="relative flex items-center">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question..." 
            className="w-full bg-[#F5F5F7] border-none rounded-xl pl-4 pr-12 py-3 text-[13px] text-[#1D1D1F] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B] outline-none"
          />
          <button type="submit" disabled={!input.trim() || loading} className="absolute right-2 w-8 h-8 flex items-center justify-center bg-[#1D1D1F] text-white rounded-[10px] disabled:opacity-50 hover:bg-black transition-colors shadow-md">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
