# 火山引擎 (Volcengine) TTS 语音合成接口对接指南

此文档梳理总结了接驳火山引擎 TTS (Text-to-Speech) 的相关配置项和前/后端对接代码参考，以便在其他产品中快速接入并复用此服务，并为用户提供相关配置功能。

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

## 5. 附录：当前系统内嵌音色与情绪列表参考

### 5.1 支持的音色 (Voices)
以下为本系统默认支持及配置的火山引擎推荐大语言模型 TTS 音色：

| 音色名称 | 音色 ID / Speaker |
| :--- | :--- |
| Vivi 2.0 | `zh_female_vv_uranus_bigtts` |
| 小何 2.0 | `zh_female_xiaohe_uranus_bigtts` |
| 魅力苏菲 2.0 | `zh_female_sophie_uranus_bigtts` |
| 清新女声 2.0 | `zh_female_qingxinnvsheng_uranus_bigtts` |
| 知性灿灿 2.0 | `zh_female_cancan_uranus_bigtts` |
| 撒娇学妹 2.0 | `zh_female_sajiaoxuemei_uranus_bigtts` |
| 甜美小源 2.0 | `zh_female_tianmeixiaoyuan_uranus_bigtts` |
| 甜美桃子 2.0 | `zh_female_tianmeitaozi_uranus_bigtts` |
| 爽快思思 2.0 | `zh_female_shuangkuaisisi_uranus_bigtts` |
| Tina老师 2.0 | `zh_female_yingyujiaoxue_uranus_bigtts` |
| 暖阳女声 2.0 | `zh_female_kefunvsheng_uranus_bigtts` |
| 鸡汤女 2.0 | `zh_female_jitangnv_uranus_bigtts` |
| 魅力女友 2.0 | `zh_female_meilinvyou_uranus_bigtts` |
| 流畅女声 2.0 | `zh_female_liuchangnv_uranus_bigtts` |
| 高冷御姐 2.0 | `zh_female_gaolengyujie_uranus_bigtts` |
| 温柔淑女 2.0 | `zh_female_wenroushunv_uranus_bigtts` |
| 萌丫头/Cutey 2.0 | `zh_female_mengyatou_uranus_bigtts` |
| 贴心女声/Candy 2.0 | `zh_female_tiexinnvsheng_uranus_bigtts` |
| 鸡汤妹妹/Hope 2.0 | `zh_female_jitangmei_uranus_bigtts` |
| 开朗姐姐 2.0 | `zh_female_kailangjiejie_uranus_bigtts` |
| 高冷沉稳 2.0 | `zh_male_gaolengchenwen_uranus_bigtts` |
| 娇喘女声 2.0 | `zh_female_jiaochuannv_uranus_bigtts` |
| 林潇 2.0 | `zh_female_linxiao_uranus_bigtts` |
| 玲玲姐姐 2.0 | `zh_female_lingling_uranus_bigtts` |
| 春日部姐姐 2.0 | `zh_female_chunribu_uranus_bigtts` |
| 感冒电音姐姐 2.0 | `zh_female_ganmaodianyin_uranus_bigtts` |
| 谄媚女声 2.0 | `zh_female_chanmeinv_uranus_bigtts` |
| 亲切女声 2.0 | `zh_female_qinqienv_uranus_bigtts` |
| 知性女声 2.0 | `zh_female_zhixingnv_uranus_bigtts` |
| 清澈梓梓 2.0 | `zh_female_qingchezizi_uranus_bigtts` |
| 甜美悦悦 2.0 | `zh_female_tianmeiyueyue_uranus_bigtts` |
| 柔美女友 2.0 | `zh_female_roumeinvyou_uranus_bigtts` |
| 温柔小雅 2.0 | `zh_female_wenrouxiaoya_uranus_bigtts` |
| 天才童声 2.0 | `zh_male_tiancaitongsheng_uranus_bigtts` |
| 武则天 2.0 | `zh_female_wuzetian_uranus_bigtts` |
| 顾姐 2.0 | `zh_female_gujie_uranus_bigtts` |
| 少儿故事 2.0 | `zh_female_shaoergushi_uranus_bigtts` |
| 调皮公主 | `saturn_zh_female_tiaopigongzhu_tob` |
| 傲娇女友 2.0 | `saturn_zh_female_aojiaonvyou_tob` |
| 病娇姐姐 2.0 | `saturn_zh_female_bingjiaojiejie_tob` |
| 成熟姐姐 2.0 | `saturn_zh_female_chengshujiejie_tob` |
| 可爱女生 2.0 | `saturn_zh_female_keainvsheng_tob` |
| 暖心学姐 2.0 | `saturn_zh_female_nuanxinxuejie_tob` |
| 贴心女友 2.0 | `saturn_zh_female_tiexinnvyou_tob` |
| 温柔文雅 2.0 | `saturn_zh_female_wenrouwenya_tob` |
| 妩媚御姐 2.0 | `saturn_zh_female_wumeiyujie_tob` |
| 性感御姐 2.0 | `saturn_zh_female_xingganyujie_tob` |

### 5.2 支持的情绪 (Emotions)
根据火山引擎各音色的不同，部分音色支持情感调节。可以在请求参数 `emotion` 中填入如下值进行测试：

| 情绪标识 | 情绪描述含义 |
| :--- | :--- |
| `neutral`或`none` | 中性 (Neutral) - 默认 |
| `happy` | 愉悦 (Happy) |
| `angry` | 愤怒 (Angry) |
| `sad` | 悲伤 (Sad) |
| `excited` | 兴奋 (Excited) |
| `chat` | 闲聊 (Chat) |
| `ASMR` | 低语 (ASMR) |
| `warm` | 温暖 (Warm) |
| `affectionate` | 深情 (Affectionate) |
| `Authoritative`| 权威 (Authoritative) |

