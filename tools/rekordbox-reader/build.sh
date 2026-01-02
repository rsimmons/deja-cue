#!/bin/bash
# Build script for rekordbox-reader
# Creates a standalone macOS binary using PyInstaller

set -e

cd "$(dirname "$0")"

echo "Installing dependencies..."
pip install -r requirements.txt pyinstaller

echo "Building binary with PyInstaller..."
pyinstaller \
    --onefile \
    --name rekordbox-reader \
    --clean \
    --noconfirm \
    reader.py

echo "Build complete!"
echo "Binary located at: dist/rekordbox-reader"
echo ""
echo "To test, run: ./dist/rekordbox-reader"
