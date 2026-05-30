import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Check, Activity, X, Cpu, Volume2, Network, Play, Square } from 'lucide-react';
import { storage } from '../lib/chrome';
import { testLLMConnection, testVolcengineTTS } from '../lib/volcengine';
import { AudioStreamer } from '../lib/audio';

const VOICES = [
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0'},
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小何 2.0'},
  { id: 'zh_female_sophie_uranus_bigtts', name: '魅力苏菲 2.0'},
  { id: 'zh_female_qingxinnvsheng_uranus_bigtts', name: '清新女声 2.0'},
  { id: 'zh_female_cancan_uranus_bigtts', name: '知性灿灿 2.0'},
  { id: 'zh_female_sajiaoxuemei_uranus_bigtts', name: '撒娇学妹 2.0'},
  { id: 'zh_female_tianmeixiaoyuan_uranus_bigtts', name: '甜美小源 2.0'},
  { id: 'zh_female_tianmeitaozi_uranus_bigtts', name: '甜美桃子 2.0'},
  { id: 'zh_female_shuangkuaisisi_uranus_bigtts', name: '爽快思思 2.0'},
  { id: 'zh_female_yingyujiaoxue_uranus_bigtts', name: 'Tina老师 2.0'},
  { id: 'zh_female_kefunvsheng_uranus_bigtts', name: '暖阳女声 2.0'},
  { id: 'zh_female_jitangnv_uranus_bigtts', name: '鸡汤女 2.0'},
  { id: 'zh_female_meilinvyou_uranus_bigtts', name: '魅力女友 2.0'},
  { id: 'zh_female_liuchangnv_uranus_bigtts', name: '流畅女声 2.0'},
  { id: 'zh_female_gaolengyujie_uranus_bigtts', name: '高冷御姐 2.0'},
  { id: 'zh_female_wenroushunv_uranus_bigtts', name: '温柔淑女 2.0'},
  { id: 'zh_female_mengyatou_uranus_bigtts', name: '萌丫头/Cutey 2.0'},
  { id: 'zh_female_tiexinnvsheng_uranus_bigtts', name: '贴心女声/Candy 2.0'},
  { id: 'zh_female_jitangmei_uranus_bigtts', name: '鸡汤妹妹/Hope 2.0'},
  { id: 'zh_female_kailangjiejie_uranus_bigtts', name: '开朗姐姐 2.0'},
  { id: 'zh_male_gaolengchenwen_uranus_bigtts', name: '高冷沉稳 2.0'},
  { id: 'zh_female_jiaochuannv_uranus_bigtts', name: '娇喘女声 2.0'},
  { id: 'zh_female_linxiao_uranus_bigtts', name: '林潇 2.0'},
  { id: 'zh_female_lingling_uranus_bigtts', name: '玲玲姐姐 2.0'},
  { id: 'zh_female_chunribu_uranus_bigtts', name: '春日部姐姐 2.0'},
  { id: 'zh_female_ganmaodianyin_uranus_bigtts', name: '感冒电音姐姐 2.0'},
  { id: 'zh_female_chanmeinv_uranus_bigtts', name: '谄媚女声 2.0'},
  { id: 'zh_female_qinqienv_uranus_bigtts', name: '亲切女声 2.0'},
  { id: 'zh_female_zhixingnv_uranus_bigtts', name: '知性女声 2.0'},
  { id: 'zh_female_qingchezizi_uranus_bigtts', name: '清澈梓梓 2.0'},
  { id: 'zh_female_tianmeiyueyue_uranus_bigtts', name: '甜美悦悦 2.0'},
  { id: 'zh_female_roumeinvyou_uranus_bigtts', name: '柔美女友 2.0'},
  { id: 'zh_female_wenrouxiaoya_uranus_bigtts', name: '温柔小雅 2.0'},
  { id: 'zh_male_tiancaitongsheng_uranus_bigtts', name: '天才童声 2.0'},
  { id: 'zh_female_wuzetian_uranus_bigtts', name: '武则天 2.0'},
  { id: 'zh_female_gujie_uranus_bigtts', name: '顾姐 2.0'},
  { id: 'zh_female_shaoergushi_uranus_bigtts', name: '少儿故事 2.0'},
  { id: 'saturn_zh_female_tiaopigongzhu_tob', name: '调皮公主'},
  { id: 'saturn_zh_female_aojiaonvyou_tob', name: '傲娇女友 2.0'},
  { id: 'saturn_zh_female_bingjiaojiejie_tob', name: '病娇姐姐 2.0'},
  { id: 'saturn_zh_female_chengshujiejie_tob', name: '成熟姐姐 2.0'},
  { id: 'saturn_zh_female_keainvsheng_tob', name: '可爱女生 2.0'},
  { id: 'saturn_zh_female_nuanxinxuejie_tob', name: '暖心学姐 2.0'},
  { id: 'saturn_zh_female_tiexinnvyou_tob', name: '贴心女友 2.0'},
  { id: 'saturn_zh_female_wenrouwenya_tob', name: '温柔文雅 2.0'},
  { id: 'saturn_zh_female_wumeiyujie_tob', name: '妩媚御姐 2.0'},
  { id: 'saturn_zh_female_xingganyujie_tob', name: '性感御姐 2.0'}
];

const PRESETS: Record<string, { url: string, model: string, name: string }> = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o', name: 'OpenAI' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', name: 'DeepSeek' },
  custom: { url: '', model: '', name: '自定义配置' }
};

export default function Settings({ config, onUpdate }: { config: any, onUpdate: (c: any) => void }) {
  const [activeTab, setActiveTab] = useState<'llm' | 'tts'>('llm');

  const [llmProvider, setLlmProvider] = useState<'volcengine' | 'custom'>(config.llmProvider || 'volcengine');
  
  const initialPreset = config.llmProvider === 'custom' && config.customLlmUrl === PRESETS['openai'].url ? 'openai' : 
                        config.llmProvider === 'custom' && config.customLlmUrl === PRESETS['deepseek'].url ? 'deepseek' : 'custom';
  const [presetKey, setPresetKey] = useState<string>(initialPreset);

  const [key, setKey] = useState(config.volcengineKey || '');
  const [ep, setEp] = useState(config.endpointId || '');

  const [customUrl, setCustomUrl] = useState(config.customLlmUrl || '');
  const [customKey, setCustomKey] = useState(config.customLlmKey || '');
  const [customModel, setCustomModel] = useState(config.customLlmModel || '');

  const [appId, setAppId] = useState(config.speechAppId || '');
  const [token, setToken] = useState(config.speechToken || '');
  const [cluster, setCluster] = useState(config.speechCluster || 'seed-tts-2.0');
  const [voice, setVoice] = useState(config.speechVoice || 'zh_female_xiaohe_uranus_bigtts');
  const [speed, setSpeed] = useState<number>(config.speechSpeed || 1.0);
  const [emotion, setEmotion] = useState(config.speechEmotion || 'none');
  const [testText, setTestText] = useState('Hello, Welcome to the Zephyr! 欢迎使用 Zephyr 语音阅读助手。');
  const [ttsUsage, setTtsUsage] = useState<any>(null);
  
  const [ttsState, setTtsState] = useState<'idle' | 'playing'>('idle');
  const streamerRef = useRef<AudioStreamer | null>(null);

  useEffect(() => {
     return () => streamerRef.current?.stop();
  }, []);

  const [saved, setSaved] = useState(false);

  const [testingLlm, setTestingLlm] = useState(false);
  const [llmResult, setLlmResult] = useState<{success: boolean, error: string} | null>(null);

  const [testingTts, setTestingTts] = useState(false);
  const [ttsResult, setTtsResult] = useState<{success: boolean, error: string} | null>(null);

  const handleTestLLMConnection = async () => {
    setTestingLlm(true);
    setLlmResult(null);
    try {
      const configObj = { 
        llmProvider,
        volcengineKey: key.trim(), endpointId: ep.trim(),
        customLlmUrl: customUrl.trim(),
        customLlmKey: customKey.trim(),
        customLlmModel: customModel.trim()
      };
      const res = await testLLMConnection(configObj);
      setLlmResult({ success: res.llmSuccess, error: res.llmError });
    } finally {
      setTestingLlm(false);
    }
  }

  const testTTSConnection = async () => {
    setTestingTts(true);
    setTtsResult(null);
    setTtsUsage(null);
    streamerRef.current?.stop();
    try {
      const configObj = { 
        speechAppId: appId.trim(), 
        speechToken: token.trim(), 
        speechCluster: cluster.trim() || 'seed-tts-2.0',
        speechVoice: voice.trim() || 'zh_female_xiaohe_uranus_bigtts',
        speechSpeed: speed,
        speechEmotion: emotion,
        testText
      };
      const res = await testVolcengineTTS(configObj);
      setTtsResult({ success: res.ttsSuccess, error: res.ttsError });
      if (res.usage) {
        setTtsUsage(res.usage);
      }
      if (res.ttsSuccess && res.audioChunks && res.audioChunks.length > 0) {
        streamerRef.current = new AudioStreamer();
        streamerRef.current.onStateChange = setTtsState;
        res.audioChunks.forEach((c: string) => streamerRef.current?.addChunk(c));
        streamerRef.current.signalDone();
      }
    } finally {
      setTestingTts(false);
    }
  }

  const handleStopTts = () => {
     streamerRef.current?.stop();
  };

  const save = async () => {
    const newConfig = { 
      ...config, 
      llmProvider,
      volcengineKey: key.trim(), 
      endpointId: ep.trim(), 
      customLlmUrl: customUrl.trim(),
      customLlmKey: customKey.trim(),
      customLlmModel: customModel.trim(),
      speechAppId: appId.trim(),
      speechToken: token.trim(),
      speechCluster: cluster.trim() || 'seed-tts-2.0',
      speechVoice: voice.trim() || 'zh_female_xiaohe_uranus_bigtts',
      speechSpeed: speed,
      speechEmotion: emotion
    };
    await storage.set(newConfig);
    onUpdate(newConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const canTestLlm = llmProvider === 'volcengine' 
    ? (key && ep) 
    : (customUrl && customKey && customModel);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLlmResult(null);
    if (val === 'volcengine') {
       setLlmProvider('volcengine');
    } else {
       setLlmProvider('custom');
       setPresetKey(val);
       if (PRESETS[val] && val !== 'custom') {
          setCustomUrl(PRESETS[val].url);
          setCustomModel(PRESETS[val].model);
       }
    }
  };

  return (
    <div className="w-[680px] mx-auto bg-white rounded-[28px] shadow-2xl shadow-gray-200/50 flex flex-col overflow-hidden border border-white max-h-[90vh]">
      <div className="p-8 pb-4 shrink-0 border-b border-[#F5F5F7]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#1D1D1F] rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">Zephyr Configuration</h1>
          </div>
        </div>
        
        <div className="flex justify-between items-center bg-[#F5F5F7] p-1.5 rounded-2xl">
           <button onClick={() => setActiveTab('llm')} className={`flex-1 py-2 text-[13px] font-medium rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'llm' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}>
              <Cpu className="w-4 h-4" /> 大模型 (LLM)
           </button>
           <button onClick={() => setActiveTab('tts')} className={`flex-1 py-2 text-[13px] font-medium rounded-xl flex items-center justify-center gap-2 transition-all ${activeTab === 'tts' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}>
              <Volume2 className="w-4 h-4" /> 语音合成 (TTS)
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
         {activeTab === 'llm' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="space-y-4">
               <div className="flex items-center justify-between border-b border-[#F5F5F7] pb-2">
                 <h3 className="text-sm font-semibold text-[#1D1D1F]">语言模型 (LLM)</h3>
                 <select 
                   value={llmProvider === 'volcengine' ? 'volcengine' : presetKey} 
                   onChange={handleProviderChange}
                   className="text-[12px] bg-[#F5F5F7] border-none rounded-lg px-2 py-1 outline-none font-medium"
                 >
                    <option value="volcengine">火山引擎推理 (Doubao)</option>
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">自定义配置</option>
                 </select>
               </div>

               {llmProvider === 'volcengine' ? (
                 <>
                   <label className="block">
                      <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Ark API Key</span>
                      <div className="mt-1.5 relative">
                        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Enter Ark API Key" className="w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                      </div>
                   </label>
                   <label className="block">
                      <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Doubao Endpoint ID</span>
                      <input type="text" value={ep} onChange={e => setEp(e.target.value)} placeholder="ep-202xxxxxxxx" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                   </label>
                 </>
               ) : (
                 <>
                   <label className="block">
                      <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Base URL</span>
                      <input type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                   </label>
                   <label className="block">
                      <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">API Key</span>
                      <input type="password" value={customKey} onChange={e => setCustomKey(e.target.value)} placeholder="sk-..." className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                   </label>
                   <label className="block">
                      <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Model / 模型名称</span>
                      <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)} placeholder="gpt-4o / claude-3-5 / deepseek-chat" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                   </label>
                 </>
               )}
             </div>

             <div className="pt-4 border-t border-[#F5F5F7]">
                <button onClick={handleTestLLMConnection} disabled={!canTestLlm || testingLlm} className="w-full bg-[#F5F5F7] text-[#1D1D1F] hover:bg-gray-200 px-8 py-3 rounded-xl text-[14px] font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {testingLlm ? <><Activity className="w-4 h-4 animate-spin"/> 测试中...</> : <><Network className="w-4 h-4"/> 连通性测试</>}
                </button>

                {llmResult && (
                  <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${llmResult.success ? 'bg-green-50/50 border-green-100/50' : 'bg-red-50/50 border-red-100/50'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${llmResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {llmResult.success ? <Check className="w-4 h-4"/> : <X className="w-4 h-4"/>}
                     </div>
                     <div>
                        <div className={`text-[14px] font-medium ${llmResult.success ? 'text-green-800' : 'text-red-800'}`}>{llmResult.success ? '测试通过' : '测试失败'}</div>
                        <div className={`text-[12px] mt-1 ${llmResult.success ? 'text-green-600' : 'text-red-600'}`}>{llmResult.success ? 'LLM 连通成功' : llmResult.error}</div>
                     </div>
                  </div>
                )}
             </div>
           </div>
         )}

         {activeTab === 'tts' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="space-y-4">
               <h3 className="text-sm font-semibold text-[#1D1D1F] border-b border-[#F5F5F7] pb-2">语音合成与音色配置 (TTS)</h3>
               <label className="block">
                  <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Speech Appid</span>
                  <input type="text" value={appId} onChange={e => setAppId(e.target.value)} placeholder="Your TTS App ID" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
               </label>
               <div className="flex gap-4">
                 <label className="block flex-1">
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Speech Access Token</span>
                    <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Your TTS Access Token" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                 </label>
                 <label className="block flex-1">
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Cluster</span>
                    <input type="text" value={cluster} onChange={e => setCluster(e.target.value)} placeholder="seed-tts-2.0" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all placeholder:text-[#86868B]/60 outline-none text-[#1D1D1F]" />
                 </label>
               </div>
             </div>

             <div className="space-y-3">
               <h3 className="text-sm font-semibold text-[#1D1D1F] border-b border-[#F5F5F7] pb-2">选择常用音色</h3>
               <div className="grid grid-cols-2 gap-2 h-44 overflow-y-auto pr-2">
                  {VOICES.map(v => (
                     <button 
                       key={v.id} 
                       onClick={() => setVoice(v.id)}
                       className={`text-left p-3 rounded-xl border transition-all ${voice === v.id ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                     >
                        <div className={`text-[12px] font-medium truncate ${voice === v.id ? 'text-blue-700' : 'text-[#1D1D1F]'}`}>{v.name}</div>
                     </button>
                  ))}
               </div>
               <div className="flex gap-4 mt-2">
                 <label className="block flex-1">
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Speech Speed (语速 {speed}x)</span>
                    <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="mt-1 w-full" />
                 </label>
                 <label className="block flex-1">
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">Emotion (情感)</span>
                    <select value={emotion} onChange={e => setEmotion(e.target.value)} className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all outline-none text-[#1D1D1F]">
                       <option value="neutral">中性 (Neutral)</option>
                       <option value="happy">愉悦 (Happy)</option>
                       <option value="angry">愤怒 (Angry)</option>
                       <option value="sad">悲伤 (Sad)</option>
                       <option value="excited">兴奋 (Excited)</option>
                       <option value="chat">闲聊 (Chat)</option>
                       <option value="ASMR">低语 (ASMR)</option>
                       <option value="warm">温暖 (Warm)</option>
                       <option value="affectionate">深情 (Affectionate)</option>
                       <option value="Authoritative">权威 (Authoritative)</option>
                    </select>
                 </label>
               </div>
             </div>

             <div className="pt-4 border-t border-[#F5F5F7]">
               <label className="block mb-3">
                  <span className="text-[11px] uppercase tracking-widest font-semibold text-[#86868B] ml-1">预览测试文本 (Preview Text)</span>
                  <input type="text" value={testText} onChange={e => setTestText(e.target.value)} placeholder="Hello, Welcome to the Zephyr! 欢迎使用 Zephyr 语音阅读助手。" className="mt-1.5 w-full bg-[#F5F5F7] border-none rounded-xl px-4 py-3 text-[14px] focus:ring-1 focus:ring-[#0071E3] transition-all outline-none text-[#1D1D1F]" />
               </label>
               
               <div className="flex gap-2">
                  <button onClick={testTTSConnection} disabled={!appId || !token || !cluster || !voice || testingTts} className="flex-1 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-gray-200 px-8 py-3 rounded-xl text-[14px] font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {testingTts ? <><Activity className="w-4 h-4 animate-spin"/> 测试合成中...</> : <><Network className="w-4 h-4"/> 连通性测试 (试听)</>}
                  </button>
                  <button onClick={handleStopTts} disabled={ttsState !== 'playing'} className="bg-red-50 text-red-600 hover:bg-red-100 px-8 py-3 rounded-xl text-[14px] font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    <Square className="w-4 h-4" fill="currentColor" /> 停止播放
                  </button>
               </div>

                {ttsResult && (
                  <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${ttsResult.success ? 'bg-green-50/50 border-green-100/50' : 'bg-red-50/50 border-red-100/50'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ttsResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {ttsResult.success ? <Check className="w-4 h-4"/> : <X className="w-4 h-4"/>}
                     </div>
                     <div className="flex-1 overflow-hidden">
                        <div className={`text-[14px] font-medium ${ttsResult.success ? 'text-green-800' : 'text-red-800'}`}>{ttsResult.success ? '测试通过' : '测试失败'}</div>
                        <div className={`text-[12px] mt-1 break-all ${ttsResult.success ? 'text-green-600' : 'text-red-600'}`}>{ttsResult.success ? '语音合成连通成功，开始播放音频' : ttsResult.error}</div>
                        
                        {ttsResult.success && ttsUsage && (
                          <div className="mt-3 p-3 bg-white/60 rounded-lg text-[12px] font-mono text-[#424245]">
                            <div className="font-semibold mb-1 text-[11px] text-[#86868B] uppercase tracking-wider">Usage Info</div>
                            <div>{Object.entries(ttsUsage).map(([k,v]) => <div key={k}>{k}: {String(v)}</div>)}</div>
                          </div>
                        )}
                     </div>
                  </div>
                )}
             </div>
           </div>
         )}
      </div>

      <div className="p-6 bg-[#FBFBFD] border-t border-[#F5F5F7] shrink-0 flex items-center justify-between">
         {saved ? (
             <span className="text-emerald-500 text-[14px] font-medium flex items-center gap-1.5 animate-in fade-in"><Check className="w-4 h-4"/> 配置已保存</span>
         ) : (
             <span className="text-[13px] font-medium text-[#86868B]">实时同步至插件</span>
         )}
         <button onClick={save} className="bg-[#0071E3] text-white px-8 py-3 rounded-full text-[14px] font-medium shadow-lg shadow-blue-500/20 hover:bg-[#0077ED] transition-all">保存配置</button>
      </div>
    </div>
  )
}
