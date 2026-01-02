import { Track } from "../lib/rekordbox-parser";
import "./RevealCard.css";

interface RevealCardProps {
  track: Track;
  isRevealed: boolean;
  onReveal: () => void;
  onNext: () => void;
}

export function RevealCard({
  track,
  isRevealed,
  onReveal,
  onNext,
}: RevealCardProps) {
  return (
    <div className="reveal-card">
      {isRevealed ? (
        <div className="track-info">
          <h2 className="track-name">{track.name}</h2>
          <p className="track-artist">{track.artist}</p>
          {track.album && <p className="track-album">{track.album}</p>}
          <div className="track-meta">
            {track.bpm && <span className="meta-tag">{Math.round(track.bpm)} BPM</span>}
            {track.key && <span className="meta-tag">{track.key}</span>}
            {track.genre && <span className="meta-tag">{track.genre}</span>}
          </div>
        </div>
      ) : (
        <div className="mystery">
          <div className="mystery-icon">?</div>
          <p className="mystery-text">What track is this?</p>
        </div>
      )}

      <div className="card-actions">
        {!isRevealed ? (
          <button className="btn btn--primary" onClick={onReveal}>
            Reveal
          </button>
        ) : (
          <button className="btn btn--primary" onClick={onNext}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
