import { convertFileSrc } from "@tauri-apps/api/core";

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  startOffset: number; // Where in the track we started
  maxPlayTime: number; // Maximum seconds to play (30s default)
}

export type PlaybackStateListener = (state: PlaybackState) => void;

/**
 * Audio player wrapper for quiz playback
 * Handles loading tracks, playing from random offsets, and limiting play time
 */
export class AudioPlayer {
  private audio: HTMLAudioElement;
  private state: PlaybackState;
  private listeners: Set<PlaybackStateListener> = new Set();
  private updateInterval: number | null = null;

  constructor() {
    this.audio = new Audio();
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      startOffset: 0,
      maxPlayTime: 30,
    };

    this.audio.addEventListener("play", () => this.handlePlay());
    this.audio.addEventListener("pause", () => this.handlePause());
    this.audio.addEventListener("ended", () => this.handleEnded());
    this.audio.addEventListener("loadedmetadata", () =>
      this.handleLoadedMetadata()
    );
    this.audio.addEventListener("error", (e) => this.handleError(e));
  }

  /**
   * Subscribe to playback state changes
   */
  subscribe(listener: PlaybackStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  private handlePlay(): void {
    this.state.isPlaying = true;
    this.startUpdateLoop();
    this.notifyListeners();
  }

  private handlePause(): void {
    this.state.isPlaying = false;
    this.stopUpdateLoop();
    this.notifyListeners();
  }

  private handleEnded(): void {
    this.state.isPlaying = false;
    this.stopUpdateLoop();
    this.notifyListeners();
  }

  private handleLoadedMetadata(): void {
    this.state.duration = this.audio.duration;
    this.notifyListeners();
  }

  private handleError(e: Event): void {
    console.error("Audio playback error:", e);
    this.state.isPlaying = false;
    this.stopUpdateLoop();
    this.notifyListeners();
  }

  private startUpdateLoop(): void {
    if (this.updateInterval) return;

    this.updateInterval = window.setInterval(() => {
      const elapsed = this.audio.currentTime - this.state.startOffset;
      this.state.currentTime = elapsed;

      // Check if we've exceeded max play time
      if (elapsed >= this.state.maxPlayTime) {
        this.pause();
      }

      this.notifyListeners();
    }, 100);
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Load a track for playback
   * @param filePath - Local file path to the audio file
   * @param startOffset - Where to start playing (in seconds)
   * @param maxPlayTime - Maximum time to play (default 30s)
   */
  async load(
    filePath: string,
    startOffset: number = 0,
    maxPlayTime: number = 30
  ): Promise<void> {
    this.stop();

    // Convert local file path to Tauri asset URL
    const assetUrl = convertFileSrc(filePath);

    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      startOffset,
      maxPlayTime,
    };

    this.audio.src = assetUrl;

    // Wait for metadata to load
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        this.audio.removeEventListener("loadedmetadata", onLoaded);
        this.audio.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        this.audio.removeEventListener("loadedmetadata", onLoaded);
        this.audio.removeEventListener("error", onError);
        reject(new Error("Failed to load audio"));
      };
      this.audio.addEventListener("loadedmetadata", onLoaded);
      this.audio.addEventListener("error", onError);
      this.audio.load();
    });

    // Seek to start offset
    this.audio.currentTime = startOffset;
    this.state.duration = this.audio.duration;
    this.notifyListeners();
  }

  /**
   * Start or resume playback
   */
  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch (err) {
      console.error("Failed to play:", err);
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.audio.pause();
  }

  /**
   * Toggle play/pause
   */
  async toggle(): Promise<void> {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    this.pause();
    this.audio.src = "";
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      startOffset: 0,
      maxPlayTime: 30,
    };
    this.notifyListeners();
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return { ...this.state };
  }

  /**
   * Check if audio is loaded and ready
   */
  isReady(): boolean {
    return this.audio.readyState >= 2; // HAVE_CURRENT_DATA or higher
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopUpdateLoop();
    this.audio.pause();
    this.audio.src = "";
    this.listeners.clear();
  }
}

// Singleton instance
let playerInstance: AudioPlayer | null = null;

export function getAudioPlayer(): AudioPlayer {
  if (!playerInstance) {
    playerInstance = new AudioPlayer();
  }
  return playerInstance;
}
