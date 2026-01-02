import { Command } from "@tauri-apps/plugin-shell";
import type { RekordboxLibrary, Track, PlaylistNode } from "./rekordbox-parser";

interface DatabaseTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  location: string;
  duration: number | null;
}

interface DatabasePlaylistNode {
  name: string;
  type: "folder" | "playlist";
  children?: DatabasePlaylistNode[];
  trackIds?: string[];
  isSmartPlaylist?: boolean;
}

interface DatabaseOutput {
  source: "database" | "xml";
  tracks: DatabaseTrack[];
  playlists: DatabasePlaylistNode;
}

/**
 * Convert a database playlist node to the app's PlaylistNode format
 */
function convertPlaylistNode(node: DatabasePlaylistNode): PlaylistNode {
  return {
    name: node.name,
    type: node.type,
    children: (node.children || []).map(convertPlaylistNode),
    trackIds: node.trackIds || [],
    isSmartPlaylist: node.isSmartPlaylist,
  };
}

/**
 * Read the Rekordbox library directly from the database using the bundled Python tool.
 * This eliminates the need for manual XML exports.
 *
 * SIDECAR CONFIGURATION (see CLAUDE.md for full details):
 * The sidecar path must match EXACTLY across 4 locations:
 * 1. Physical file: src-tauri/binaries/rekordbox-reader-{TARGET_TRIPLE}
 * 2. tauri.conf.json: bundle.externalBin: ["binaries/rekordbox-reader"]
 * 3. capabilities/default.json: shell:allow-execute and shell:allow-spawn with name: "binaries/rekordbox-reader"
 * 4. This file: Command.sidecar("binaries/rekordbox-reader", [])
 */
export async function readRekordboxDatabase(): Promise<RekordboxLibrary> {
  console.log("[database-reader] Creating sidecar command...");

  let command;
  try {
    // CRITICAL: This path must exactly match the externalBin entry in tauri.conf.json
    // and the shell permissions in capabilities/default.json
    command = Command.sidecar("binaries/rekordbox-reader", []);
  } catch (err) {
    console.error("[database-reader] Failed to create sidecar command:", err);
    throw new Error(`Failed to create sidecar command: ${err}`);
  }

  // Collect stdout and stderr
  let stdout = "";
  let stderr = "";

  command.stdout.on("data", (data) => {
    stdout += data;
  });

  command.stderr.on("data", (data) => {
    stderr += data;
  });

  // Spawn the process
  console.log("[database-reader] Spawning sidecar process...");
  try {
    await command.spawn();
  } catch (err) {
    console.error("[database-reader] Failed to spawn sidecar:", err);
    throw new Error(`Failed to spawn sidecar: ${err}`);
  }

  // Wait for the process to exit
  console.log("[database-reader] Waiting for process to complete...");
  const status = await new Promise<{ code: number }>((resolve) => {
    command.on("close", (data) => {
      console.log("[database-reader] Process closed with code:", data.code);
      resolve({ code: data.code ?? 1 });
    });
  });

  if (status.code !== 0) {
    const errorMessage = stderr.trim() || "Unknown error reading Rekordbox database";
    throw new Error(errorMessage);
  }

  // Parse the JSON output
  let output: DatabaseOutput;
  try {
    output = JSON.parse(stdout);
  } catch {
    throw new Error("Failed to parse database reader output as JSON");
  }

  // Convert tracks to the app's format
  const tracks = new Map<string, Track>();
  for (const dbTrack of output.tracks) {
    const track: Track = {
      id: dbTrack.id,
      name: dbTrack.title,
      artist: dbTrack.artist,
      album: dbTrack.album,
      location: dbTrack.location,
      duration: dbTrack.duration ?? 0,
    };
    tracks.set(track.id, track);
  }

  // Convert playlists to the app's format
  const playlists = convertPlaylistNode(output.playlists);

  return { tracks, playlists };
}
