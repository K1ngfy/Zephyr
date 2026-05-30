import React, { useEffect, useState, useRef } from 'react';
import { runtime } from './lib/chrome';
import { AudioStreamer } from './lib/audio';
import Popover from './components/Popover';
import Pet from './components/Pet';
import Sidebar from './components/Sidebar';
import { Volume2, Sparkles, Languages } from 'lucide-react';

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
      } else if (request.type === 'LLM_DONE' && request.taskId === 'explain') {
        // Option to play TTS after explain
      }
    };

    runtime.onMessage.addListener(handleMessage);
    
    const handleMouseUp = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.zephyr-root')) return;

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
      if ((e.target as HTMLElement).closest('.zephyr-root')) return;
      setPopover(prev => ({ ...prev, show: false }));
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleDocumentClick);
    
    return () => {
      runtime.onMessage.removeListener(handleMessage);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [popover.text]);

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
    <div className="zephyr-root text-base antialiased" onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
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
          onTranslateModeChange={(mode) => {
             setTranslateMode(mode);
             if (translateText) {
                setTranslateLlmOutput('Thinking...');
                const sysPrompt = mode === 'zh2en' 
                  ? '你是一个专业的翻译。请将以下中文翻译成英文。只输出翻译结果，不要任何额外解释。'
                  : '你是一个专业的翻译。请将以下英文翻译成中文。只输出翻译结果，不要任何额外解释。';
                const prompt = [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: translateText }
                ];
                runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'translate' });
             }
          }}
          onTranslateChange={(text) => {
             setTranslateText(text);
          }}
          onTranslateTrigger={() => {
             if (translateText) {
                setTranslateLlmOutput('Thinking...');
                const sysPrompt = translateMode === 'zh2en' 
                  ? '你是一个专业的翻译。请将以下中文翻译成英文。只输出翻译结果，不要任何额外解释。'
                  : '你是一个专业的翻译。请将以下英文翻译成中文。只输出翻译结果，不要任何额外解释。';
                const prompt = [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: translateText }
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

      <Pet ttsState={ttsState} onClick={popSidebarChat} />
    </div>
  );
}
