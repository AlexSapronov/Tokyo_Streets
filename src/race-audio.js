export const AUDIO_KEY='tokyo-streets-audio-v1';
export function audioSettings(storage){
 try{const raw=JSON.parse(storage?.getItem(AUDIO_KEY)||'{}');return {enabled:raw.enabled===true,volume:Number.isFinite(raw.volume)?Math.max(0,Math.min(.6,raw.volume)):.2};}catch{return {enabled:false,volume:.2};}
}
export class RaceAudio {
 constructor(storage,createContext=()=>{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;return Context?new Context():null;}){
  this.storage=storage;this.createContext=createContext;Object.assign(this,audioSettings(storage));this.available=true;this.running=false;this.unlocked=false;
 }
 persist(){try{this.storage?.setItem(AUDIO_KEY,JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
 async unlock(){
  try{
   if(!this.context){
    const c=this.createContext();if(!c){this.available=false;return false;}this.context=c;
    this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
    this.engine=c.createOscillator();this.engine.type='sawtooth';this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
    this.harmonic=c.createOscillator();this.harmonic.type='triangle';this.harmonicGain=c.createGain();this.harmonicGain.gain.value=0;this.harmonic.connect(this.harmonicGain);this.harmonicGain.connect(this.master);this.harmonic.start();
    const noise=c.createBuffer(1,c.sampleRate,c.sampleRate),data=noise.getChannelData(0);let seed=17;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.5;}
    this.tires=c.createBufferSource();this.tires.buffer=noise;this.tires.loop=true;this.filter=c.createBiquadFilter();this.filter.type='bandpass';this.filter.frequency.value=1400;
    this.tireGain=c.createGain();this.tireGain.gain.value=0;this.tires.connect(this.filter);this.filter.connect(this.tireGain);this.tireGain.connect(this.master);this.tires.start();
   }
   if(this.context.state!=='running')await this.context.resume();this.unlocked=this.context.state==='running';return this.unlocked;
  }catch{this.available=false;this.dispose();return false;}
 }
 async setEnabled(value){
  this.enabled=!!value;if(this.enabled&&!await this.unlock())this.enabled=false;
  if(!this.enabled)this.stop();this.persist();return this.enabled;
 }
 setVolume(value){if(Number.isFinite(value))this.volume=Math.max(0,Math.min(.6,value));if(this.context)this.target(this.master.gain,this.running?this.volume:0);this.persist();}
 target(param,value){param.setTargetAtTime(value,this.context.currentTime,.035);}
 update(frame,active=true){
  if(!active||!this.enabled||!this.unlocked||!this.context||this.context.state!=='running'){this.stop();return;}
  this.running=true;const rpm=Math.max(600,Math.min(10000,frame.rpm||900)),shift=this.gear>0&&frame.gear>0&&frame.gear!==this.gear;this.gear=frame.gear;
  this.target(this.engine.frequency,rpm/60*2*(shift?.82:1));this.target(this.harmonic.frequency,rpm/60*4);
  this.target(this.engineGain.gain,(shift?.025:.055)*(.4+(frame.throttle||0)*.6));this.target(this.harmonicGain.gain,.025);
  this.target(this.tireGain.gain,Math.min(.13,(frame.smoke||0)*.13));this.target(this.filter.frequency,frame.braking?1850:1100);
  this.target(this.master.gain,this.volume);
 }
 stop(){this.running=false;this.gear=undefined;if(this.context&&this.master){try{this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(0,this.context.currentTime);}catch{}}}
 dispose(){this.stop();for(const node of [this.engine,this.harmonic,this.tires]){try{node?.stop();node?.disconnect();}catch{}}try{this.context?.close()?.catch?.(()=>{});}catch{}this.context=null;this.unlocked=false;}
}
