import { storage } from './lib/chrome';

if (typeof chrome !== 'undefined') {
  if (chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      if (chrome.contextMenus) {
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
      }
      
      // Auto-open options if no key
      storage.get(['volcengineKey']).then((res: any) => {
        if (!res.volcengineKey) {
          try {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
              chrome.runtime.openOptionsPage().catch(() => {
                if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: 'index.html' });
              });
            } else if (chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: 'index.html' });
            }
          } catch (e) {
            if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: 'index.html' });
          }
        }
      });
    });
  }

  if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener((info: any, tab: any) => {
      if (!tab?.id || !chrome.tabs || !chrome.tabs.sendMessage) return;
      if (info.menuItemId === 'zephyr_read_aloud') {
        chrome.tabs.sendMessage(tab.id, { type: 'CMD_READ_ALOUD', text: info.selectionText }).catch(() => {});
      } else if (info.menuItemId === 'zephyr_explain_read') {
        chrome.tabs.sendMessage(tab.id, { type: 'CMD_EXPLAIN_READ', text: info.selectionText }).catch(() => {});
      }
    });
  }

  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener((tab: any) => {
      if (tab?.id && chrome.tabs && chrome.tabs.sendMessage) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' }).catch(() => {});
      }
    });
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
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
}

let currentTtsAbort: AbortController | null = null;

async function handleTTS(text: string, tabId?: number) {
  if (!tabId) return;

  if (currentTtsAbort) {
    currentTtsAbort.abort();
    currentTtsAbort = null;
  }
  currentTtsAbort = new AbortController();
  const signal = currentTtsAbort.signal;
  
  const config = await storage.get(['volcengineKey', 'speechAppId', 'speechToken', 'speechCluster', 'speechVoice', 'speechSpeed', 'speechEmotion']);
  
  // Need at least appid and token for TTS
  if (!config.speechAppId || !config.speechToken || !config.speechCluster) {
    chrome.tabs.sendMessage(tabId, { type: 'TTS_ERROR', error: 'Speech AppID, Token, or Cluster missing' });
    return;
  }

  const payload: any = {
    user: { uid: 'zephyr_user' },
    req_params: {
      text: text,
      speaker: config.speechVoice || 'zh_female_xiaohe_uranus_bigtts',
      additions: JSON.stringify({
        disable_markdown_filter: true
      }),
      audio_params: {
        format: 'mp3',
        sample_rate: 24000,
        speech_rate: Math.round(((config.speechSpeed || 1.0) - 1) * 100),
      }
    }
  };

  if (config.speechEmotion && config.speechEmotion !== 'none') {
      payload.req_params.audio_params.emotion = config.speechEmotion;
  }

  try {
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'X-Api-App-Id': config.speechAppId,
      'X-Api-Access-Key': config.speechToken,
      'X-Api-Resource-Id': config.speechCluster
    };

    const timeoutId = setTimeout(() => currentTtsAbort?.abort(new Error("Request timed out (15s)")), 15000);

    const response = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal
    });
    
    clearTimeout(timeoutId);

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
               if (parsed.code && parsed.code > 0 && parsed.code !== 1000 && parsed.message !== 'Success' && parsed.message !== 'OK') {
                  throw new Error(`TTS API Error: ${parsed.message || parsed.code}`);
               }
               const audioBase64 = parsed.data || parsed.audio; 
               if (audioBase64) {
                 chrome.tabs.sendMessage(tabId, { type: 'TTS_CHUNK', chunk: audioBase64 });
               }
             } catch(e: any) {
               console.error('Error parsing TTS chunk', e);
               chrome.tabs.sendMessage(tabId, { type: 'TTS_ERROR', error: e.toString() });
               return; // Stop processing
             }
          }
        }
      }
    }
    chrome.tabs.sendMessage(tabId, { type: 'TTS_DONE' });

  } catch (error: any) {
    if (error.name === 'AbortError') return;
    chrome.tabs.sendMessage(tabId, { type: 'TTS_ERROR', error: error.toString() });
  }
}

async function handleLLM(messages: any[], tabId?: number, taskId?: string) {
  if (!tabId) return;
  const config = await storage.get([
    'llmProvider', 
    'volcengineKey', 'endpointId', 
    'customLlmUrl', 'customLlmKey', 'customLlmModel'
  ]);

  const provider = config.llmProvider || 'volcengine';

  let url, authKey, modelId;

  if (provider === 'custom') {
    if (!config.customLlmUrl || !config.customLlmKey || !config.customLlmModel) {
      chrome.tabs.sendMessage(tabId, { type: 'LLM_ERROR', taskId, error: 'Custom LLM config missing' });
      return;
    }
    url = config.customLlmUrl;
    if (!url.endsWith('/chat/completions')) {
      url += url.endsWith('/') ? 'chat/completions' : '/chat/completions';
    }
    authKey = config.customLlmKey;
    modelId = config.customLlmModel;
  } else {
    if (!config.volcengineKey || !config.endpointId) {
      chrome.tabs.sendMessage(tabId, { type: 'LLM_ERROR', taskId, error: 'Volcengine config missing' });
      return;
    }
    url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    authKey = config.volcengineKey;
    modelId = config.endpointId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        stream: true
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.body) throw new Error('No body returned from LLM');
    if (!response.ok) {
       const text = await response.text();
       throw new Error(`HTTP ${response.status}: ${text}`);
    }

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
