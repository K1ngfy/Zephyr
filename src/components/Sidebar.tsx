import React, { useState, useEffect } from 'react';
import { X, Sparkles, MessageSquareText, Bookmark, MessageCircle, Play, Trash2, Send, Loader2, ArrowRightLeft, Languages, Pin, PinOff, Copy, Check, History, MessageSquarePlus, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { storage, runtime } from '../lib/chrome';

interface SidebarProps {
  initialTab?: 'chat' | 'explain' | 'favorites' | 'translate';
  
  // Explain Props
  explainText: string;
  explainLlmOutput: string;
  explainTtsChunks?: string[];

  // Translate Props
  translateText?: string;
  translateLlmOutput?: string;
  translateMode?: 'en2zh' | 'zh2en';
  onTranslateModeChange?: (mode: 'en2zh' | 'zh2en', textOverride?: string) => void;
  onTranslateChange?: (text: string) => void;
  onTranslateTrigger?: (textOverride?: string, modeOverride?: string) => void;
  
  // Handlers
  onClose: () => void;
  ttsState?: 'idle' | 'playing';
  playTTS: (chunks: string[], text?: string) => void;
}

export default function Sidebar({ 
  initialTab = 'chat', 
  explainText, 
  explainLlmOutput, 
  explainTtsChunks = [], 
  translateText = '',
  translateLlmOutput = '',
  translateMode = 'en2zh',
  onTranslateModeChange,
  onTranslateChange,
  onTranslateTrigger,
  onClose, 
  ttsState = 'idle',
  playTTS 
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'explain' | 'favorites' | 'translate'>(initialTab);
  const [isPinned, setIsPinned] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [playingTextId, setPlayingTextId] = useState<string | null>(null);

  const [autoRead, setAutoRead] = useState(false);
  const autoReadRef = React.useRef(autoRead);
  autoReadRef.current = autoRead;

  const explainLlmOutputRef = React.useRef(explainLlmOutput);
  explainLlmOutputRef.current = explainLlmOutput;

  const handlePlayTTS = (chunks: string[], text: string) => {
     setPlayingTextId(text);
     playTTS(chunks, text);
  };
  
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove, { capture: true });
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, [isDragging]);
  
  // Favorites State
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favFilter, setFavFilter] = useState<'all' | 'explain' | 'read'>('all');

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  
  const displayExplainText = selectedHistory?.type === 'explain' ? selectedHistory.data.text : explainText;
  const displayExplainOutput = selectedHistory?.type === 'explain' ? selectedHistory.data.explain : explainLlmOutput;
  const isExplainSaved = favorites.some(f => f.text === displayExplainText && f.explain === displayExplainOutput);

  const displayTranslateText = selectedHistory?.type === 'translate' ? selectedHistory.data.text : translateText;
  const displayTranslateOutput = selectedHistory?.type === 'translate' ? selectedHistory.data.translate : translateLlmOutput;
  const displayTranslateMode = selectedHistory?.type === 'translate' ? selectedHistory.data.mode : translateMode;

  const activeTranslateSessionRef = React.useRef({ text: '', mode: 'en2zh' });
  const activeExplainSessionRef = React.useRef({ text: '' });

  React.useEffect(() => {
     if (explainLlmOutput === 'Thinking...') {
        activeExplainSessionRef.current = { text: explainText };
     }
  }, [explainLlmOutput, explainText]);

  const handleTranslateTrigger = (textOverride?: string, modeOverride?: string) => {
     const t = textOverride || displayTranslateText;
     const m = modeOverride || displayTranslateMode;
     activeTranslateSessionRef.current = { text: t, mode: m };
     onTranslateTrigger?.(t, m);
  };

  const translateLlmOutputRef = React.useRef(translateLlmOutput);
  translateLlmOutputRef.current = translateLlmOutput;

  const [chatId, setChatId] = useState(() => Date.now().toString());
  const chatIdRef = React.useRef(chatId);
  chatIdRef.current = chatId;

  const upsertHistory = async (type: string, data: any, id: string) => {
    setHistory(prev => {
      const existingIdx = prev.findIndex(h => h.id === id);
      let newHistory;
      const newItem = { id, type, data, date: new Date().toISOString() };
      if (existingIdx >= 0) {
        newHistory = [...prev];
        newHistory[existingIdx] = newItem;
      } else {
        newHistory = [newItem, ...prev].slice(0, 100);
      }
      storage.set({ zephyr_history: newHistory }).catch(console.error);
      return newHistory;
    });
  };

  useEffect(() => {
    storage.get(['zephyr_favorites', 'zephyr_history']).then(res => {
      if (res.zephyr_favorites) setFavorites(res.zephyr_favorites);
      if (res.zephyr_history) setHistory(res.zephyr_history);
    }).catch(console.error);

    const handleStorageChange = (changes: any, areaName: string) => {
       if (areaName === 'local') {
         if (changes.zephyr_favorites) setFavorites(changes.zephyr_favorites.newValue || []);
         if (changes.zephyr_history) setHistory(changes.zephyr_history.newValue || []);
       }
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
       chrome.storage.onChanged.addListener(handleStorageChange);
    }

    const handleMsg = (req: any) => {
      if (req.type === 'LLM_CHUNK' && req.taskId === 'chat') {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + req.chunk }];
          } else {
            return [...prev, { role: 'assistant', content: req.chunk }];
          }
        });
      } else if (req.type === 'LLM_ERROR' && req.taskId === 'chat') {
        setChatLoading(false);
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content || `Error: ${req.error}` }];
          } else {
            return [...prev, { role: 'assistant', content: `Error: ${req.error}` }];
          }
        });
      } else if (req.type === 'LLM_DONE' && req.taskId === 'chat') {
        setChatLoading(false);
        setChatMessages(prev => {
           const last = prev[prev.length - 1];
           if (autoReadRef.current && last && last.role === 'assistant') {
              setTimeout(() => {
                 playTTS([], last.content);
                 setPlayingTextId(last.content);
              }, 100);
           }
           upsertHistory('chat', { messages: prev }, chatIdRef.current);
           return prev;
        });
      } else if (req.type === 'LLM_DONE' && req.taskId === 'explain') {
        if (autoReadRef.current && explainLlmOutputRef.current) {
           setTimeout(() => {
              playTTS([], explainLlmOutputRef.current);
              setPlayingTextId(explainLlmOutputRef.current);
           }, 100);
        }
        upsertHistory('explain', { 
           text: activeExplainSessionRef.current.text || explainText, 
           explain: explainLlmOutputRef.current 
        }, Date.now().toString());
      } else if (req.type === 'LLM_DONE' && req.taskId === 'translate') {
        upsertHistory('translate', { 
           text: activeTranslateSessionRef.current.text || displayTranslateText, 
           translate: translateLlmOutputRef.current, 
           mode: activeTranslateSessionRef.current.mode || displayTranslateMode 
        }, Date.now().toString());
      }
    };
    runtime.onMessage.addListener(handleMsg);
    return () => {
      runtime.onMessage.removeListener(handleMsg);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
         chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

   const startNewChat = () => {
      if (chatMessages.length > 0) {
         setChatMessages([]);
         setChatId(Date.now().toString());
      }
   };


   const handleSaveExplain = async () => {
    if (!explainText) return;
    
    if (isExplainSaved) {
       const newFavs = favorites.filter(f => !(f.text === explainText && f.explain === explainLlmOutput));
       setFavorites(newFavs);
       await storage.set({ zephyr_favorites: newFavs });
    } else {
       const newFavs = [{
         text: explainText,
         explain: explainLlmOutput,
         audioChunks: explainTtsChunks,
         date: new Date().toISOString()
       }, ...favorites];
       
       setFavorites(newFavs);
       await storage.set({ zephyr_favorites: newFavs });
    }
  };

  const removeFavorite = async (favToRemove: any) => {
    const newFavs = favorites.filter(f => f !== favToRemove);
    setFavorites(newFavs);
    await storage.set({ zephyr_favorites: newFavs });
  };

  const submitChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    if (chatInput.startsWith('/read ')) {
      const text = chatInput.slice(6);
      runtime.sendMessage({ type: 'TTS_START', text });
      setChatInput('');
      return;
    }

    const newArr = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newArr);
    setChatInput('');
    setChatLoading(true);
    upsertHistory('chat', { messages: newArr }, chatIdRef.current);

    const prompt = [{ role: 'system', content: 'You are an English tutor assistant. Keep answers brief (under 50 words) and helpful.' }, ...newArr];
    runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'chat' });
  };

  return (
    <>
      {!isPinned && (
        <div 
          className="fixed inset-0 bg-black/5 z-[2147483640] transition-opacity duration-300" 
          onClick={onClose}
        />
      )}
      
      <div 
        className="fixed top-0 bottom-0 right-0 bg-white shadow-2xl flex flex-col z-[2147483647] font-sans animate-in slide-in-from-right duration-300 border-l border-[#F5F5F7]"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* History Drawer sliding out to the left */}
        <div className={`absolute top-0 bottom-0 right-full bg-[#F9F9FB] border-l border-y border-[#F5F5F7] shadow-2xl transition-all duration-300 flex flex-col rounded-l-2xl overflow-hidden ${showHistory && activeTab !== 'favorites' ? 'w-[260px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-4 pointer-events-none'}`}>
           <div className="p-4 border-b border-[#F5F5F7] shrink-0 flex items-center justify-between">
              <h3 className="text-[14px] font-bold flex items-center gap-2 text-[#1D1D1F]"><History className="w-4 h-4"/> 历史记录</h3>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-200 rounded-lg text-[#86868B] transition-colors"><X className="w-4 h-4"/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.filter(h => h.type === activeTab).length === 0 ? (
                 <div className="text-center text-[#86868B] text-[13px] mt-10">No records.</div>
              ) : (
                 history.filter(h => h.type === activeTab).map((h, i) => (
                   <div 
                     key={i} 
                     onClick={() => {
                        if (h.type === 'chat') {
                           setChatMessages(h.data.messages);
                           setChatId(h.id);
                        } else {
                           setSelectedHistory(h);
                        }
                     }}
                     className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group"
                   >
                     <span className="text-[10px] font-medium text-[#86868B] group-hover:text-blue-500 transition-colors">{new Date(h.date).toLocaleString()}</span>
                     {h.type === 'chat' && <div className="text-[12px] text-[#424245] line-clamp-2">{h.data.messages[h.data.messages.length - 1]?.content}</div>}
                     {h.type === 'explain' && <div className="text-[12px] text-[#424245] font-medium line-clamp-1">"{h.data.text}"</div>}
                     {h.type === 'translate' && <div className="text-[12px] text-[#424245] font-medium line-clamp-1">"{h.data.text}"</div>}
                   </div>
                 ))
              )}
           </div>
        </div>

        <div 
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#0071E3]/20 transition-colors z-[50]"
          onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
        />
        <div className="p-2 border-b border-[#F5F5F7] flex items-center justify-between bg-white shrink-0 relative z-20">
           <div className="w-[32px] flex justify-start shrink-0 ml-1">
             {activeTab !== 'favorites' && (
               <button onClick={() => setShowHistory(!showHistory)} className={`p-1.5 rounded-xl transition-all ${showHistory ? 'bg-blue-50 text-[#0071E3]' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100'}`} title="View History">
                 <History className="w-4 h-4" />
               </button>
             )}
           </div>

           <div className="flex bg-[#F5F5F7] p-1 rounded-xl gap-0.5 flex-1 max-w-[280px]">
             <button 
               onClick={() => { setActiveTab('chat'); setSelectedHistory(null); setShowHistory(false); }}
               className={`px-1 py-1.5 flex-1 text-[12px] font-medium rounded-lg transition-all flex items-center justify-center ${activeTab === 'chat' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
             >
               Chat
             </button>
             <button 
               onClick={() => { setActiveTab('explain'); setSelectedHistory(null); setShowHistory(false); }}
               className={`px-1 py-1.5 flex-1 text-[12px] font-medium rounded-lg transition-all flex items-center justify-center ${activeTab === 'explain' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
             >
               Explain
             </button>
             <button 
               onClick={() => { setActiveTab('translate'); setSelectedHistory(null); setShowHistory(false); }}
               className={`px-1 py-1.5 flex-1 text-[12px] font-medium rounded-lg transition-all flex items-center justify-center ${activeTab === 'translate' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
             >
               Translate
             </button>
             <button 
               onClick={() => { setActiveTab('favorites'); setSelectedHistory(null); setShowHistory(false); }}
               className={`px-1 py-1.5 flex-1 text-[12px] font-medium rounded-lg transition-all flex items-center justify-center ${activeTab === 'favorites' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
             >
               Saved
             </button>
           </div>

           <div className="w-[135px] flex justify-end items-center gap-0.5 shrink-0 mr-1">
             {(activeTab === 'chat' || activeTab === 'explain') && (
                <button 
                  onClick={() => setAutoRead(!autoRead)} 
                  className={`p-1.5 rounded-full transition-colors ${autoRead ? 'text-[#0071E3] bg-blue-50' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100'}`} 
                  title={autoRead ? "Auto-read enabled" : "Auto-read disabled"}
                >
                  {autoRead ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
             )}
             {activeTab === 'chat' && (
               <button onClick={startNewChat} className="p-1.5 hover:bg-gray-100 rounded-full text-[#86868B] hover:text-[#1D1D1F] transition-colors" title="New Chat">
                 <MessageSquarePlus className="w-4 h-4" />
               </button>
             )}
             <button onClick={() => setIsPinned(!isPinned)} className={`p-1.5 rounded-full transition-colors ${isPinned ? 'bg-blue-50 text-[#0071E3]' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100'}`} title={isPinned ? "Unpin sidebar" : "Pin sidebar"}>
               {isPinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
             </button>
             <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-[#86868B] hover:text-[#1D1D1F] transition-colors" title="Close sidebar">
               <X className="w-4 h-4" />
             </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white flex flex-col relative h-full min-h-0">
               {activeTab === 'chat' && (
             <div className="flex-1 flex flex-col pt-5">
                <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-5">
                   {chatMessages.length === 0 && (
                     <div className="text-center text-[#86868B] text-[13px] mt-10">
                       Need help with anything on this page? I'm listening! Type <code className="bg-[#F5F5F7] text-[#424245] px-1 py-0.5 rounded">/read txt</code> to test TTS.
                     </div>
                   )}
                   {chatMessages.map((m, i) => (
                     <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} group relative`}>
                       <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                         m.role === 'user' ? 'bg-[#1D1D1F] text-white border-none rounded-br-sm' : 'bg-[#F5F5F7] text-[#424245] border-none rounded-bl-sm relative'
                       }`}>
                          {m.role === 'user' ? m.content : (
                            <div className="flex flex-col gap-2">
                              <div className="zephyr-markdown"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200">
                                 <button onClick={() => navigator.clipboard.writeText(m.content)} className="p-1 px-2 hover:bg-white text-gray-500 rounded-lg transition-colors text-[11px] font-medium shadow-sm" title="Copy text">
                                   <Copy className="w-3.5 h-3.5" />
                                 </button>
                                 <button onClick={() => handlePlayTTS([], m.content)} className={`p-1 px-2 hover:bg-white rounded-lg transition-colors text-[11px] font-medium shadow-sm flex items-center ${playingTextId === m.content && ttsState === 'playing' ? 'text-blue-500' : 'text-gray-500'}`} title="Play audio">
                                   {playingTextId === m.content && ttsState === 'playing' ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : playingTextId === m.content && ttsState === 'idle' ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                 </button>
                              </div>
                            </div>
                          )}
                       </div>
                     </div>
                   ))}
                   {chatLoading && (
                     <div className="flex justify-start">
                       <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#F5F5F7] rounded-bl-sm flex items-center gap-2 text-[#86868B] shadow-sm">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> <span className="text-[13px]">Thinking...</span>
                       </div>
                     </div>
                   )}
                </div>
                <div className="p-4 border-t border-[#F5F5F7] bg-white shrink-0">
                  <form onSubmit={submitChat} className="relative flex items-center">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask a question..." 
                      className="w-full bg-[#F5F5F7] border-none rounded-xl pl-4 pr-12 py-3 text-[13px] text-[#1D1D1F] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B] outline-none"
                    />
                    <button type="submit" disabled={!chatInput.trim() || chatLoading} className="absolute right-2 w-8 h-8 flex items-center justify-center bg-[#1D1D1F] text-white rounded-[10px] disabled:opacity-50 hover:bg-black transition-colors shadow-md">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
             </div>
           )}

           {activeTab === 'explain' && (
             <div className="p-6 space-y-6">
                {!displayExplainText ? (
                  <div className="text-center text-[#86868B] text-[13px] mt-10">
                    Select text on the page and click "Explain" to see analysis here.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] uppercase tracking-wider font-bold text-[#86868B] flex items-center gap-1.5 flex-row">
                        <MessageSquareText className="w-3.5 h-3.5" /> Source Text
                      </h4>
                      <button onClick={handleSaveExplain} className={`p-1.5 rounded-full transition-colors ${isExplainSaved ? 'text-blue-500 bg-blue-50' : 'text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'}`}>
                        <Bookmark className={`w-4 h-4 ${isExplainSaved ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <div className="bg-[#F5F5F7] p-4 rounded-xl text-[14px] leading-relaxed text-[#1D1D1F] border border-gray-100 selection:bg-blue-100 shadow-sm font-medium mt-2 mb-6">
                      "{displayExplainText}"
                    </div>

                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-[#0071E3] flex items-center gap-1.5 flex-row mb-3">
                      <Sparkles className="w-3.5 h-3.5" /> AI Analysis
                    </h4>
                    <div className="text-[14px] text-[#424245] leading-relaxed zephyr-markdown selection:bg-blue-100 relative group">
                       {displayExplainOutput === 'Thinking...' ? (
                         <div className="flex items-center gap-2 text-[#86868B] font-medium py-2">
                           <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                         </div>
                       ) : (
                         <>
                           <div className="zephyr-markdown"><ReactMarkdown>{displayExplainOutput}</ReactMarkdown></div>
                           <div className="flex items-center gap-1 mt-4 pt-4 border-t border-gray-100">
                             <button onClick={() => navigator.clipboard.writeText(displayExplainOutput)} className="p-1.5 hover:bg-gray-100 text-[#86868B] hover:text-[#1D1D1F] rounded-lg transition-colors text-[12px] font-medium" title="Copy text">
                               <Copy className="w-4 h-4" />
                             </button>
                             <button onClick={() => handlePlayTTS([], displayExplainOutput)} className={`p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-[12px] font-medium flex items-center ${playingTextId === displayExplainOutput && ttsState === 'playing' ? 'text-blue-500' : 'text-[#86868B] hover:text-[#1D1D1F]'}`} title="Play audio">
                               {playingTextId === displayExplainOutput && ttsState === 'playing' ? <Volume2 className="w-4 h-4 animate-pulse" /> : playingTextId === displayExplainOutput && ttsState === 'idle' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                             </button>
                           </div>
                         </>
                       )}
                    </div>
                  </>
                )}
             </div>
           )}

           {activeTab === 'translate' && (
             <div className="p-6 space-y-4 flex flex-col">
                <div className="flex bg-[#F5F5F7] p-1 rounded-xl gap-1 shrink-0">
                  <button 
                    onClick={() => {
                        if (selectedHistory) {
                           onTranslateChange?.(displayTranslateText);
                           setSelectedHistory(null);
                        }
                        onTranslateModeChange?.('en2zh');
                    }}
                    className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${displayTranslateMode === 'en2zh' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                  >
                    英译中
                  </button>
                  <button 
                    onClick={() => {
                        if (selectedHistory) {
                           onTranslateChange?.(displayTranslateText);
                           setSelectedHistory(null);
                        }
                        onTranslateModeChange?.('zh2en');
                    }}
                    className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${displayTranslateMode === 'zh2en' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                  >
                    中译英
                  </button>
                </div>
                
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-[#86868B] flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5" /> Source Text
                    </h4>
                    <textarea 
                      value={displayTranslateText}
                      onChange={(e) => {
                         if (selectedHistory) {
                            onTranslateChange?.(e.target.value);
                            if (onTranslateModeChange && selectedHistory.data.mode) {
                               onTranslateModeChange(selectedHistory.data.mode);
                            }
                            setSelectedHistory(null);
                         } else {
                            onTranslateChange?.(e.target.value);
                         }
                      }}
                      placeholder="Enter text to translate..."
                      className="w-full min-h-[200px] bg-[#F5F5F7] p-4 rounded-xl text-[14px] leading-relaxed text-[#1D1D1F] border-2 border-transparent focus:border-[#0071E3] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.15)] outline-none resize-y transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2 flex-shrink-0">
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-[#0071E3] flex items-center gap-1.5">
                      {displayTranslateOutput && <><ArrowRightLeft className="w-3.5 h-3.5" /> Translation</>}
                    </h4>
                    <button onClick={() => {
                        if (selectedHistory) {
                           onTranslateChange?.(displayTranslateText);
                           if (onTranslateModeChange && selectedHistory.data.mode) {
                              onTranslateModeChange?.(selectedHistory.data.mode, displayTranslateText);
                           }
                           setSelectedHistory(null);
                        }
                        handleTranslateTrigger();
                    }} className="bg-[#1D1D1F] hover:bg-[#000000] text-white px-4 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 shadow-sm active:opacity-80 transition-all">
                      <Sparkles className="w-3.5 h-3.5" /> 翻译
                    </button>
                  </div>

                  {displayTranslateOutput && (
                    <div className="flex flex-col gap-2">
                      <div className="bg-[#F5F5F7] flex-col p-4 rounded-xl border border-gray-100 relative group">
                         <div className="text-[14px] text-[#424245] leading-relaxed zephyr-markdown selection:bg-blue-100 flex-col">
                            {displayTranslateOutput === 'Thinking...' ? (
                              <div className="flex items-center gap-2 text-[#86868B] font-medium py-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Translating...
                              </div>
                            ) : (
                              <>
                                <div className="zephyr-markdown"><ReactMarkdown>{displayTranslateOutput}</ReactMarkdown></div>
                                <div className="flex items-center gap-1 mt-4 pt-4 border-t border-gray-200">
                                  <button onClick={() => navigator.clipboard.writeText(displayTranslateOutput)} className="p-1.5 hover:bg-gray-200 text-[#86868B] hover:text-[#1D1D1F] rounded-lg transition-colors text-[12px] font-medium shadow-sm" title="Copy text">
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handlePlayTTS([], displayTranslateOutput)} className={`p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-[12px] font-medium shadow-sm flex items-center ${playingTextId === displayTranslateOutput && ttsState === 'playing' ? 'text-blue-500' : 'text-[#86868B] hover:text-[#1D1D1F]'}`} title="Play audio">
                                    {playingTextId === displayTranslateOutput && ttsState === 'playing' ? <Volume2 className="w-4 h-4 animate-pulse" /> : playingTextId === displayTranslateOutput && ttsState === 'idle' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                  </button>
                                </div>
                              </>
                            )}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
             </div>
           )}

           {activeTab === 'favorites' && (
             <div className="p-6 space-y-4 bg-[#F5F5F7] flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex bg-white p-1 rounded-xl gap-1 shrink-0 shadow-sm border border-gray-100">
                  <button 
                    onClick={() => setFavFilter('all')}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-all ${favFilter === 'all' ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFavFilter('explain')}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-all ${favFilter === 'explain' ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                  >
                    Explain
                  </button>
                  <button 
                    onClick={() => setFavFilter('read')}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-all ${favFilter === 'read' ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                  >
                    Speech
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4">
                  {favorites.filter(fav => {
                    if (favFilter === 'explain') return !!fav.explain;
                    if (favFilter === 'read') return !fav.explain;
                    return true;
                  }).length === 0 && (
                    <div className="text-center text-[#86868B] text-[13px] mt-10">
                      No related collection content.
                    </div>
                  )}
                  {favorites.filter(fav => {
                    if (favFilter === 'explain') return !!fav.explain;
                    if (favFilter === 'read') return !fav.explain;
                    return true;
                  }).map((fav, i) => (
                     <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                        <div className="text-[14px] font-medium text-[#1D1D1F] leading-relaxed">"{fav.text}"</div>
                        {fav.explain && (
                          <div className="pt-3 border-t border-gray-50 text-[13px] text-[#424245] zephyr-markdown mt-2">
                            <div className="zephyr-markdown"><ReactMarkdown>{fav.explain}</ReactMarkdown></div>
                          </div>
                        )}
                        
                        <div className="pt-3 flex items-center gap-2 border-t border-gray-50 mt-2">
                          <button onClick={() => navigator.clipboard.writeText(fav.explain || fav.text)} className="p-1.5 hover:bg-gray-100 text-[#86868B] hover:text-[#1D1D1F] rounded-lg transition-colors" title="Copy text">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePlayTTS(fav.audioChunks || [], fav.text)} className={`p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex items-center ${playingTextId === fav.text && ttsState === 'playing' ? 'text-blue-500' : 'text-[#86868B] hover:text-[#1D1D1F]'}`} title="Play audio">
                            {playingTextId === fav.text && ttsState === 'playing' ? <Volume2 className="w-4 h-4 animate-pulse" /> : playingTextId === fav.text && ttsState === 'idle' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <div className="flex-1"></div>
                          <button onClick={() => removeFavorite(fav)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                     </div>
                  ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </>
  );
}
