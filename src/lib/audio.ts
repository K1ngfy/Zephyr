/**
 * AudioStreamer manages MP3 base64 chunks for gapless sequential playback.
 */
export class AudioStreamer {
  private audio = new Audio();
  private buffer: string[] = [];
  private isDone = false;
  private isPlaying = false;
  public onStateChange?: (state: 'idle' | 'playing') => void;

  constructor() {
    this.audio.onended = () => {
      this.isPlaying = false;
      this.onStateChange?.('idle');
    };
    this.audio.onerror = (e) => {
      console.error('Audio playback error', e);
      this.isPlaying = false;
      this.onStateChange?.('idle');
    };
  }

  addChunk(base64: string) {
    this.buffer.push(base64);
    if (this.isDone && !this.isPlaying) {
      this.playBuffered();
    }
  }

  signalDone() {
    this.isDone = true;
    if (!this.isPlaying && this.buffer.length > 0) {
      this.playBuffered();
    }
  }

  private playBuffered() {
    try {
      const binaries = this.buffer.map(b => atob(b));
      let totalLen = 0;
      for (const bin of binaries) totalLen += bin.length;
      
      const bytes = new Uint8Array(totalLen);
      let offset = 0;
      for (const bin of binaries) {
        for (let i = 0; i < bin.length; i++) {
          bytes[offset++] = bin.charCodeAt(i);
        }
      }
      
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      this.audio.src = URL.createObjectURL(blob);
      
      this.isPlaying = true;
      this.onStateChange?.('playing');
      this.audio.play().catch(e => {
        console.error('Play intercepted by browser', e);
        this.isPlaying = false;
        this.onStateChange?.('idle');
      });
    } catch (e) {
      console.error('Audio buffer processing error:', e);
    }
  }

  stop() {
    this.buffer = [];
    this.isDone = true;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute('src');
    this.isPlaying = false;
    this.onStateChange?.('idle');
  }
}
