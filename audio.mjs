// Sons originaux fournis dans audio/*.ogg + voix françaises de synthèse du téléphone.
// Audio local à chaque appareil. Ne modifie ni Firebase ni les résultats du match.
export const SFX = ['release','flight','impact','big_hit','miss','cheer','groan','bravo','tocar','miskine'];

export function createGameAudio({soundEnabled=()=>true,voicesEnabled=()=>true}={}){
  let context=null,master=null,unlocked=false;
  const cache=new Map();
  const constructor=()=>window.AudioContext||window.webkitAudioContext;
  const voiceSynth=()=>('speechSynthesis' in window ? window.speechSynthesis : null);
  function unlock(){
    try{
      if(!context){const AudioContext=constructor();if(!AudioContext)return;
        context=new AudioContext();master=context.createGain();master.gain.value=.76;master.connect(context.destination);
      }
      context.resume().catch(()=>{});unlocked=true;
    }catch{}
    if(soundEnabled())preload();
  }
  function url(name){return window.DARTS_EMBEDDED_SOUNDS?.[name]||`./audio/${name}.ogg`;}
  function preload(){for(const sound of SFX)load(sound);}
  function load(name){
    if(cache.has(name))return cache.get(name);
    const task=(async()=>{
      if(!context)return null;
      const result=await fetch(url(name));if(!result.ok)throw Error('SFX HTTP '+result.status);
      return context.decodeAudioData(await result.arrayBuffer());
    })().catch(()=>null);
    cache.set(name,task);return task;
  }
  async function play(name,{gain=1,rate=1,delay=0}={}){
    if(!soundEnabled())return;
    unlock();if(!context||!master)return;
    const buffer=await load(name);if(!buffer)return;
    if(!soundEnabled()||!unlocked)return;
    const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
    const volume=context.createGain();volume.gain.value=Math.min(1,gain);
    source.connect(volume);volume.connect(master);
    source.start(context.currentTime+Math.max(0,delay));
    source.onended=()=>{source.disconnect();volume.disconnect();};
  }
  function speak(text,avatar='stephane'){
    if(!voicesEnabled()||!soundEnabled()||!text)return;
    const synth=voiceSynth();
    if(synth&&typeof SpeechSynthesisUtterance!=='undefined'){
      try{
        const u=new SpeechSynthesisUtterance(String(text));
        const candidates=synth.getVoices();
        u.voice=candidates.find(v=>/fr(-|_)/i.test(v.lang)&&v.localService)
          ||candidates.find(v=>/^fr/i.test(v.lang))||null;
        u.lang='fr-FR';
        const props={franck:{rate:1.00,pitch:1.15},mathias:{rate:1.13,pitch:.83},stephane:{rate:.94,pitch:.98},invite:{rate:1,pitch:1}};
        Object.assign(u,props[avatar]||props.invite);u.volume=.96;
        synth.cancel();synth.speak(u);return;
      }catch{}
    }
    // Fallback : courts sons de voix synthétique intégrés, sans imitation réelle.
    play(/miskine/i.test(text)?'miskine':/tocar/i.test(text)?'tocar':'bravo',{gain:.45});
  }
  function stop(){try{voiceSynth()?.cancel()}catch{}}
  return {unlock,preload,play,speak,stop};
}
