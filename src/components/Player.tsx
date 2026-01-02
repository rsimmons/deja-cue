import { useRef, useCallback } from "react";
import { PlaybackState } from "../lib/audio-player";
import "./Player.css";

interface PlayerProps {
  playbackState: PlaybackState;
  isLoading: boolean;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
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
  onSeek,
}: PlayerProps) {
  const { isPlaying, currentTime, maxPlayTime } = playbackState;
  const progress = maxPlayTime > 0 ? (currentTime / maxPlayTime) * 100 : 0;
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const calculateTimeFromEvent = useCallback((clientX: number): number => {
    if (!progressBarRef.current || maxPlayTime <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * maxPlayTime;
  }, [maxPlayTime]);

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    const time = calculateTimeFromEvent(e.clientX);
    onSeek(time);
  }, [calculateTimeFromEvent, onSeek]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    const time = calculateTimeFromEvent(e.clientX);
    onSeek(time);

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const time = calculateTimeFromEvent(e.clientX);
        onSeek(time);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [calculateTimeFromEvent, onSeek]);

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
        <div
          className="progress-bar"
          ref={progressBarRef}
          onClick={handleProgressClick}
          onMouseDown={handleMouseDown}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
          <div className="progress-thumb" style={{ left: `${progress}%` }} />
        </div>
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(maxPlayTime)}</span>
        </div>
      </div>
    </div>
  );
}
