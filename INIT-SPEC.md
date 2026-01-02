## Project: Rekordbox Library Quiz App

### Overview
Build a macOS desktop app using Tauri (v2) that quizzes the user on tracks from their Rekordbox library. The app reads a Rekordbox XML export, plays random excerpts, and lets the user test their track recognition.

### Tech Stack
- **Tauri v2** for the desktop shell
- **JavaScript/TypeScript** for all logic (minimal Rust — just Tauri scaffolding)
- **React** for the UI (or Svelte if you prefer, but React is fine)
- **fast-xml-parser** for parsing the Rekordbox XML
- **HTML5 Audio** for playback (via Tauri's asset protocol to access local files)
- Minimal, clean styling, from scratch.

### Rekordbox XML Details
- Default location on macOS: `~/Library/Pioneer/rekordbox/rekordbox.xml` (but let user select a file too)
- The XML has two main sections:
  - `COLLECTION` contains `TRACK` nodes with attributes: `TrackID`, `Name`, `Artist`, `Album`, `Location` (URL-encoded file path like `file://localhost/path/to/track.mp3`), etc.
  - `PLAYLISTS` contains nested `NODE` elements. Folders have `Type="0"`, playlists have `Type="1"`. Playlist nodes contain `TRACK` entries with a `Key` attribute that maps to `TrackID` in the collection.
- You'll need to decode the `Location` attribute — it's URL-encoded and starts with `file://localhost`

### Core Features (MVP)

**1. Library Loading**
- On launch, load their rekordbox.xml file. Prompt them to locate if not found in the default location.
- Parse and store track metadata in memory
- Remember the file path for next launch (use Tauri's localStorage if that works)

**2. Quiz Mode (Full Library)**
- Pick a random track from the entire collection
- Choose a random start point somewhere in the middle 50% of the track (avoid intros/outros)
- Play up to 30 seconds of audio
- Show playback progress but NOT the track info
- User clicks "Reveal" to see: Track Name, Artist, Album
- "Next" button loads another random track

**3. Playlist Browser (Phase 2)**
- Show a tree view of the user's playlist hierarchy (folders + playlists)
- User can select a playlist to limit the quiz to only tracks in that playlist
- Selection should persist during the session
- "All Tracks" option to go back to full library

### UI/UX Guidelines
- Clean, minimal, dark theme (think: Rekordbox vibes but simpler)
- Single-page feel — no complex navigation
- Show album art if available after revealing answer (there's an `Artwork` or artwork-related field in some exports, but don't block on this)
- Responsive controls: spacebar to play/pause, maybe enter for next/reveal would be nice

### Project Structure Suggestion
```
src/
  lib/
    rekordbox-parser.ts   # XML parsing, path decoding
    audio-player.ts       # Wrapper around audio playback
    quiz-engine.ts        # Random selection, state management
  components/
    Player.tsx
    RevealCard.tsx
    PlaylistBrowser.tsx
  App.tsx
  main.tsx
src-tauri/
  (standard Tauri scaffolding, minimal customization needed)
```

### Gotchas to Handle
- URL-decode the `Location` paths and strip `file://localhost` prefix
- Configure Tauri's `asset` protocol scope to allow reading audio files from the user's filesystem
- Handle tracks that can't be found (file moved/deleted) gracefully — skip and log
- Large libraries might have 10k+ tracks — keep parsing and random selection efficient

### Out of Scope for Now
- Persistent scoring/statistics
- Multiple user profiles
- Editing or writing back to Rekordbox
- Windows/Linux support
