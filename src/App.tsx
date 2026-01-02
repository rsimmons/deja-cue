import { useState, useEffect, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseRekordboxXml,
  getDefaultXmlPath,
  fileExists,
  RekordboxLibrary,
  PlaylistNode,
} from "./lib/rekordbox-parser";
import { QuizEngine, QuizState } from "./lib/quiz-engine";
import { Player } from "./components/Player";
import { RevealCard } from "./components/RevealCard";
import { PlaylistBrowser } from "./components/PlaylistBrowser";
import "./App.css";

type AppState =
  | { status: "loading" }
  | { status: "no-library" }
  | { status: "error"; message: string }
  | { status: "ready"; library: RekordboxLibrary; engine: QuizEngine };

function App() {
  const [appState, setAppState] = useState<AppState>({ status: "loading" });
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistNode | null>(
    null
  );
  const [xmlPath, setXmlPath] = useState<string | null>(null);
  const engineRef = useRef<QuizEngine | null>(null);

  // Load library on mount
  useEffect(() => {
    loadLibrary();
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

  const loadLibrary = async () => {
    setAppState({ status: "loading" });

    try {
      // Check for saved path in localStorage
      const savedPath = localStorage.getItem("rekordbox-xml-path");
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
        setAppState({ status: "no-library" });
      }
    } catch (err) {
      console.error("Failed to load library:", err);
      setAppState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
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

      // Save path for next time
      localStorage.setItem("rekordbox-xml-path", path);
      setXmlPath(path);

      const engine = new QuizEngine(library.tracks);
      setAppState({ status: "ready", library, engine });
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

  // Render loading state
  if (appState.status === "loading") {
    return (
      <div className="app app--centered">
        <div className="loading">
          <div className="loading-spinner" />
          <p>Loading library...</p>
        </div>
      </div>
    );
  }

  // Render no library state
  if (appState.status === "no-library") {
    return (
      <div className="app app--centered">
        <div className="welcome">
          <h1>Déjà Cue</h1>
          <p>Test your track recognition skills</p>
          <p className="welcome-hint">
            No Rekordbox library found. Please select your rekordbox.xml file.
          </p>
          <button className="btn btn--primary" onClick={handleSelectFile}>
            Select Library File
          </button>
        </div>
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
          <button className="btn btn--primary" onClick={handleSelectFile}>
            Try Another File
          </button>
        </div>
      </div>
    );
  }

  // Render main quiz UI
  const { library, engine } = appState;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Déjà Cue</h1>
          <button
            className="change-library-btn"
            onClick={handleSelectFile}
            title={xmlPath ?? "Change library"}
          >
            Change
          </button>
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
              <RevealCard
                track={quizState.currentTrack}
                isRevealed={quizState.isRevealed}
                onReveal={handleReveal}
                onNext={handleNext}
              />

              {quizState.currentTrack && (
                <Player
                  playbackState={quizState.playbackState}
                  isLoading={quizState.isLoading}
                  onTogglePlayback={handleTogglePlayback}
                />
              )}

              {quizState.error && (
                <div className="error-banner">
                  <p>{quizState.error}</p>
                  <button className="btn btn--secondary" onClick={handleNext}>
                    Try Another Track
                  </button>
                </div>
              )}

              {!quizState.currentTrack && !quizState.isLoading && (
                <div className="start-prompt">
                  <button className="btn btn--primary btn--large" onClick={handleNext}>
                    Start Quiz
                  </button>
                  <p className="keyboard-hint">
                    Press <kbd>Enter</kbd> to start, <kbd>Space</kbd> to
                    play/pause
                  </p>
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
