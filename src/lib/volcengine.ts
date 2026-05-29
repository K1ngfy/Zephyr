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

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.customLlmKey}`
          },
          body: JSON.stringify({
            model: config.customLlmModel,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          })
        });
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
        const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.volcengineKey}`
          },
          body: JSON.stringify({
            model: config.endpointId,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          })
        });
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
        'X-Api-Resource-Id': config.speechCluster
      };

      const payload = {
        user: { uid: 'zephyr_test' },
        req_params: {
          text: 'test',
          speaker: config.speechVoice || 'zh_female_xiaohe_uranus_bigtts',
          audio_params: {
            format: 'mp3',
            sample_rate: 24000
          }
        }
      };

      const res = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
         const text = await res.text();
         try {
             const parsed = JSON.parse(text);
             ttsError = parsed.message || parsed.errorMessage || parsed.error || text;
         } catch {
             ttsError = `HTTP ${res.status}: ${text}`;
         }
      } else if (res.body) {
         // Read the stream to verify first chunk is not an error
         const reader = res.body.getReader();
         const decoder = new TextDecoder('utf-8');
         const { value, done } = await reader.read();
         if (value) {
            const chunkText = decoder.decode(value);
            const dataMatch = chunkText.match(/data:\s*({.+?})/);
            if (dataMatch && dataMatch[1]) {
               const parsed = JSON.parse(dataMatch[1]);
               if (parsed.code && parsed.code > 0) {
                 ttsError = `TTS Error: ${parsed.message || parsed.code}`;
               } else {
                 ttsSuccess = true;
               }
            } else {
               ttsSuccess = true; // no err parsing found
            }
         } else {
            ttsSuccess = true;
         }
      } else {
         ttsSuccess = true;
      }
    }
  } catch (e: any) {
    ttsError = e.toString();
  }

  return { ttsSuccess, ttsError };
}
