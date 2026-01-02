# Déjà Cue

A macOS app that quizzes you on tracks from your Rekordbox library. It plays random 30-second excerpts and lets you test your track recognition skills.

## Setup

```bash
pnpm install
```

Export your Rekordbox library: File → Export Collection in xml format

## Development

```bash
pnpm tauri dev
```

## Production Build

```bash
pnpm tauri build
```

Outputs to `src-tauri/target/release/bundle/macos/Deja Cue.app`
