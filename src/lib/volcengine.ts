export async function testLLMConnection(config: any) {
  let llmSuccess = false;
  let llmError = '';

  try {
    const provider = config.llmProvider || 'volcengine';

    if (provider === 'custom') {
      if (!config.customLlmUrl || !config.customLlmKey || !config.customLlmModel) {
        llmError = 'Missing URL, API Key or Model';
      } else {
        let url = config.customLlmUrl;
        if (!url.endsWith('/chat/completions')) {
           url += url.endsWith('/') ? 'chat/completions' : '/chat/completions';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let res;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.customLlmKey}`
            },
            body: JSON.stringify({
              model: config.customLlmModel,
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 1
            }),
            signal: controller.signal
          });
        } catch (e: any) {
          if (e.name === 'AbortError') {
             llmError = 'Request timed out (10s)';
          } else {
             llmError = e.message || 'Network error';
          }
          return { llmSuccess, llmError };
        } finally {
          clearTimeout(timeoutId);
        }
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch(e) { data = { error: { message: text } }; }
        
        if (data.error) {
           llmError = data.error.message || JSON.stringify(data.error);
        } else if (res.ok || data.choices) {
           llmSuccess = true;
        } else {
           llmError = `HTTP ${res.status}: ${text}`;
        }
      }
    } else {
      // Test LLM (Doubao)
      if (!config.volcengineKey || !config.endpointId) {
        llmError = 'Missing API Key or Endpoint ID';
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let res;
        try {
          res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.volcengineKey}`
            },
            body: JSON.stringify({
              model: config.endpointId,
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 1
            }),
            signal: controller.signal
          });
        } catch (e: any) {
          if (e.name === 'AbortError') {
             llmError = 'Request timed out (10s)';
          } else {
             llmError = e.message || 'Network error';
          }
          return { llmSuccess, llmError };
        } finally {
          clearTimeout(timeoutId);
        }
        const data = await res.json();
        if (data.error) {
           llmError = data.error.message || JSON.stringify(data.error);
        } else if (res.ok) {
           llmSuccess = true;
        } else {
           llmError = `HTTP ${res.status}: ${JSON.stringify(data)}`;
        }
      }
    }
  } catch (e: any) {
    llmError = e.toString();
  }
  return { llmSuccess, llmError };
}

export async function testVolcengineTTS(config: any) {
  let ttsSuccess = false;
  let ttsError = '';
  let usage: any = null;
  // Test TTS
  try {
    if (!config.speechAppId || !config.speechToken || !config.speechCluster) {
      ttsError = 'Missing App ID, Access Key, or Resource ID';
    } else {
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Api-App-Id': config.speechAppId,
        'X-Api-Access-Key': config.speechToken,
        'X-Api-Resource-Id': config.speechCluster,
        'X-Control-Require-Usage-Tokens-Return': '*',
      };

      const payload: any = {
        user: { uid: 'zephyr_test' },
        req_params: {
          text: config.testText || 'Hello, Welcome to the Zephyr! 欢迎使用 Zephyr 语音阅读助手。',
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (e: any) {
        if (e.name === 'AbortError') {
           ttsError = 'Request timed out (10s)';
        } else {
           ttsError = e.message || 'Network error';
        }
        return { ttsSuccess, ttsError, usage };
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!res.ok) {
         const text = await res.text();
         try {
             const parsed = JSON.parse(text);
             ttsError = parsed.message || parsed.errorMessage || parsed.error || text;
         } catch {
             ttsError = `HTTP ${res.status}: ${text}`;
         }
      } else if (res.body) {
         // Read the stream to verify chunks and find usage
         const reader = res.body.getReader();
         const decoder = new TextDecoder('utf-8');
         let buffer = '';

         // To play audio, we collect chunks
         const audioChunks: string[] = [];

         while (true) {
             const { value, done } = await reader.read();
             if (done) break;
             if (value) {
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
                             ttsError = `TTS Error: ${parsed.message || parsed.code}`;
                             break;
                           } else {
                             ttsSuccess = true;
                             const audioBase64 = parsed.data || parsed.audio; 
                             if (audioBase64) {
                               audioChunks.push(audioBase64);
                             }
                             if (parsed.usage) {
                               usage = { ...(usage || {}), ...parsed.usage };
                             }
                             if (parsed.addition?.usage) {
                               usage = { ...(usage || {}), ...parsed.addition.usage };
                             }
                             if (parsed.additions?.usage) {
                               usage = { ...(usage || {}), ...parsed.additions.usage };
                             }
                           }
                         } catch (e) {
                           // ignore parse error if any
                         }
                      }
                   }
                }
             }
         }
         
         if (ttsSuccess) {
            return { ttsSuccess, ttsError, usage, audioChunks };
         }
      } else {
         ttsSuccess = true;
      }
    }
  } catch (e: any) {
    ttsError = e.toString();
  }

  return { ttsSuccess, ttsError, usage, audioChunks: [] };
}
