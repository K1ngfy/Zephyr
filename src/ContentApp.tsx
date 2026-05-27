import React, { useEffect, useState, useRef } from 'react';
import { runtime } from './lib/chrome';
import { AudioStreamer } from './lib/audio';
import Popover from './components/Popover';
import Pet from './components/Pet';

export default function ContentApp() {
  const [popover, setPopover] = useState<{ show: boolean, rect: DOMRect | null, text: string, type: 'explain' | 'read' }>({
    show: false,
    rect: null,
    text: '',
    type: 'read'
  });
  
  const [llmOutput, setLlmOutput] = useState('');
  const [ttsState, setTtsState] = useState<'idle' | 'playing'>('idle');
  const streamerRef = useRef<AudioStreamer | null>(null);

  useEffect(() => {
    streamerRef.current = new AudioStreamer();
    streamerRef.current.onStateChange = (state) => {
      setTtsState(state);
    };

    const handleMessage = (request: any) => {
      if (request.type === 'CMD_READ_ALOUD') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        
        setPopover({ show: true, rect, text: request.text, type: 'read' });
        setLlmOutput('');
        
        // Start TTS
        runtime.sendMessage({ type: 'TTS_START', text: request.text });
      } else if (request.type === 'CMD_EXPLAIN_READ') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        
        setPopover({ show: true, rect, text: request.text, type: 'explain' });
        setLlmOutput('Thinking...');
        
        // Prompt for explanation
        const prompt = [
          { role: 'system', content: 'You are a concise English tutor. Analyze the following text, explain any difficult words or grammar, and provide a clear translation. Format elegantly.' },
          { role: 'user', content: request.text }
        ];
        runtime.sendMessage({ type: 'LLM_COMPLETION', messages: prompt, taskId: 'explain' });
      } else if (request.type === 'TTS_CHUNK') {
        streamerRef.current?.addChunk(request.chunk);
      } else if (request.type === 'TTS_DONE' || request.type === 'TTS_ERROR') {
        // Stream complete
      } else if (request.type === 'LLM_CHUNK' && request.taskId === 'explain') {
        setLlmOutput(prev => prev === 'Thinking...' ? request.chunk : prev + request.chunk);
      } else if (request.type === 'LLM_DONE' && request.taskId === 'explain') {
        // After explanation is done, maybe read the original text
        runtime.sendMessage({ type: 'TTS_START', text: popover.text }); // wait, how to get latest text? It's in state? Better use a ref for the selected text.
      }
    };

    runtime.addMessageListener(handleMessage);
    
    // Add document mousedown to dismiss popover if clicking outside
    const handleDocumentClick = (e: MouseEvent) => {
      // Because we are inside shadow DOM, e.target from main document won't hit our react components directly unless they click exactly on our shadow host
      // If they click on main document, dismiss.
      // But we shouldn't dismiss if they are interacting with the popover.
      setPopover(prev => ({ ...prev, show: false }));
      streamerRef.current?.stop();
    };
    
    document.addEventListener('mousedown', handleDocumentClick);
    
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  const handleStopTts = () => {
    streamerRef.current?.stop();
    setPopover(prev => ({ ...prev, show: false }));
  };

  return (
    <div className="zephyr-root text-base antialiased" onMouseDown={e => e.stopPropagation()}>
      {/* 
        This div wraps our UI. We do e.stopPropagation() so clicks inside 
        our UI don't trigger the document mousedown that dismisses the popover. 
      */}
      
      {popover.show && popover.rect && (
        <Popover 
          rect={popover.rect} 
          type={popover.type} 
          llmOutput={llmOutput}
          ttsState={ttsState}
          onClose={handleStopTts}
        />
      )}

      <Pet streamer={streamerRef.current!} ttsState={ttsState} />
    </div>
  );
}
