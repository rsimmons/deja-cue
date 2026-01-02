# Déjà Cue

Tauri v2 + React + TypeScript app that quizzes users on their Rekordbox library.

## Commands

```bash
pnpm tauri dev      # Development
pnpm tauri build    # Production (outputs to src-tauri/target/release/bundle/macos/)
```

## Architecture

- `src/lib/rekordbox-parser.ts` - Parses Rekordbox XML exports, decodes file:// URLs
- `src/lib/audio-player.ts` - HTML5 Audio wrapper with 30s playback limit
- `src/lib/quiz-engine.ts` - Random track selection, state management
- `src/components/` - Player, RevealCard, PlaylistBrowser

## Notes

- Rekordbox no longer auto-saves XML; user must manually export via File → Export Collection in xml format
- App name: "Déjà Cue" in UI, "Deja Cue" in bundle/identifier (ASCII-safe)
- Uses Tauri asset protocol for local audio file playback
