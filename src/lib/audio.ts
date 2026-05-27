/**
 * AudioStreamer manages MP3 base64 chunks for gapless sequential playback.
 */
export class AudioStreamer {
  private queue: string[] = [];
  private isPlaying = false;
  private audio = new Audio();
  private onFinished?: () => void;
  public onStateChange?: (state: 'idle' | 'playing') => void;

  constructor() {
    this.audio.onended = () => {
      this.playNext();
    };
    this.audio.onerror = (e) => {
      console.error('Audio playback error', e);
      this.playNext();
    };
  }

  addChunk(base64: string) {
    // Determine mime based on string signature or assume mp3
    this.queue.push(`data:audio/mp3;base64,${base64}`);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onStateChange?.('idle');
      if (this.onFinished) this.onFinished();
      return;
    }
    
    this.isPlaying = true;
    this.onStateChange?.('playing');
    const src = this.queue.shift();
    if (src) {
      this.audio.src = src;
      this.audio.play().catch(e => {
        console.error('Play intercepted by browser', e);
        this.playNext();
      });
    }
  }

  stop() {
    this.queue = [];
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute('src'); // clear
    this.isPlaying = false;
    this.onStateChange?.('idle');
  }

  setFinishedCallback(cb: () => void) {
    this.onFinished = cb;
  }
}
