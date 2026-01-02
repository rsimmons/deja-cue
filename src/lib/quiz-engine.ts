import { Track, PlaylistNode, getAllTrackIdsFromPlaylist } from "./rekordbox-parser";
import { getAudioPlayer, PlaybackState } from "./audio-player";
import { exists } from "@tauri-apps/plugin-fs";

export interface QuizState {
  currentTrack: Track | null;
  isRevealed: boolean;
  isLoading: boolean;
  error: string | null;
  playbackState: PlaybackState;
}

export type QuizStateListener = (state: QuizState) => void;

/**
 * Quiz engine that manages track selection and quiz flow
 */
export class QuizEngine {
  private tracks: Map<string, Track>;
  private activeTrackIds: string[]; // Filtered by playlist selection
  private currentTrack: Track | null = null;
  private isRevealed = false;
  private isLoading = false;
  private error: string | null = null;
  private listeners: Set<QuizStateListener> = new Set();
  private playbackState: PlaybackState;
  private usedTrackIds: Set<string> = new Set(); // Track which songs have been played

  constructor(tracks: Map<string, Track>) {
    this.tracks = tracks;
    this.activeTrackIds = Array.from(tracks.keys());
    this.playbackState = getAudioPlayer().getState();

    // Subscribe to audio player state
    getAudioPlayer().subscribe((state) => {
      this.playbackState = state;
      this.notifyListeners();
    });
  }

  /**
   * Subscribe to quiz state changes
   */
  subscribe(listener: QuizStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /**
   * Get current quiz state
   */
  getState(): QuizState {
    return {
      currentTrack: this.currentTrack,
      isRevealed: this.isRevealed,
      isLoading: this.isLoading,
      error: this.error,
      playbackState: this.playbackState,
    };
  }

  /**
   * Filter tracks to a specific playlist
   */
  setPlaylistFilter(playlist: PlaylistNode | null): void {
    if (playlist === null) {
      // All tracks
      this.activeTrackIds = Array.from(this.tracks.keys());
    } else {
      this.activeTrackIds = getAllTrackIdsFromPlaylist(playlist);
    }
    // Reset to start screen when changing playlist
    this.reset();
  }

  /**
   * Reset quiz to start screen
   */
  reset(): void {
    getAudioPlayer().stop();
    this.currentTrack = null;
    this.isRevealed = false;
    this.isLoading = false;
    this.error = null;
    this.usedTrackIds.clear();
    this.notifyListeners();
  }

  /**
   * Get a random track that hasn't been used yet
   */
  private getRandomUnusedTrack(): Track | null {
    // Get unused track IDs
    const unusedIds = this.activeTrackIds.filter(
      (id) => !this.usedTrackIds.has(id)
    );

    // If all tracks used, reset
    if (unusedIds.length === 0) {
      this.usedTrackIds.clear();
      return this.getRandomTrack();
    }

    const randomIndex = Math.floor(Math.random() * unusedIds.length);
    const trackId = unusedIds[randomIndex];
    return this.tracks.get(trackId) ?? null;
  }

  /**
   * Get a random track from active set
   */
  private getRandomTrack(): Track | null {
    if (this.activeTrackIds.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * this.activeTrackIds.length);
    const trackId = this.activeTrackIds[randomIndex];
    return this.tracks.get(trackId) ?? null;
  }

  /**
   * Calculate a random start point in the middle 50% of the track
   */
  private getRandomStartPoint(duration: number): number {
    // Avoid first 25% and last 25%
    const startRange = duration * 0.25;
    const endRange = duration * 0.75;
    const range = endRange - startRange;

    return startRange + Math.random() * range;
  }

  /**
   * Check if a track file exists on disk
   */
  private async checkTrackExists(track: Track): Promise<boolean> {
    try {
      return await exists(track.location);
    } catch {
      return false;
    }
  }

  /**
   * Load the next random track
   */
  async nextTrack(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    // Don't clear currentTrack or isRevealed yet - keep showing previous state
    this.notifyListeners();

    const player = getAudioPlayer();
    player.stop();

    // Try to find a valid track (max 10 attempts)
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const track = this.getRandomUnusedTrack();

      if (!track) {
        this.error = "No tracks available";
        this.isLoading = false;
        this.notifyListeners();
        return;
      }

      // Check if file exists
      const fileExists = await this.checkTrackExists(track);
      if (!fileExists) {
        console.warn(`Track file not found: ${track.location}`);
        this.usedTrackIds.add(track.id); // Mark as used so we don't try again
        attempts++;
        continue;
      }

      // Calculate start point
      const startOffset = this.getRandomStartPoint(track.duration);

      try {
        await player.load(track.location, startOffset, 30);
        this.currentTrack = track;
        this.isRevealed = false;
        this.usedTrackIds.add(track.id);
        this.isLoading = false;
        this.notifyListeners();

        // Auto-play
        await player.play();
        return;
      } catch (err) {
        console.error(`Failed to load track: ${track.name}`, err);
        this.usedTrackIds.add(track.id);
        attempts++;
      }
    }

    this.error = "Could not find a playable track";
    this.currentTrack = null;
    this.isRevealed = false;
    this.isLoading = false;
    this.notifyListeners();
  }

  /**
   * Reveal the current track info
   */
  reveal(): void {
    if (this.currentTrack) {
      this.isRevealed = true;
      this.notifyListeners();
    }
  }

  /**
   * Toggle play/pause
   */
  async togglePlayback(): Promise<void> {
    await getAudioPlayer().toggle();
  }

  /**
   * Get the number of tracks in the active set
   */
  getActiveTrackCount(): number {
    return this.activeTrackIds.length;
  }

  /**
   * Get total track count
   */
  getTotalTrackCount(): number {
    return this.tracks.size;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    getAudioPlayer().destroy();
    this.listeners.clear();
  }
}
