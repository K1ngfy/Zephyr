import React, { useEffect, useState, useRef } from 'react';
import { runtime, storage } from './lib/chrome';
import { AudioStreamer } from './lib/audio';
import Popover from './components/Popover';
import Pet from './components/Pet';
import Sidebar from './components/Sidebar';
import { Volume2, Sparkles, Languages, X } from 'lucide-react';

export default function ContentApp() {
  const [popover, setPopover] = useState<{ show: boolean, rect: DOMRect | null, text: string, type: 'explain' | 'read' }>({
    show: false,
    rect: null,
    text: '',
    type: 'read'
  });
  
  const [quickAction, setQuickAction] = useState<{ show: boolean, rect: DOMRect | null, text: string }>({
    show: false,
    rect: null,
    text: ''
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'explain' | 'favorites' | 'translate'>('chat');
  const [explainText, setExplainText] = useState('');
  
  const [translateText, setTranslateText] = useState('');
  const [translateLlmOutput, setTranslateLlmOutput] = useState('');
  const [translateMode, setTranslateMode] = useState<'en2zh' | 'zh2en'>('en2zh');
  
  const [llmOutput, setLlmOutput] = useState('');
  const [ttsState, setTtsState] = useState<'idle' | 'playing'>('idle');
  const [ttsChunks, setTtsChunks] = useState<string[]>([]);
  const streamerRef = useRef<AudioStreamer | null>(null);

  const [showPetIcon, setShowPetIcon] = useState(true);
  const [shortcutKey, setShortcutKey] = useState('Alt+Z');
  
  const [hiddenDomains, setHiddenDomains] = useState<string[]>([]);
  const [tempHiddenPet, setTempHiddenPet] = useState(false);
  const [showPetCloseDialog, setShowPetCloseDialog] = useState(false);

  useEffect(() => {
     try {
       storage.get(['showPetIcon', 'shortcutKey', 'zephyr_hidden_domains']).then((res: any) => {
         setShowPetIcon(res.showPetIcon !== false);
         setShortcutKey(res.shortcutKey || 'Alt+Z');
         setHiddenDomains(res.zephyr_hidden_domains || []);
       }).catch((e) => console.error("Storage error:", e));
       
       const handleStorageChange = (changes: any, areaName: string) => {
         if (areaName === 'local') {
           if (changes.showPetIcon) {
             setShowPetIcon(changes.showPetIcon.newValue !== false);
           }
           if (changes.shortcutKey) {
             setShortcutKey(changes.shortcutKey.newValue || 'Alt+Z');
           }
           if (changes.zephyr_hidden_domains) {
             setHiddenDomains(changes.zephyr_hidden_domains.newValue || []);
           }
         }
       };
       if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener(handleStorageChange);
          return () => chrome.storage.onChanged.removeListener(handleStorageChange);
       }
     } catch (e) {
       console.error("Storage error:", e);
     }
  }, []);

  useEffect(() => {
    const handleMessage = (request: any) => {
      if (request.type === 'TOGGLE_SIDEBAR') {
        setSidebarOpen(prev => {
           if (!prev) setActiveTab('favorites');
           return !prev;
        });
      } else if (request.type === 'CMD_READ_ALOUD') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        
        setPopover({ show: true, rect, text: request.text, type: 'read' });
        setQuickAction(prev => ({ ...prev, show: false }));
        setSidebarOpen(false);
        
        streamerRef.current?.stop();
        streamerRef.current = new AudioStreamer();
        streamerRef.current.onStateChange = setTtsState;
        setTtsChunks([]);
        runtime.sendMessage({ type: 'TTS_START', text: request.text });
      } else if (request.type === 'CMD_EXPLAIN_READ') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        
        setQuickAction(prev => ({ ...prev, show: false }));
        setPopover(prev => ({ ...prev, show: false }));
        setSidebarOpen(true);
        setActiveTab('explain');
        setExplainText(request.text);
        setLlmOutput('Thinking...');
        setTtsChunks([]); // Preparing for potential TTS
        
        const prompt = [
          { role: 'system', content: '你是一个专业的英语助教。请仔细分析用户发送的英语文本，提供准确流畅的中文翻译，并对其中较难的单词或语法结构进行中文讲解介绍。切记：只进行语言层面的翻译和语法解释，不要对文本内容进行事实性的拓展或解释。排版清晰整洁。' },
          { role: 'user', content: request.text }
        ];
        runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'explain' });
      } else if (request.type === 'TTS_CHUNK') {
        streamerRef.current?.addChunk(request.chunk);
        setTtsChunks(prev => [...prev, request.chunk]);
      } else if (request.type === 'TTS_DONE' || request.type === 'TTS_ERROR') {
        streamerRef.current?.signalDone();
      } else if (request.type === 'LLM_CHUNK' && request.taskId === 'explain') {
        setLlmOutput(prev => prev === 'Thinking...' ? request.chunk : prev + request.chunk);
      } else if (request.type === 'LLM_CHUNK' && request.taskId === 'translate') {
        setTranslateLlmOutput(prev => prev === 'Thinking...' ? request.chunk : prev + request.chunk);
      } else if (request.type === 'LLM_ERROR' && request.taskId === 'explain') {
        setLlmOutput(`Error: ${request.error}`);
      } else if (request.type === 'LLM_ERROR' && request.taskId === 'translate') {
        setTranslateLlmOutput(`Error: ${request.error}`);
      } else if (request.type === 'LLM_DONE' && request.taskId === 'explain') {
        // Option to play TTS after explain
      }
    };

    runtime.onMessage.addListener(handleMessage);
    
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.zephyr-root') || target?.closest?.('#zephyr-extension-root')) return;

      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          const text = selection.toString().trim();
          if (text) {
             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             setQuickAction({ show: true, rect, text });
             return;
          }
        }
        setQuickAction(prev => prev.show ? { ...prev, show: false } : prev);
      }, 10);
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.zephyr-root') || target?.closest?.('#zephyr-extension-root')) return;
      setPopover(prev => ({ ...prev, show: false }));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
       const target = e.target as HTMLElement;
       if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable) {
           return;
       }

       if (shortcutKey) {
           const parts = shortcutKey.toLowerCase().split('+');
           const keyPart = parts.pop();
           const hasAlt = parts.includes('alt');
           const hasCtrl = parts.includes('ctrl');
           const hasShift = parts.includes('shift');
           const hasMeta = parts.includes('cmd') || parts.includes('meta');
           
           const currentKey = e.code.replace('Key', '').replace('Digit', '').toLowerCase();

           if ((currentKey === keyPart || e.key.toLowerCase() === keyPart) &&
               e.altKey === hasAlt && 
               e.ctrlKey === hasCtrl && 
               e.shiftKey === hasShift &&
               e.metaKey === hasMeta) {
               e.preventDefault();
               setSidebarOpen(prev => !prev);
           }
       }
    };
    
    document.addEventListener('mouseup', handleMouseUp, { capture: true });
    document.addEventListener('mousedown', handleDocumentClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      runtime.onMessage.removeListener(handleMessage);
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.removeEventListener('mousedown', handleDocumentClick, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [popover.text, shortcutKey]);

  const handleStopTts = () => {
    streamerRef.current?.stop();
    setPopover(prev => ({ ...prev, show: false }));
  };

  const handleReplayTts = () => {
    streamerRef.current?.stop();
    streamerRef.current = new AudioStreamer();
    streamerRef.current.onStateChange = setTtsState;
    if (ttsChunks.length > 0) {
      ttsChunks.forEach(chunk => streamerRef.current?.addChunk(chunk));
      streamerRef.current?.signalDone();
    } else {
      runtime.sendMessage({ type: 'TTS_START', text: popover.text });
    }
  };

  const popSidebarChat = () => {
    setSidebarOpen(true);
    if (activeTab === 'favorites') { // Keep explain if they clicked Pet but had explain active? Just set Chat
       setActiveTab('chat');
    } else {
       setActiveTab('chat');
    }
  };

  return (
    <div className="zephyr-root font-sans text-left text-base antialiased left-0 top-0 [&_svg]:shrink-0" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
      {quickAction.show && quickAction.rect && !popover.show && (
        <div 
          className="absolute bg-[#1D1D1F] rounded-xl shadow-xl flex items-center p-1.5 gap-1 z-[2147483647] animate-in fade-in duration-200"
          style={{
            top: quickAction.rect.top > 60 ? quickAction.rect.top + window.scrollY - 50 : quickAction.rect.bottom + window.scrollY + 10,
            left: quickAction.rect.left + window.scrollX + (quickAction.rect.width / 2) - 60,
          }}
        >
          <button 
             onMouseDown={(e) => e.preventDefault()}
             title="Read"
             onClick={() => {
                setQuickAction(prev => ({ ...prev, show: false }));
                setPopover({ show: true, rect: quickAction.rect!, text: quickAction.text, type: 'read' });
                setSidebarOpen(false);
                streamerRef.current?.stop();
                streamerRef.current = new AudioStreamer();
                streamerRef.current.onStateChange = setTtsState;
                setTtsChunks([]);
                runtime.sendMessage({ type: 'TTS_START', text: quickAction.text });
             }}
             className="p-2 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer border-none"
          >
             <Volume2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-white/20" />
          <button 
             onMouseDown={(e) => e.preventDefault()}
             title="Explain"
             onClick={() => {
                setQuickAction(prev => ({ ...prev, show: false }));
                setPopover(prev => ({ ...prev, show: false }));
                setSidebarOpen(true);
                setActiveTab('explain');
                setExplainText(quickAction.text);
                setLlmOutput('Thinking...');
                setTtsChunks([]);
                const prompt = [
                  { role: 'system', content: '你是一个专业的英语助教。请仔细分析用户发送的英语文本，提供准确流畅的中文翻译，并对其中较难的单词或语法结构进行中文讲解介绍。切记：只进行语言层面的翻译和语法解释，不要对文本内容进行事实性的拓展或解释。排版清晰整洁。' },
                  { role: 'user', content: quickAction.text }
                ];
                runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'explain' });
             }}
             className="p-2 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer border-none"
          >
             <Sparkles className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-white/20" />
          <button 
             onMouseDown={(e) => e.preventDefault()}
             title="Translate"
             onClick={() => {
                setQuickAction(prev => ({ ...prev, show: false }));
                setPopover(prev => ({ ...prev, show: false }));
                setSidebarOpen(true);
                setActiveTab('translate');
                setTranslateText(quickAction.text);
                setTranslateLlmOutput('Thinking...');
                
                const isZh = /[\u4e00-\u9fa5]/.test(quickAction.text);
                const mode = isZh ? 'zh2en' : 'en2zh';
                setTranslateMode(mode);
                
                const sysPrompt = mode === 'zh2en' 
                  ? '你是一个专业的翻译。请将以下中文翻译成英文。只输出翻译结果，不要任何额外解释。'
                  : '你是一个专业的翻译。请将以下英文翻译成中文。只输出翻译结果，不要任何额外解释。';
                
                const prompt = [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: quickAction.text }
                ];
                runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'translate' });
             }}
             className="p-2 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer border-none"
          >
             <Languages className="w-4 h-4" />
          </button>
          
          <div className="w-[1px] h-3 bg-white/20 mx-0.5" />
          
          <button 
             onMouseDown={(e) => e.preventDefault()}
             onClick={() => {
               setQuickAction(prev => ({ ...prev, show: false }));
               
               // Optional: Clear selection so it doesn't pop up again if they click elsewhere and accidentally drag,
               // but usually they just want to close the popup while keeping text selected to copy it.
               // We will keep selection active.
             }}
             title="Close"
             className="p-1 hover:bg-white/20 text-white/60 hover:text-white rounded-md transition-colors flex items-center justify-center cursor-pointer border-none"
          >
             <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {popover.show && popover.rect && (
        <Popover 
          rect={popover.rect} 
          type={popover.type} 
          text={popover.text}
          llmOutput={llmOutput}
          ttsState={ttsState}
          ttsChunks={ttsChunks}
          onClose={handleStopTts}
          onReplay={handleReplayTts}
        />
      )}

      {sidebarOpen && (
        <Sidebar 
          initialTab={activeTab}
          explainText={explainText}
          explainLlmOutput={llmOutput}
          explainTtsChunks={ttsChunks}
          translateText={translateText}
          translateLlmOutput={translateLlmOutput}
          translateMode={translateMode}
          onTranslateModeChange={(mode, textOverride?: string) => {
             setTranslateMode(mode);
          }}
          onTranslateChange={(text) => {
             setTranslateText(text);
          }}
          onTranslateTrigger={(textOverride?: string, modeOverride?: string) => {
             const textToTranslate = textOverride || translateText;
             const modeToUse = modeOverride || translateMode;
             if (textToTranslate) {
                setTranslateLlmOutput('Thinking...');
                const sysPrompt = modeToUse === 'zh2en' 
                  ? '你是一个专业的翻译。请将以下中文翻译成英文。只输出翻译结果，不要任何额外解释。'
                  : '你是一个专业的翻译。请将以下英文翻译成中文。只输出翻译结果，不要任何额外解释。';
                const prompt = [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: textToTranslate }
                ];
                runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'translate' });
             }
          }}
          onClose={() => setSidebarOpen(false)}
          ttsState={ttsState}
          playTTS={(chunks, text) => {
            streamerRef.current?.stop();
            streamerRef.current = new AudioStreamer();
            streamerRef.current.onStateChange = setTtsState;
            if (chunks && chunks.length > 0) {
              chunks.forEach(c => streamerRef.current?.addChunk(c));
              streamerRef.current?.signalDone();
            } else if (text) {
              setTtsChunks([]);
              runtime.sendMessage({ type: 'TTS_START', text });
            }
          }}
        />
      )}

      {showPetIcon && !tempHiddenPet && !hiddenDomains.includes(window.location.hostname) && (
        <>
          <Pet 
            ttsState={ttsState} 
            onClick={popSidebarChat} 
            onCloseClick={() => setShowPetCloseDialog(true)} 
          />
          {showPetCloseDialog && (
            <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)', pointerEvents: 'auto' }}>
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-[320px] w-full mx-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-[#1D1D1F] font-semibold text-lg mb-2">关闭水豚助手</h3>
                <p className="text-[#86868B] text-sm mb-6 leading-relaxed">
                  您希望临时隐藏，还是在该网站上永久隐藏水豚？您随时可以在插件的设置页面重新开启。
                </p>
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      setTempHiddenPet(true);
                      setShowPetCloseDialog(false);
                    }}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1D1D1F] rounded-xl font-medium transition-colors text-sm"
                  >
                    仅本次隐藏
                  </button>
                  <button 
                    onClick={() => {
                       const currentDomain = window.location.hostname;
                       const newHiddenDomains = [...hiddenDomains, currentDomain];
                       setHiddenDomains(newHiddenDomains);
                       try {
                           storage.set({ zephyr_hidden_domains: newHiddenDomains });
                       } catch (e) { console.error(e); }
                       setShowPetCloseDialog(false);
                    }}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-colors text-sm"
                  >
                    在该网站 ({window.location.hostname}) 永久隐藏
                  </button>
                  <button 
                    onClick={() => setShowPetCloseDialog(false)}
                    className="w-full py-2.5 text-[#86868B] hover:text-[#1D1D1F] font-medium transition-colors text-sm mt-2"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </  >
      )}
    </div>
  );
}
