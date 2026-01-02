# Déjà Cue

A macOS app that quizzes you on tracks from your Rekordbox library. It plays random 30-second excerpts and lets you test your track recognition skills.

## Features

- Two data source options on first launch:
  - **Rekordbox Database**: Reads directly from Rekordbox — no export needed, but smart playlists aren't supported
  - **XML Export**: Supports smart playlists, but requires manual export from Rekordbox
- Filter by playlist or folder
- Keyboard shortcuts: Space to play/pause, Enter to reveal/next
- Remembers your data source choice between sessions

## Setup

```bash
pnpm install
```

### Building the Rekordbox Reader

The app includes a bundled Python tool to read Rekordbox's encrypted database. Build it before building the app:

```bash
cd tools/rekordbox-reader
python3 -m pip install -r requirements.txt pyinstaller
python3 -m PyInstaller --onefile --name rekordbox-reader --clean --noconfirm reader.py
cp dist/rekordbox-reader ../src-tauri/binaries/rekordbox-reader-aarch64-apple-darwin
```

Note: The binary name must include the target triple suffix (`-aarch64-apple-darwin` for Apple Silicon). Get your target triple with `rustc -vV | grep host`.

**Important**: The sidecar path must match exactly in 4 places: the physical file, `tauri.conf.json`, `capabilities/default.json`, and the TypeScript code. See `CLAUDE.md` for detailed troubleshooting if you encounter sidecar issues.

## Development

```bash
pnpm tauri dev
```

## Production Build

```bash
pnpm tauri build
```

Outputs to `src-tauri/target/release/bundle/macos/Deja Cue.app`

## Architecture

```
src/
  lib/
    rekordbox-parser.ts   # Parses Rekordbox XML exports
    database-reader.ts    # Invokes bundled Python tool for database reading
    audio-player.ts       # HTML5 Audio wrapper with 30s playback limit
    quiz-engine.ts        # Random track selection, state management
  components/
    Player.tsx            # Playback controls
    RevealCard.tsx        # Track reveal UI
    PlaylistBrowser.tsx   # Playlist navigation sidebar

tools/
  rekordbox-reader/       # Python CLI tool (bundled as sidecar)
    reader.py             # Reads Rekordbox master.db using pyrekordbox
    requirements.txt      # Python dependencies

src-tauri/
  binaries/               # Sidecar binaries (with target triple suffix)
  capabilities/           # Tauri v2 permission capabilities
```

## Notes

- The Python tool is READ-ONLY and safe to run while Rekordbox is open
- Smart playlists show with a lightning bolt icon but can't be used when reading from the database (they're rule-based, not static track lists). Use XML export if you need smart playlists.
- To export XML from Rekordbox: File → Export Collection in xml format (sometimes you need to run it twice due to a Rekordbox bug)
- Click "Change" in the sidebar to switch between database and XML sources
- App name: "Déjà Cue" in UI, "Deja Cue" in bundle/identifier (ASCII-safe)
