#!/usr/bin/env python3
"""
Rekordbox Database Reader

Reads the Rekordbox master.db database and outputs track/playlist data as JSON.

CRITICAL: This tool is READ-ONLY. It must NEVER modify the Rekordbox database.
"""

import json
import sys
from pathlib import Path
from urllib.parse import unquote


def main():
    try:
        # Import pyrekordbox (handles database location auto-detection)
        from pyrekordbox import Rekordbox6Database

        # Open database - pyrekordbox auto-detects location and decrypts
        # No path argument = auto-detect, unlock=True = decrypt the database
        try:
            db = Rekordbox6Database(unlock=True)
        except Exception as e:
            print(f"Rekordbox database not found or could not be opened: {e}", file=sys.stderr)
            sys.exit(1)

        # Extract tracks
        tracks = []
        for content in db.get_content():
            # Get the file path - decode from URL format if needed
            file_path = content.FolderPath
            if file_path:
                # pyrekordbox returns the full path, but may be URL-encoded
                if file_path.startswith("file://"):
                    # Remove file:// prefix and decode
                    file_path = file_path.replace("file://localhost", "")
                    file_path = file_path.replace("file://", "")
                file_path = unquote(file_path)

            # Get duration in seconds (stored as milliseconds in DB)
            duration = None
            if content.Length is not None:
                duration = content.Length / 1000.0

            track = {
                "id": str(content.ID),
                "title": content.Title or "",
                "artist": content.Artist.Name if content.Artist else "",
                "album": content.Album.Name if content.Album else "",
                "location": file_path or "",
                "duration": duration,
            }
            tracks.append(track)

        # Extract playlist hierarchy
        def build_playlist_tree(parent_id="root"):
            """Recursively build playlist tree from database."""
            children = []

            # Get all playlists/folders with this parent, sorted by Seq
            matching_playlists = [
                p for p in db.get_playlist()
                if p.ParentID == parent_id
            ]
            # Sort by Seq attribute for correct ordering
            matching_playlists.sort(key=lambda p: p.Seq if p.Seq is not None else 0)

            for playlist in matching_playlists:
                node = {
                    "name": playlist.Name or "Unnamed",
                }

                if playlist.is_folder:
                    node["type"] = "folder"
                    node["children"] = build_playlist_tree(playlist.ID)
                else:
                    node["type"] = "playlist"
                    # Smart playlists don't have static track lists
                    if playlist.is_smart_playlist:
                        # Can't evaluate smart playlist rules, so skip tracks
                        node["trackIds"] = []
                        node["isSmartPlaylist"] = True
                    else:
                        # Get track IDs for regular playlists
                        track_ids = []
                        for song in playlist.Songs:
                            if song.ContentID is not None:
                                track_ids.append(str(song.ContentID))
                        node["trackIds"] = track_ids

                children.append(node)

            return children

        # Build the root playlist structure
        playlists = {
            "name": "ROOT",
            "type": "folder",
            "children": build_playlist_tree(parent_id="root"),
        }

        # Close database connection
        db.close()

        # Output JSON
        output = {
            "source": "database",
            "tracks": tracks,
            "playlists": playlists,
        }

        print(json.dumps(output, ensure_ascii=False))
        sys.exit(0)

    except ImportError as e:
        print(f"Failed to import pyrekordbox: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading Rekordbox database: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
