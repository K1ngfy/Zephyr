import { storage } from './lib/chrome';

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'zephyr_read_aloud',
      title: 'Read Aloud (Voice)',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'zephyr_explain_read',
      title: 'Explain & Read (LLM + Voice)',
      contexts: ['selection']
    });
    
    // Auto-open options if no key
    storage.get(['volcengineKey']).then((res: any) => {
      if (!res.volcengineKey) {
        chrome.runtime.openOptionsPage();
      }
    });
  });

  chrome.contextMenus.onClicked.addListener((info: any, tab: any) => {
    if (!tab?.id) return;
    if (info.menuItemId === 'zephyr_read_aloud') {
      chrome.tabs.sendMessage(tab.id, { type: 'CMD_READ_ALOUD', text: info.selectionText });
    } else if (info.menuItemId === 'zephyr_explain_read') {
      chrome.tabs.sendMessage(tab.id, { type: 'CMD_EXPLAIN_READ', text: info.selectionText });
    }
  });

  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    if (request.type === 'TTS_START') {
      handleTTS(request.text, sender.tab?.id).catch(err => console.error(err));
      sendResponse({ status: 'started' });
    } else if (request.type === 'LLM_COMPLETION') {
      handleLLM(request.messages, sender.tab?.id, request.taskId).catch(err => console.error(err));
      sendResponse({ status: 'started' });
    }
    return true; // Keep channel open for async
  });
}

async function handleTTS(text: string, tabId?: number) {
  if (!tabId) return;
  const config = await storage.get(['volcengineKey']);
  if (!config.volcengineKey) {
    chrome.tabs.sendMessage(tabId, { type: 'TTS_ERROR', error: 'API Key missing' });
    return;
  }

  const payload = {
    app: { appid: 'zephyr', token: 'mock', cluster: 'mock' },
    user: { uid: 'zephyr' },
    audio: { voice_type: 'BV700_streaming', speed_ratio: 1.0, encoding: 'mp3' },
    request: { reqid: crypto.randomUUID(), text: text, text_type: 'plain', operation: 'query' },
  };

  try {
    const response = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.volcengineKey,
        'X-Api-Resource-Id': 'seed-tts-2.0',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(payload)
    });

    if (!response.body) throw new Error('No body returned from TTS');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; 

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr && dataStr !== '[DONE]') {
             try {
               const parsed = JSON.parse(dataStr);
               const audioBase64 = parsed.data || parsed.audio; 
               if (audioBase64) {
                 chrome.tabs.sendMessage(tabId, { type: 'TTS_CHUNK', chunk: audioBase64 });
               }
             } catch(e) {}
          }
        }
      }
    }
    chrome.tabs.sendMessage(tabId, { type: 'TTS_DONE' });

  } catch (error: any) {
    chrome.tabs.sendMessage(tabId, { type: 'TTS_ERROR', error: error.toString() });
  }
}

async function handleLLM(messages: any[], tabId?: number, taskId?: string) {
  if (!tabId) return;
  const config = await storage.get(['volcengineKey', 'endpointId']);
  if (!config.volcengineKey || !config.endpointId) {
    chrome.tabs.sendMessage(tabId, { type: 'LLM_ERROR', taskId, error: 'Config missing' });
    return;
  }

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.volcengineKey}`,
      },
      body: JSON.stringify({
        model: config.endpointId, // e.g. ep-202xxxxxxxx
        messages: messages,
        stream: true
      })
    });

    if (!response.body) throw new Error('No body returned from LLM');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; 

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr && dataStr !== '[DONE]') {
             try {
               const parsed = JSON.parse(dataStr);
               const text = parsed.choices?.[0]?.delta?.content;
               if (text) {
                 chrome.tabs.sendMessage(tabId, { type: 'LLM_CHUNK', taskId, chunk: text });
               }
             } catch(e) {}
          }
        }
      }
    }
    chrome.tabs.sendMessage(tabId, { type: 'LLM_DONE', taskId });
  } catch (error: any) {
    chrome.tabs.sendMessage(tabId, { type: 'LLM_ERROR', taskId, error: error.toString() });
  }
}
