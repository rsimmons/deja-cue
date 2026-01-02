# Déjà Cue - AI Agent Notes

Tauri v2 + React + TypeScript app. See README.md for human-readable docs.

## Quick Commands

```bash
pnpm tauri dev      # Development
pnpm tauri build    # Production build
```

## Tauri v2 Sidecar Configuration (CRITICAL)

The app bundles a Python tool as a Tauri "sidecar" binary. Getting this working requires **exact coordination across 4 files**. If any are mismatched, you'll get cryptic errors.

### The 4 Files That Must Match

1. **Physical binary**: `src-tauri/binaries/rekordbox-reader-{TARGET_TRIPLE}`
   - MUST have target triple suffix (e.g., `-aarch64-apple-darwin`)
   - Get your triple with: `rustc -vV | grep host`
   - Tauri strips the suffix when bundling into the .app

2. **tauri.conf.json** `bundle.externalBin`:
   ```json
   "externalBin": ["binaries/rekordbox-reader"]
   ```
   - Path is relative to src-tauri/
   - Do NOT include the target triple suffix here

3. **capabilities/default.json** permissions:
   ```json
   {
     "identifier": "shell:allow-execute",
     "allow": [{ "name": "binaries/rekordbox-reader", "sidecar": true, "args": true }]
   },
   {
     "identifier": "shell:allow-spawn",
     "allow": [{ "name": "binaries/rekordbox-reader", "sidecar": true, "args": true }]
   }
   ```
   - The `name` must EXACTLY match the `externalBin` path
   - Need BOTH execute AND spawn permissions

4. **TypeScript code** `Command.sidecar()`:
   ```typescript
   Command.sidecar("binaries/rekordbox-reader", [])
   ```
   - Path must EXACTLY match the `externalBin` entry

### Common Errors and Causes

| Error Message | Cause |
|---------------|-------|
| `sidecar not configured under tauri.conf.json > bundle > externalBin` | Path in `Command.sidecar()` doesn't match `externalBin` entry |
| `Command plugin:shell\|spawn not allowed by ACL` | Missing `shell:allow-spawn` permission in capabilities, or `name` doesn't match |
| Binary not found at runtime | Missing target triple suffix on physical file, or file not in `src-tauri/binaries/` |
| App crashes on launch with shell plugin error | Old Tauri v1 config syntax (`plugins.shell.scope`) - use capabilities file instead |

### Debugging Tips

- Add `alert()` in catch blocks to see errors (WebView console may not be accessible)
- Test the bundled binary directly: `"/path/to/App.app/Contents/MacOS/rekordbox-reader"`
- Check what got bundled: `ls -la "/path/to/App.app/Contents/MacOS/"`

## After Modifying Python Tool

```bash
cd tools/rekordbox-reader
python3 -m PyInstaller --onefile --name rekordbox-reader --clean --noconfirm reader.py
cp dist/rekordbox-reader ../../src-tauri/binaries/rekordbox-reader-aarch64-apple-darwin
```

Then rebuild the Tauri app.

## Data Source Selection

On first launch, the app shows a chooser screen for the user to pick between:
- **Database**: Direct Rekordbox database reading (no export needed, but no smart playlist support)
- **XML Export**: Manual export from Rekordbox (supports smart playlists)

The choice is saved in `localStorage` under key `rekordbox-source-type` ("database" or "xml").
For XML, the file path is saved under `rekordbox-xml-path`.

To reset to the chooser screen, click the "Change" button in the sidebar header.

## Rekordbox Database Details

- **Playlist ordering**: Use `Seq` attribute for sort order
- **Parent ID**: Top-level playlists have `ParentID="root"` (string), not `None`
- **Smart playlists**: Have `is_smart_playlist=True`, but `Songs` is empty (they're rule-based)
- **pyrekordbox**: Auto-detects database location, use `Rekordbox6Database(unlock=True)`
