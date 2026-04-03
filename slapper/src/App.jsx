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
  
  // Sync config ref to avoid stale closures inside event listeners
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
      
      if (isElectron) {
          const { ipcRenderer } = window.require('electron');
          
          // Listen to IPC stats from the Python engine
          ipcRenderer.on('engine-stat', (event, stats) => {
             const { mode, force } = stats;

             frameCountRef.current++;
             if (frameCountRef.current % (mode === 'SENSOR' ? 2 : 4) === 0) {
                 setLiveStats({ mode, force });
             }

             let requiredForce = 0;
             let maxForceCap = 3;
             if (mode === 'SENSOR') {
                 requiredForce = 0.5 + (configRef.current.sensitivity * 1.5);
                 maxForceCap = requiredForce * 3;
             } else {
                 requiredForce = 5.0 + (configRef.current.sensitivity * 35.0);
                 maxForceCap = requiredForce * 4;
             }

             triggerSlapCheck(force, requiredForce, maxForceCap);
          });
      } else {
          // Mobile mode: use DeviceMotion API (Capacitor / Android browser)
          if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
              try {
                  const permissionState = await DeviceMotionEvent.requestPermission();
                  if (permissionState !== 'granted') {
                      alert("Please grant accelerometer permission to use WinSLAP on mobile.");
                  }
              } catch (e) {
                  console.error("Accelerometer permission error:", e);
              }
          }

          window.addEventListener('devicemotion', (event) => {
              if (!event.acceleration) return;
              const { x, y, z } = event.acceleration;
              // Compute resultant acceleration vector (gravity excluded)
              const force = Math.sqrt((x || 0)**2 + (y || 0)**2 + (z || 0)**2);
              
              frameCountRef.current++;
              if (frameCountRef.current % 4 === 0) {
                  setLiveStats({ mode: 'ACCEL', force });
              }
              
              // Mobile sensitivity threshold mapping
              const requiredForce = 5.0 + (configRef.current.sensitivity * 25.0);
              const maxForceCap = requiredForce * 3;
              
              triggerSlapCheck(force, requiredForce, maxForceCap);
          });
      }
      
      loadDefaultSound('scream1', 'https://www.myinstants.com/media/sounds/screaming-goat.mp3');
      loadDefaultSound('scream2', 'https://www.myinstants.com/media/sounds/wilhelm-scream.mp3');
      loadDefaultSound('bonk', 'https://www.myinstants.com/media/sounds/bonk_XyC0Hn8.mp3');
      loadDefaultSound('bruh', 'https://www.myinstants.com/media/sounds/movie_1.mp3');
      
    } catch (err) {
      console.error("Audio init error:", err);
    }
  };

  // Core slap detection gate: force threshold + cooldown guard
  const triggerSlapCheck = (force, requiredForce, maxForceCap) => {
      const now = Date.now() / 1000;
      if (
          force > requiredForce && 
          (now - lastSlapRef.current) > configRef.current.cooldown
      ) {
          lastSlapRef.current = now;
          // Volume scales linearly with excess force
          let forceVol = Math.min(1.0, Math.max(0.2, ((force - requiredForce) / maxForceCap) + 0.2));
          playSound(configRef.current.selectedSound, forceVol);
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
    let defaultName = file.name.split('.')[0] || 'custom sound';
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
        alert("Failed to decode audio file. Please use a valid MP3 or WAV.");
    }
  };

  // Human-readable sensitivity label
  const getSensitivityText = (val) => {
    if(val <= 0.1) return "hair trigger — whisper touch";
    if(val <= 0.35) return "light — gentle knock";
    if(val <= 0.65) return "balanced — firm slap";
    if(val <= 0.85) return "heavy — forceful impact";
    return "maximum — nearly indestructible";
  };

  return (
    <div className="w-full min-h-screen flex flex-col p-8 md:p-12 lg:p-16 selection:bg-[#EAEAEA] select-none lowercase font-sans text-black bg-[#FFFFFF]">
      
      {/* ── Top status bar ── */}
      <div className="flex justify-between items-start font-mono text-[10px] md:text-xs text-[#999] tracking-widest mb-10 shrink-0">
         <div className="flex flex-col gap-1.5 leading-tight">
            <span>system status</span>
            <span className="text-[#1A1A1A] font-medium">
               {isListening ? (
                  <>
                     listening {">"} <span className="font-bold text-black border border-black px-1" title="Measured impact force">force: {liveStats.force ? liveStats.force.toFixed(2) : "0.00"}</span> | <span className={`font-bold border border-black px-1 ${liveStats.mode === 'SENSOR' ? 'text-blue-600 border-blue-600' : 'text-green-600 border-green-600'}`}>{liveStats.mode === 'SENSOR' ? 'SENSOR CHIP' : 'MICROPHONE'}</span>
                  </>
               ) : 'idle — activate the engine below'}
            </span>
         </div>
         <div className="flex flex-col gap-1.5 leading-tight text-right font-bold text-[#1A1A1A]">
            <span className="text-[14px] flex items-center justify-end gap-1"><Hand size={14} className="opacity-90 mt-[1px]" /> winSLAP (Hybrid)</span>
         </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col justify-start max-w-4xl mx-auto w-full px-4 pt-10">
         
         <div className="text-[19px] md:text-[23px] lg:text-[26px] leading-[1.65] font-normal text-[#1A1A1A] tracking-[-0.01em]">

            {/* Guide tab */}
            {activeTab === 'guide' && (
               <div className="animate-fade-in">
                  <div className="mb-10 w-24 h-24 border-2 border-dashed border-[#1A1A1A]/20 flex items-center justify-center bg-gray-50/50">
                     <Hand size={40} className="text-[#1A1A1A] opacity-80" strokeWidth={1.5} />
                  </div>
                  
                  <p className="mb-10">
                    hello — this is <span className="font-bold border-b-2 border-black inline-block leading-tight">winSLAP</span>. 
                    your machine is about to become a creature that screams when struck.
                  </p>
                  <p className="mb-10">
                    the hybrid engine is active. on desktop it reads force via the Windows Sensor API or microphone peak analysis; on mobile it captures raw accelerometer vectors for 100% accuracy.
                  </p>
                  <p className="mb-10">
                    to begin, activate the engine at the bottom of the page. 
                    then tune the <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('settings')}>sensitivity</span>, 
                    select a <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('sounds')}>sound profile</span>, 
                    or <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('upload')}>upload your own mp3</span>.
                  </p>
               </div>
            )}

            {/* Settings tab */}
            {activeTab === 'settings' && (
               <div className="animate-fade-in">
                  <p className="mb-8 items-center leading-loose">
                    <strong className="text-black">1. impact threshold: </strong> slide left for hair-trigger response. slide right to require a harder impact. <br/>
                    sensitivity: <span className="font-mono text-[16px] md:text-[20px] bg-black text-white px-2 py-1 mx-1 leading-none">{sensitivity.toFixed(2)}</span> <span className="text-gray-500 text-[16px]">({getSensitivityText(sensitivity)})</span>
                  </p>
                  <div className="mb-12 max-w-sm ml-1">
                      <input 
                         type="range" min="0" max="1" step="0.05" 
                         value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                      />
                  </div>

                  <p className="mb-8 items-center leading-loose opacity-40">
                    <strong className="text-black line-through">2. manual noise gate: </strong> <br/>
                    (deprecated — the hybrid engine now performs automatic peak detection and acceleration vector analysis. ambient audio has zero effect on slap recognition.)
                  </p>
                  <div className="mb-12 max-w-sm ml-1 opacity-40 pointer-events-none">
                      <input type="range" min="0" max="255" step="1" value="150" readOnly />
                  </div>

                  <p className="mb-8 items-center leading-loose">
                    <strong className="text-black">3. response cooldown: </strong> minimum interval between consecutive triggers to prevent rapid-fire playback. <br/>
                    current: <span className="font-mono text-[16px] md:text-[20px] bg-black text-white px-2 py-1 mx-1">{cooldown.toFixed(1)}s</span>
                  </p>
                  <div className="mb-10 max-w-sm ml-1">
                      <input 
                         type="range" min="0.1" max="2" step="0.1" 
                         value={cooldown} onChange={(e) => setCooldown(parseFloat(e.target.value))}
                      />
                  </div>
                  <p>
                    done — go back to <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>home</span>.
                  </p>
               </div>
            )}

            {/* Sound selection tab */}
            {activeTab === 'sounds' && (
               <div className="animate-fade-in">
                  <p className="mb-10">
                     choose your reaction sound.
                  </p>
                  <p className="mb-10">
                     active: <span className="font-mono text-[16px] md:text-[20px] bg-black text-white px-2 py-1 ml-1">{selectedSound}</span>
                  </p>
                  
                  <div className="flex flex-wrap gap-x-8 gap-y-4 mb-10 text-[18px] md:text-[22px]">
                     {[
                       { id: 'scream1', label: 'goat scream' },
                       { id: 'scream2', label: 'wilhelm scream' },
                       { id: 'bonk', label: 'bonk' },
                       { id: 'bruh', label: 'bruh' }
                     ].map(s => (
                       <span key={s.id} onClick={() => setSelectedSound(s.id)} className={`ferro-link ${selectedSound === s.id ? 'active' : ''}`}>{s.label}</span>
                     ))}
                     {customSounds.map(cs => (
                       <span key={cs.id} onClick={() => setSelectedSound(cs.id)} className={`ferro-link ${selectedSound === cs.id ? 'active' : ''}`}>[{cs.name}]</span>
                     ))}
                  </div>

                  <p>
                    done — back to <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>home</span>.
                  </p>
               </div>
            )}

            {/* Upload tab */}
            {activeTab === 'upload' && (
               <div className="animate-fade-in">
                  <p className="mb-10">
                    upload a custom sound. mp3 and wav supported. keep it under 5 seconds.
                  </p>
                  
                  {!pendingUpload ? (
                     <label className="inline-flex items-center gap-4 cursor-pointer mb-10 group mt-4">
                         <span className="font-mono text-[16px] md:text-[20px] border-2 border-black px-4 py-3 group-hover:bg-black group-hover:text-white transition-colors">
                             upload audio file
                         </span>
                         <input type="file" accept="audio/mp3, audio/wav, audio/mpeg" className="hidden" onChange={handleFileSelect} />
                     </label>
                  ) : (
                     <div className="flex flex-col gap-4 mb-10 mt-4 max-w-md">
                         <span className="text-[14px] text-gray-500 font-mono tracking-widest uppercase mb-1">name this sound</span>
                         <input 
                            type="text" 
                            className="w-full border-b-2 border-gray-300 focus:border-black outline-none py-2 text-[20px] transition-colors"
                            value={pendingUpload.name}
                            onChange={(e) => setPendingUpload({...pendingUpload, name: e.target.value})}
                         />
                         <div className="flex gap-4 mt-4">
                            <button onClick={handleConfirmUpload} className="bg-black text-white font-mono text-[14px] px-6 py-2">
                               save & use
                            </button>
                            <button onClick={() => setPendingUpload(null)} className="border border-black text-black font-mono text-[14px] px-6 py-2">
                               cancel
                            </button>
                         </div>
                     </div>
                  )}

                  <p>
                    back to <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>home</span>.
                  </p>
               </div>
            )}

            {/* About / Author tab */}
            {activeTab === 'author' && (
               <div className="animate-fade-in text-[17px] md:text-[20px]">
                  <p className="mb-8">
                    open source on github. report bugs or request features: 
                  </p>
                  <p className="mb-12 flex flex-wrap gap-x-6 gap-y-2">
                    <a href="https://github.com/tanbaycu/win-slap" target="_blank" className="ferro-link text-black font-semibold">star on github</a>
                    <a href="https://github.com/tanbaycu/win-slap/issues" target="_blank" className="ferro-link text-black font-semibold">open issue</a> 
                    <a href="https://github.com/tanbaycu/win-slap/pulls" target="_blank" className="ferro-link text-black font-semibold">pull request</a>
                  </p>

                  <p className="mb-8">
                    conceived and built by <strong className="font-semibold text-black">tanbaycu</strong>.
                  </p>
                  <p className="mb-10 flex flex-wrap gap-x-6 gap-y-2">
                     <a href="#" className="ferro-link text-black font-semibold">portfolio</a>
                     <a href="https://github.com/tanbaycu" target="_blank" className="ferro-link text-black font-semibold">github</a> 
                     <a href="https://instagram.com/tanbaycu" target="_blank" className="ferro-link text-black font-semibold">instagram</a>
                  </p>
                  <p>
                    back to <span className="ferro-link text-black font-semibold" onClick={() => setActiveTab('guide')}>home</span>.
                  </p>
               </div>
            )}

         </div>
      </div>

      {/* ── Bottom navigation bar ── */}
      <div className="flex justify-between items-end font-mono text-[10px] md:text-xs text-[#999] tracking-widest border-t border-[#EAEAEA] pt-6 shrink-0 z-10 w-full mt-4">
         <div>
            &mdash; end of document. by tanbaycu.
         </div>
         <div className="text-right">
            {!isListening ? (
               <>engine inactive. <span className="ferro-link text-black font-semibold cursor-pointer ml-1" onClick={initAudio}>[ activate ]</span></>
            ) : (
               <>engine running — impact loop active.</>
            )}
         </div>
      </div>

    </div>
  );
}

export default App;
