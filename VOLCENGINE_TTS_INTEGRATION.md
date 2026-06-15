# 火山引擎 (Volcengine) TTS 语音合成接口对接指南

此文档基于本项目的语音合成模块，梳理总结了接驳火山引擎 TTS (Text-to-Speech) 的相关配置项和前/后端对接代码参考，以便在其他产品中快速接入并复用此服务，并为用户提供相关配置功能。

## 1. 所需用户配置参数 (Credentials & Config)

为了使用火山引擎的大模型语音合成，用户（或系统后台）需要提供以下至少三个核心凭证以及相关的个性化设定。

### 核心凭证（必填项）：
* **App ID (应用 ID)**：对应请求头 `X-Api-App-Id`，代表所属应用。
* **Access Key / Token (访问令牌)**：对应请求头 `X-Api-Access-Key`，用于鉴权验证。
* **Resource ID / Cluster (资源 ID 或集群名)**：对应请求头 `X-Api-Resource-Id`，比如独占集群或默认公共模型集群名字。

### 个性化音频参数（选填/默认项）：
* **Voice / Speaker (发音人/音色)**：例如 `zh_female_xiaohe_uranus_bigtts` 等音色标识。
* **Speed (语速)**：默认 `1.0`（代表正常语速），取值可根据应用需要。
* **Emotion (发音情感)**：默认为 `none`，部分特殊音色可指定 `happy`, `sad` 等情绪。

---

## 2. API 接口对接参数说明

### 请求基本信息
* **接口地址 (URL)**：`https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse`
* **请求方式 (Method)**：`POST`
* **数据流格式**：Server-Sent Events (SSE 流式传输)，接收不断推回的音频块。

### Header (请求头)

```http
Content-Type: application/json
Accept: text/event-stream
X-Api-App-Id: {speechAppId}
X-Api-Access-Key: {speechToken}
X-Api-Resource-Id: {speechCluster}
```
*(选注：如果测试时需要返回消耗 Token 信息，可以加一句 `X-Control-Require-Usage-Tokens-Return: *`)*

### Body Payload (请求体)

```json
{
  "user": { 
    "uid": "user_unique_id" // 每个发起请求的用户唯一ID
  },
  "req_params": {
    "text": "需要转换为语音的文本内容，支持长文本",
    "speaker": "zh_female_xiaohe_uranus_bigtts", // 音色模型名称
    "additions": "{\"disable_markdown_filter\":true}", // 附加能力（如是否过滤MarkDown）
    "audio_params": {
      "format": "mp3",
      "sample_rate": 24000,
      // 语速计算公式，正常速度(1.0)即为 0 
      "speech_rate": 0,  // Math.round((speed - 1) * 100) 
      "emotion": "none" // （如果支持）发音情感
    }
  }
}
```

---

## 3. SSE 流式响应处理 (Response Parsing)

流式请求成功后会建立连接并源源不断推送数据块（Chunk）。
客户端应通过读取 Stream 获取 `data:` 字段的内容，并解析成 JSON 用来拼接（或直接播放）Base64 格式音频数据。

### JavaScript 处理示例解析代码：

```javascript
// ... 使用 fetch 发送请求后 ...
const reader = response.body.getReader();
const decoder = new TextDecoder('utf-8');
let buffer = '';

while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 保留可能被截断的最后一行
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                
                // 收到 [DONE] 代表流处理完毕
                if (dataStr === '[DONE]') {
                    console.log('Audio stream finished.');
                    break;
                }

                if (dataStr) {
                    try {
                        const parsed = JSON.parse(dataStr);
                        
                        // 1. 错误判断处理
                        // 如果 code > 0 且不是 1000 时，通常为错误 (Message: Success / OK 除外)
                        if (parsed.code && parsed.code > 0 && parsed.code !== 1000 && parsed.message !== 'Success' && parsed.message !== 'OK') {
                            console.error(`TTS API Error: ${parsed.message || parsed.code}`);
                            // 跳出或抛出异常
                        } else {
                            // 2. 正常音频处理
                            // 从 data 或者 audio 中取出 Base64 音频内容
                            const audioBase64 = parsed.data || parsed.audio; 
                            if (audioBase64) {
                                // 业务逻辑: 可以将分片的音频 Base64 放入队列依次播放
                                playOrStoreChunk(audioBase64);
                            }
                        }
                    } catch (e) {
                         // JSON Parse Error, ignore partial chunks mapping
                    }
                }
            }
        }
    }
}
```

## 4. 相关最佳实践

1. **AbortController 中断支持**：TTS 常常耗时并且用户随时可能取消（比如随时换另外一句或关闭对话框）。建议在请求发起时携带 `AbortController` 信号（`signal: controller.signal`），以便随时可手动抛出 `abort()` 中断底层 HTTP 链接。
2. **Audio 拼接播放体验**：为了降低首字出现时间，最好不用等完整流结束。每次解析到 Base64 chunk，都可以转换成 `ArrayBuffer` 或者 `Blob` 放进音频队列，由 `AudioContext` 或者 `HTMLAudioElement` 无缝接轨播放。
3. **接口超时设定**：流建立之前设定合理的超时（如 10s 或 15s），以免受网络波动影响阻塞后续操作。
