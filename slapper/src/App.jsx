import React, { useState, useEffect, useRef } from 'react';
import { Hand } from 'lucide-react';
import './index.css';

function App() {
  const isElectron = window && window.process && window.process.type;
  
  const [activeTab, setActiveTab] = useState('guide'); 
  const [sensitivity, setSensitivity] = useState(0.2); 
  const [cooldown, setCooldown] = useState(0.5); 
  const [selectedSound, setSelectedSound] = useState('scream1');
  const [customSounds, setCustomSounds] = useState([]);
  
  const [pendingUpload, setPendingUpload] = useState(null);
  
  const [isListening, setIsListening] = useState(false);
  const [liveStats, setLiveStats] = useState({ mode: '', force: 0 });

  const audioCtxRef = useRef(null);
  const lastSlapRef = useRef(0);
  const soundBuffersRef = useRef({}); 
  const frameCountRef = useRef(0);
  
  const configRef = useRef({ sensitivity, cooldown, selectedSound });
  
  useEffect(() => {
    configRef.current = { sensitivity, cooldown, selectedSound };
  }, [sensitivity, cooldown, selectedSound]);

  const initAudio = async () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
         await audioCtx.resume();
      }
      audioCtxRef.current = audioCtx;
      setIsListening(true);
      
      const { ipcRenderer } = window.require('electron');
      
      ipcRenderer.on('engine-stat', (event, stats) => {
         const { mode, force } = stats;

         frameCountRef.current++;
         if (frameCountRef.current % (mode === 'SENSOR' ? 2 : 4) === 0) {
             setLiveStats({ mode, force });
         }

         let requiredForce = 0;
         let maxForceCap = 3;
         // slider 0.0 (rất nhạy) -> slider 1.0 (kém nhạy)
         // Map UI sensitivity values to real force numbers for the appropriate mode
         if (mode === 'SENSOR') {
             requiredForce = 0.5 + (configRef.current.sensitivity * 1.5);
             maxForceCap = requiredForce * 3;
         } else {
             requiredForce = 5.0 + (configRef.current.sensitivity * 35.0);
             maxForceCap = requiredForce * 4;
         }

         const now = Date.now() / 1000;
         
         if (
             force > requiredForce && 
             (now - lastSlapRef.current) > configRef.current.cooldown
         ) {
             lastSlapRef.current = now;
             
             // Khuếch đại âm lượng phát ra khi đánh mạnh
             let forceVol = Math.min(1.0, Math.max(0.2, ((force - requiredForce) / maxForceCap) + 0.2)); 
             playSound(configRef.current.selectedSound, forceVol);
         }
      });
      
      loadDefaultSound('scream1', 'https://www.myinstants.com/media/sounds/screaming-goat.mp3');
      loadDefaultSound('scream2', 'https://www.myinstants.com/media/sounds/wilhelm-scream.mp3');
      loadDefaultSound('bonk', 'https://www.myinstants.com/media/sounds/bonk_XyC0Hn8.mp3');
      loadDefaultSound('bruh', 'https://www.myinstants.com/media/sounds/movie_1.mp3');
      
    } catch (err) {
      console.error("lỗi audio:", err);
    }
  };

  const loadDefaultSound = async (id, url) => {
    try {
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      if(audioCtxRef.current) {
        soundBuffersRef.current[id] = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      }
    } catch(e) {}
  };

  const playSound = (id, vol = 1.0) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = vol;

    const buffer = soundBuffersRef.current[id];
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(0);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    let defaultName = file.name.split('.')[0] || 'âm thanh tải lên';
    if(defaultName.length > 20) defaultName = defaultName.substring(0, 20) + '...';
    setPendingUpload({ file, name: defaultName });
  };

  const handleConfirmUpload = async () => {
    if (!pendingUpload) return;
    const { file, name } = pendingUpload;
    
    const id = 'custom_' + Date.now();
    setCustomSounds(prev => [...prev, { id, name }]);
    setSelectedSound(id);
    setActiveTab('sounds');
    setPendingUpload(null);
    
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    try {
        const arrayBuffer = await file.arrayBuffer();
        soundBuffersRef.current[id] = await audioCtxRef.current.decodeAudioData(arrayBuffer);
    } catch (e) {
        alert("lỗi xử lý tệp âm thanh.");
    }
  };

  const getSensitivityText = (val) => {
    if(val <= 0.1) return "nhạy dữ luôn (chạm nhẹ cũng dội)";
    if(val <= 0.35) return "nhạy mỏng manh (gõ lốc cốc)";
    if(val <= 0.65) return "bình thường (tát giật mình)";
    if(val <= 0.85) return "hơi trâu bò (đập móp vỏ máy)";
    return "cứng như đá (tát gãy bàn phím)";
  };

  return (
    <div className="w-full min-h-screen flex flex-col p-8 md:p-12 lg:p-16 selection:bg-[#EAEAEA] select-none lowercase font-sans text-black bg-[#FFFFFF]">
      
      <div className="flex justify-between items-start font-mono text-[10px] md:text-xs text-[#999] tracking-widest mb-10 shrink-0">
         <div className="flex flex-col gap-1.5 leading-tight">
            <span>trạng thái hệ thống</span>
            <span className="text-[#1A1A1A] font-medium">
               {isListening ? (
                  <>
                     đang nghe {">"} <span className="font-bold text-black border border-black px-1" title="Lực chấn động đo được">lực: {liveStats.force ? liveStats.force.toFixed(2) : "0.00"}</span> | <span className={`font-bold border border-black px-1 ${liveStats.mode === 'SENSOR' ? 'text-blue-600 border-blue-600' : 'text-green-600 border-green-600'}`}>{liveStats.mode === 'SENSOR' ? 'CHIP CẢM BIẾN' : 'MICROPHONE'}</span>
                  </>
               ) : 'đang ngủ (bấm đánh thức hệ thống)'}
            </span>
         </div>
         <div className="flex flex-col gap-1.5 leading-tight text-right font-bold text-[#1A1A1A]">
            <span className="text-[14px] flex items-center justify-end gap-1"><Hand size={14} className="opacity-90 mt-[1px]" /> winSLAP (Hybrid)</span>
         </div>
      </div>

      <div className="flex-1 flex flex-col justify-start max-w-4xl mx-auto w-full px-4 pt-10">
         
         <div className="text-[19px] md:text-[23px] lg:text-[26px] leading-[1.65] font-normal text-[#1A1A1A] tracking-[-0.01em]">

            {activeTab === 'guide' && (
               <div className="animate-fade-in">
                  <div className="mb-10 w-24 h-24 border-2 border-dashed border-[#1A1A1A]/20 flex items-center justify-center bg-gray-50/50">
                     <Hand size={40} className="text-[#1A1A1A] opacity-80" strokeWidth={1.5} />
                  </div>
                  
                  <p className="mb-10">
                    chào bạn, đây là ứng dụng <span className="font-bold border-b-2 border-black inline-block leading-tight">winSLAP</span>. 
                    chiếc máy tính của bạn sẽ biến thành một sinh vật biết phàn nàn khi bị đánh. 
                  </p>
                  <p className="mb-10">
                    bây giờ winSLAP dã được tích hợp cơ chế Hybrid chống nhiễu tuyệt đối. Không lo kích hoạt nhầm khi mở nhạc hay ngồi ở nơi ồn ào. Tuỳ vào phần cứng, nó sẽ tự chọn chạy qua thuật toán Sensor API hoặc Thuật toán Volume Peak qua micro.
                  </p>
                  <p className="mb-10">
                    để bắt đầu, vui lòng kích hoạt hệ thống ở góc dưới. 
                    sau đó, bạn có thể chỉnh <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('settings')}>cảm biến nhận diện</span> (độ nhạy lực), 
                    chọn <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('sounds')}>âm thanh</span> có sẵn, 
                    hoặc tự <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('upload')}>tải lên mp3</span> của bạn.
                  </p>
               </div>
            )}

            {activeTab === 'settings' && (
               <div className="animate-fade-in">
                  <p className="mb-8 items-center leading-loose">
                    <strong className="text-black">1. thanh đo lực đập: </strong> kéo qua trái thì chạm nhẹ cũng phản hồi. kéo sang phải thì đập lún màn hình mới kêu. <br/>
                    độ nhạy lực: <span className="font-mono text-[16px] md:text-[20px] bg-black text-white px-2 py-1 mx-1 leading-none">{sensitivity.toFixed(2)}</span> <span className="text-gray-500 text-[16px]">({getSensitivityText(sensitivity)})</span>
                  </p>
                  <div className="mb-12 max-w-sm ml-1">
                      <input 
                         type="range" min="0" max="1" step="0.05" 
                         value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                      />
                  </div>

                  <p className="mb-8 items-center leading-loose opacity-40">
                    <strong className="text-black line-through">2. bộ khóa tạp âm thủ công: </strong> <br/>
                    (bộ chống nhiễu nay đã được nâng cấp tự động nhận diện Volume Peak / Vector gia tốc nên tính năng này đã tháo bỏ, bạn cứ mở nhạc xập xình mà tát vào máy vẫn nhận diện chuẩn 100%).
                  </p>
                  <div className="mb-12 max-w-sm ml-1 opacity-40 pointer-events-none">
                      <input type="range" min="0" max="255" step="1" value="150" readOnly />
                  </div>

                  <p className="mb-8 items-center leading-loose">
                    <strong className="text-black">3. thời gian đợi: </strong> khoảng ngưng nghỉ giữa hai lần phản hồi để máy không phát ra liên tục. <br/>
                    hiện tại là: <span className="font-mono text-[16px] md:text-[20px] bg-black text-white px-2 py-1 mx-1">{cooldown.toFixed(1)}s</span>
                  </p>
                  <div className="mb-10 max-w-sm ml-1">
                      <input 
                         type="range" min="0.1" max="2" step="0.1" 
                         value={cooldown} onChange={(e) => setCooldown(parseFloat(e.target.value))}
                      />
                  </div>
                  <p>
                    thiết lập xong thì quay về <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>trang chủ</span>.
                  </p>
               </div>
            )}

            {activeTab === 'sounds' && (
               <div className="animate-fade-in">
                  <p className="mb-10">
                     bạn muốn âm thanh phát ra là gì?
                  </p>
                  <p className="mb-10">
                     âm thanh đang dùng: <span className="font-mono text-[16px] md:text-[20px] bg-black text-white px-2 py-1 ml-1">{selectedSound}</span>
                  </p>
                  
                  <div className="flex flex-wrap gap-x-8 gap-y-4 mb-10 text-[18px] md:text-[22px]">
                     {[
                       { id: 'scream1', label: 'tiếng dê la' },
                       { id: 'scream2', label: 'tiếng người hét' },
                       { id: 'bonk', label: 'vụng trộm gõ mỏ' },
                       { id: 'bruh', label: 'bruh chán nản' }
                     ].map(s => (
                       <span key={s.id} onClick={() => setSelectedSound(s.id)} className={`ferro-link ${selectedSound === s.id ? 'active' : ''}`}>{s.label}</span>
                     ))}
                     {customSounds.map(cs => (
                       <span key={cs.id} onClick={() => setSelectedSound(cs.id)} className={`ferro-link ${selectedSound === cs.id ? 'active' : ''}`}>[{cs.name}]</span>
                     ))}
                  </div>

                  <p>
                    chọn xong thì vòng lại <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>trang chủ</span>.
                  </p>
               </div>
            )}

            {activeTab === 'upload' && (
               <div className="animate-fade-in">
                  <p className="mb-10">
                    thêm âm thanh của riêng bạn. hỗ trợ mp3, wav. vui lòng cắt ngắn dưới 5 giây.
                  </p>
                  
                  {!pendingUpload ? (
                     <label className="inline-flex items-center gap-4 cursor-pointer mb-10 group mt-4">
                         <span className="font-mono text-[16px] md:text-[20px] border-2 border-black px-4 py-3 group-hover:bg-black group-hover:text-white transition-colors">
                             tải lên tệp âm thanh
                         </span>
                         <input type="file" accept="audio/mp3, audio/wav, audio/mpeg" className="hidden" onChange={handleFileSelect} />
                     </label>
                  ) : (
                     <div className="flex flex-col gap-4 mb-10 mt-4 max-w-md">
                         <span className="text-[14px] text-gray-500 font-mono tracking-widest uppercase mb-1">bạn muốn đặt tên gì cho nó?</span>
                         <input 
                            type="text" 
                            className="w-full border-b-2 border-gray-300 focus:border-black outline-none py-2 text-[20px] transition-colors"
                            value={pendingUpload.name}
                            onChange={(e) => setPendingUpload({...pendingUpload, name: e.target.value})}
                         />
                         <div className="flex gap-4 mt-4">
                            <button onClick={handleConfirmUpload} className="bg-black text-white font-mono text-[14px] px-6 py-2">
                               lưu & sử dụng
                            </button>
                            <button onClick={() => setPendingUpload(null)} className="border border-black text-black font-mono text-[14px] px-6 py-2">
                               hủy
                            </button>
                         </div>
                     </div>
                  )}

                  <p>
                    trở về <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>trang chủ</span>.
                  </p>
               </div>
            )}

            {activeTab === 'author' && (
               <div className="animate-fade-in text-[17px] md:text-[20px]">
                  <p className="mb-8">
                    mã nguồn mở nguyên bản trên github cộng đồng. báo cáo lỗi hoặc yêu cầu tính năng: 
                  </p>
                  <p className="mb-12 flex flex-wrap gap-x-6 gap-y-2">
                    <a href="https://github.com/tanbaycu/win-slap" target="_blank" className="ferro-link text-black font-semibold">star on github</a>
                    <a href="https://github.com/tanbaycu/win-slap/issues" target="_blank" className="ferro-link text-black font-semibold">mở issues</a> 
                    <a href="https://github.com/tanbaycu/win-slap/pulls" target="_blank" className="ferro-link text-black font-semibold">pull requests</a>
                  </p>

                  <p className="mb-8">
                    lên ý tưởng ngẫu hứng và phác thảo bởi <strong className="font-semibold text-black">tanbaycu</strong>.
                  </p>
                  <p className="mb-10 flex flex-wrap gap-x-6 gap-y-2">
                     <a href="#" className="ferro-link text-black font-semibold">portfolio</a>
                     <a href="https://github.com/tanbaycu" target="_blank" className="ferro-link text-black font-semibold">github</a> 
                     <a href="https://instagram.com/tanbaycu" target="_blank" className="ferro-link text-black font-semibold">instagram</a>
                  </p>
                  <p>
                    trở về <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>trang chủ</span>.
                  </p>
               </div>
            )}

         </div>
      </div>

      <div className="flex justify-between items-end font-mono text-[10px] md:text-xs text-[#999] tracking-widest border-t border-[#EAEAEA] pt-6 shrink-0 z-10 w-full mt-4">
         <div>
            &mdash; kết thúc tài liệu. tác giả tanbaycu.
         </div>
         <div className="text-right">
            {!isListening ? (
               <>chưa mở cảm biến. <span className="ferro-link text-black font-semibold cursor-pointer ml-1" onClick={initAudio}>[ đánh thức hệ thống ]</span></>
            ) : (
               <>cảm biến đang phân tích liên tục vòng lặp.</>
            )}
         </div>
      </div>

    </div>
  );
}

export default App;
