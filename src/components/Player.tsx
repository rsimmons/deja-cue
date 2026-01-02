import { PlaybackState } from "../lib/audio-player";
import "./Player.css";

interface PlayerProps {
  playbackState: PlaybackState;
  isLoading: boolean;
  onTogglePlayback: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function Player({
  playbackState,
  isLoading,
  onTogglePlayback,
}: PlayerProps) {
  const { isPlaying, currentTime, maxPlayTime } = playbackState;
  const progress = maxPlayTime > 0 ? (currentTime / maxPlayTime) * 100 : 0;

  return (
    <div className="player">
      <button
        className="play-button"
        onClick={onTogglePlayback}
        disabled={isLoading}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <span className="loading-spinner" />
        ) : isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      <div className="progress-container">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(maxPlayTime)}</span>
        </div>
      </div>
    </div>
  );
}
