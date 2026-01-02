import { useState, useEffect, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseRekordboxXml,
  getDefaultXmlPath,
  fileExists,
  RekordboxLibrary,
  PlaylistNode,
} from "./lib/rekordbox-parser";
import { readRekordboxDatabase } from "./lib/database-reader";
import { QuizEngine, QuizState } from "./lib/quiz-engine";
import { Player } from "./components/Player";
import { RevealCard } from "./components/RevealCard";
import { PlaylistBrowser } from "./components/PlaylistBrowser";
import { SourceChooser, DataSourceType } from "./components/SourceChooser";
import "./App.css";

const STORAGE_KEY_SOURCE_TYPE = "rekordbox-source-type";
const STORAGE_KEY_XML_PATH = "rekordbox-xml-path";

type AppState =
  | { status: "choosing" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; library: RekordboxLibrary; engine: QuizEngine; source: DataSourceType };

function App() {
  const [appState, setAppState] = useState<AppState>({ status: "loading" });
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistNode | null>(
    null
  );
  const [xmlPath, setXmlPath] = useState<string | null>(null);
  const engineRef = useRef<QuizEngine | null>(null);

  // Check for saved preference on mount
  useEffect(() => {
    const savedSourceType = localStorage.getItem(STORAGE_KEY_SOURCE_TYPE) as DataSourceType | null;
    if (savedSourceType) {
      loadFromSourceType(savedSourceType);
    } else {
      setAppState({ status: "choosing" });
    }
  }, []);

  // Subscribe to quiz state changes
  useEffect(() => {
    if (appState.status === "ready") {
      engineRef.current = appState.engine;
      return appState.engine.subscribe(setQuizState);
    }
  }, [appState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          engine.togglePlayback();
          break;
        case "Enter":
          e.preventDefault();
          if (quizState?.isRevealed) {
            engine.nextTrack();
          } else if (quizState?.currentTrack) {
            engine.reveal();
          } else {
            engine.nextTrack();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quizState]);

  const loadFromSourceType = async (sourceType: DataSourceType) => {
    setAppState({ status: "loading" });

    try {
      if (sourceType === "database") {
        await loadFromDatabase();
      } else {
        await loadFromXml();
      }
    } catch (err) {
      console.error("Failed to load library:", err);
      setAppState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const loadFromDatabase = async () => {
    console.log("Attempting to read from Rekordbox database...");
    const library = await readRekordboxDatabase();
    console.log("Database read successful, tracks:", library.tracks.size);

    if (library.tracks.size === 0) {
      setAppState({
        status: "error",
        message: "No tracks found in the Rekordbox database",
      });
      return;
    }

    localStorage.setItem(STORAGE_KEY_SOURCE_TYPE, "database");
    const engine = new QuizEngine(library.tracks);
    setAppState({ status: "ready", library, engine, source: "database" });
  };

  const loadFromXml = async () => {
    // Check for saved path in localStorage
    const savedPath = localStorage.getItem(STORAGE_KEY_XML_PATH);
    let path: string | null = null;

    if (savedPath && (await fileExists(savedPath))) {
      path = savedPath;
    } else {
      // Try default location
      const defaultPath = await getDefaultXmlPath();
      if (await fileExists(defaultPath)) {
        path = defaultPath;
      }
    }

    if (path) {
      await loadFromPath(path);
    } else {
      // Prompt user to select a file
      await handleSelectFile();
    }
  };

  const handleChooseDatabase = async () => {
    setAppState({ status: "loading" });
    try {
      await loadFromDatabase();
    } catch (err) {
      console.error("Failed to load from database:", err);
      setAppState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to read Rekordbox database",
      });
    }
  };

  const handleChooseXml = async () => {
    // For XML, we always prompt the user to select a file on first choice
    await handleSelectFile();
  };

  const handleChangeSource = () => {
    // Stop playback before changing source
    if (appState.status === "ready") {
      appState.engine.reset();
    }
    setAppState({ status: "choosing" });
  };

  const refreshLibrary = async () => {
    if (appState.status !== "ready") return;
    const currentSource = appState.source;
    // Stop playback before refreshing
    appState.engine.reset();
    setAppState({ status: "loading" });
    try {
      await loadFromSourceType(currentSource);
    } catch (err) {
      console.error("Failed to refresh library:", err);
      setAppState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to refresh library",
      });
    }
  };

  const loadFromPath = async (path: string) => {
    setAppState({ status: "loading" });

    try {
      const library = await parseRekordboxXml(path);

      if (library.tracks.size === 0) {
        setAppState({
          status: "error",
          message: "No tracks found in the library",
        });
        return;
      }

      // Save path and source type for next time
      localStorage.setItem(STORAGE_KEY_XML_PATH, path);
      localStorage.setItem(STORAGE_KEY_SOURCE_TYPE, "xml");
      setXmlPath(path);

      const engine = new QuizEngine(library.tracks);
      setAppState({ status: "ready", library, engine, source: "xml" });
    } catch (err) {
      console.error("Failed to parse library:", err);
      setAppState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to parse XML",
      });
    }
  };

  const handleSelectFile = async () => {
    const selected = await open({
      filters: [{ name: "Rekordbox XML", extensions: ["xml"] }],
      multiple: false,
    });

    if (selected) {
      await loadFromPath(selected);
    } else {
      // User cancelled - go back to chooser if we're in loading state
      if (appState.status === "loading") {
        setAppState({ status: "choosing" });
      }
    }
  };

  const handleSelectPlaylist = useCallback(
    (playlist: PlaylistNode | null) => {
      setSelectedPlaylist(playlist);
      if (appState.status === "ready") {
        appState.engine.setPlaylistFilter(playlist);
      }
    },
    [appState]
  );

  const handleReveal = useCallback(() => {
    if (appState.status === "ready") {
      appState.engine.reveal();
    }
  }, [appState]);

  const handleNext = useCallback(() => {
    if (appState.status === "ready") {
      appState.engine.nextTrack();
    }
  }, [appState]);

  const handleTogglePlayback = useCallback(() => {
    if (appState.status === "ready") {
      appState.engine.togglePlayback();
    }
  }, [appState]);

  const handleSeek = useCallback((time: number) => {
    if (appState.status === "ready") {
      appState.engine.seek(time);
    }
  }, [appState]);

  // Render source chooser
  if (appState.status === "choosing") {
    return (
      <div className="app app--centered">
        <SourceChooser
          onChooseDatabase={handleChooseDatabase}
          onChooseXml={handleChooseXml}
        />
      </div>
    );
  }

  // Render loading state
  if (appState.status === "loading") {
    return (
      <div className="app app--centered">
        <SourceChooser
          onChooseDatabase={handleChooseDatabase}
          onChooseXml={handleChooseXml}
          isLoading={true}
        />
      </div>
    );
  }

  // Render error state
  if (appState.status === "error") {
    return (
      <div className="app app--centered">
        <div className="error">
          <h2>Error</h2>
          <p>{appState.message}</p>
          <button className="btn btn--primary" onClick={handleChangeSource}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Render main quiz UI
  const { library, engine, source } = appState;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Déjà Cue</h1>
          <div className="header-buttons">
            <button
              className="header-btn"
              onClick={refreshLibrary}
              title="Refresh library"
            >
              Refresh
            </button>
            <button
              className="header-btn"
              onClick={handleChangeSource}
              title="Change data source"
            >
              Change
            </button>
          </div>
        </div>
        <div className="library-source">
          {source === "database" ? "Reading from Rekordbox database" : `Reading from XML${xmlPath ? `: ${xmlPath.split('/').pop()}` : ''}`}
        </div>
        <PlaylistBrowser
          root={library.playlists}
          selectedPlaylist={selectedPlaylist}
          onSelectPlaylist={handleSelectPlaylist}
          totalTracks={engine.getTotalTrackCount()}
          activeTracks={engine.getActiveTrackCount()}
        />
      </aside>

      <main className="main">
        <div className="quiz-container">
          {quizState && (
            <>
              {/* Start screen - no track loaded yet */}
              {!quizState.currentTrack && !quizState.isLoading && !quizState.error && (
                <div className="start-prompt">
                  <button className="btn btn--primary btn--large" onClick={handleNext}>
                    Start Quiz
                  </button>
                  <p className="keyboard-hint">
                    Press <kbd>Enter</kbd> to start
                  </p>
                </div>
              )}

              {/* Active quiz - track is loaded */}
              {quizState.currentTrack && (
                <>
                  <RevealCard
                    track={quizState.currentTrack}
                    isRevealed={quizState.isRevealed}
                    onReveal={handleReveal}
                    onNext={handleNext}
                  />

                  <Player
                    playbackState={quizState.playbackState}
                    isLoading={quizState.isLoading}
                    onTogglePlayback={handleTogglePlayback}
                    onSeek={handleSeek}
                  />

                  <p className="keyboard-hint keyboard-hint--bottom">
                    <kbd>Space</kbd> play/pause
                    {quizState.isRevealed ? (
                      <> · <kbd>Enter</kbd> next track</>
                    ) : (
                      <> · <kbd>Enter</kbd> reveal</>
                    )}
                  </p>
                </>
              )}

              {/* Loading state */}
              {quizState.isLoading && !quizState.currentTrack && (
                <div className="loading">
                  <div className="loading-spinner" />
                  <p>Loading track...</p>
                </div>
              )}

              {/* Error state */}
              {quizState.error && (
                <div className="error-banner">
                  <p>{quizState.error}</p>
                  <button className="btn btn--secondary" onClick={handleNext}>
                    Try Another Track
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
