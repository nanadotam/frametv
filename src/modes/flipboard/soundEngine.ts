import { FLAP_AUDIO_BASE64 } from './flapAudio';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private _initialized = false;
  private _audioBuffer: AudioBuffer | null = null;
  private _currentSource: AudioBufferSourceNode | null = null;
  muted = false;

  async init() {
    if (this._initialized) return;
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this._initialized = true;
    try {
      const binaryStr = atob(FLAP_AUDIO_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      this._audioBuffer = await this.ctx.decodeAudioData(bytes.buffer);
    } catch (e) {
      console.warn('Failed to decode flap audio:', e);
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTransition() {
    if (!this.ctx || !this._audioBuffer || this.muted) return;
    this.resume();
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch { /* already stopped */ }
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this._audioBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
    this._currentSource = source;
    source.onended = () => { if (this._currentSource === source) this._currentSource = null; };
  }
}
