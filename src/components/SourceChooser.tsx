import "./SourceChooser.css";

export type DataSourceType = "database" | "xml";

interface SourceChooserProps {
  onChooseDatabase: () => void;
  onChooseXml: () => void;
  isLoading?: boolean;
}

export function SourceChooser({ onChooseDatabase, onChooseXml, isLoading }: SourceChooserProps) {
  if (isLoading) {
    return (
      <div className="source-chooser source-chooser--loading">
        <div className="loading-spinner" />
        <p>Loading library...</p>
        <p className="loading-note">This may take a moment</p>
      </div>
    );
  }

  return (
    <div className="source-chooser">
      <header className="source-chooser-header">
        <h1>Déjà Cue</h1>
        <p>Test your track recognition skills</p>
      </header>

      <div className="source-chooser-options">
        <button className="source-option" onClick={onChooseDatabase}>
          <div className="source-option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <h2>Rekordbox Database</h2>
          <p className="source-option-desc">
            Read directly from Rekordbox — no export needed.
          </p>
          <p className="source-option-caveat">
            Note: Smart playlists are not supported.
          </p>
        </button>

        <div className="source-divider">
          <span>or</span>
        </div>

        <button className="source-option" onClick={onChooseXml}>
          <div className="source-option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h2>XML Export</h2>
          <p className="source-option-desc">
            Use an exported XML file — supports smart playlists.
          </p>
          <p className="source-option-caveat">
            To export: In Rekordbox, go to File → Export Collection in xml format. (Sometimes you need to run it twice due to a Rekordbox bug.)
          </p>
        </button>
      </div>
    </div>
  );
}
