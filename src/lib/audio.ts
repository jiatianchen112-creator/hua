export class AudioSystem {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  padGain: GainNode | null = null;
  padOsc1: OscillatorNode | null = null;
  padOsc2: OscillatorNode | null = null;
  isPlaying: boolean = false;
  lastChimeTime: number = 0;

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    this.startAmbientPad();
  }

  isInitialized() {
    return this.ctx !== null;
  }

  startAmbientPad() {
    if (this.isPlaying || !this.ctx || !this.masterGain) return;
    this.isPlaying = true;

    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0; // fade in later
    this.padGain.connect(this.masterGain);

    // Warm, deep, pulsing pad
    this.padOsc1 = this.ctx.createOscillator();
    this.padOsc1.type = 'triangle';
    this.padOsc1.frequency.value = 65.41; // C2

    this.padOsc2 = this.ctx.createOscillator();
    this.padOsc2.type = 'sine';
    this.padOsc2.frequency.value = 65.8; // slightly detuned

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // 10 seconds per pulse
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 200;
    
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.padOsc1.connect(filter);
    this.padOsc2.connect(filter);
    filter.connect(this.padGain);

    this.padOsc1.start();
    this.padOsc2.start();
    lfo.start();

    // Fade in
    this.padGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 4.0);
  }

  playChime(velocity: number) {
    if (!this.ctx || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    if (now - this.lastChimeTime < 0.1) return; // limit firing rate
    this.lastChimeTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Pentatonic scale frequencies starting around C5
    const frequencies = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98];
    const index = Math.floor(Math.random() * frequencies.length);
    let freq = frequencies[index];

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    // Soft attack, long release
    const targetVolume = Math.min(0.2, (velocity / 100) * 0.2) + 0.05;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(targetVolume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5 + Math.random() * 1.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 3.0);
  }

  playBloom() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Glass-like resonance: multiple sines with non-integer ratios
    const ratios = [1.0, 2.76, 5.4, 8.9, 13.34];
    const baseFreq = 300 + Math.random() * 100;

    ratios.forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);

      // Pitch drop for impact effect
      osc.frequency.exponentialRampToValueAtTime(baseFreq * ratio * 0.9, now + 0.5);

      gain.gain.setValueAtTime(0, now);
      const volume = i === 0 ? 0.3 : 0.1 / i;
      gain.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0 + (1/ratio));

      // Add a slight stereo pan for depth
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = (Math.random() - 0.5) * 0.8;

      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 4.0);
    });
  }
}

export const audioSystem = new AudioSystem();
