import { XMLParser } from "fast-xml-parser";
import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  location: string; // Decoded file path
  duration: number; // In seconds
  bpm?: number;
  key?: string;
  genre?: string;
}

export interface PlaylistNode {
  name: string;
  type: "folder" | "playlist";
  children: PlaylistNode[];
  trackIds: string[]; // Only for playlists
  isSmartPlaylist?: boolean; // Smart playlists can't be evaluated from DB
}

export interface RekordboxLibrary {
  tracks: Map<string, Track>;
  playlists: PlaylistNode;
}

/**
 * Decode a Rekordbox file:// URL to a local path
 * e.g., "file://localhost/Users/russ/Music/track.mp3" -> "/Users/russ/Music/track.mp3"
 */
function decodeLocation(location: string): string {
  // Remove file://localhost prefix
  let path = location.replace(/^file:\/\/localhost/, "");
  // URL decode the path
  path = decodeURIComponent(path);
  return path;
}

/**
 * Parse a TRACK node from the XML
 */
function parseTrack(trackNode: Record<string, unknown>): Track {
  const attrs = trackNode as Record<string, string | number>;
  return {
    id: String(attrs["@_TrackID"] ?? ""),
    name: String(attrs["@_Name"] ?? "Unknown"),
    artist: String(attrs["@_Artist"] ?? "Unknown Artist"),
    album: String(attrs["@_Album"] ?? ""),
    location: decodeLocation(String(attrs["@_Location"] ?? "")),
    duration: Number(attrs["@_TotalTime"] ?? 0),
    bpm: attrs["@_AverageBpm"] ? Number(attrs["@_AverageBpm"]) : undefined,
    key: attrs["@_Tonality"] ? String(attrs["@_Tonality"]) : undefined,
    genre: attrs["@_Genre"] ? String(attrs["@_Genre"]) : undefined,
  };
}

/**
 * Parse a NODE element from the playlists section recursively
 */
function parsePlaylistNode(
  node: Record<string, unknown>,
  trackIdMap: Map<string, string>
): PlaylistNode {
  const attrs = node as Record<string, string | number | unknown[]>;
  const name = String(attrs["@_Name"] ?? "");
  const type = attrs["@_Type"] === "0" ? "folder" : "playlist";

  const children: PlaylistNode[] = [];
  const trackIds: string[] = [];

  if (type === "folder") {
    // Parse child nodes
    const childNodes = attrs["NODE"];
    if (childNodes) {
      const nodeArray = Array.isArray(childNodes) ? childNodes : [childNodes];
      for (const child of nodeArray) {
        children.push(
          parsePlaylistNode(child as Record<string, unknown>, trackIdMap)
        );
      }
    }
  } else {
    // Parse track references
    const trackRefs = attrs["TRACK"];
    if (trackRefs) {
      const refArray = Array.isArray(trackRefs) ? trackRefs : [trackRefs];
      for (const ref of refArray) {
        const key = String((ref as Record<string, unknown>)["@_Key"] ?? "");
        if (key) {
          trackIds.push(key);
        }
      }
    }
  }

  return { name, type, children, trackIds };
}

/**
 * Get the default Rekordbox XML path
 */
export async function getDefaultXmlPath(): Promise<string> {
  const home = await homeDir();
  return `${home}Library/Pioneer/rekordbox/rekordbox.xml`;
}

/**
 * Check if a file exists at the given path
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/**
 * Parse a Rekordbox XML file and return the library
 */
export async function parseRekordboxXml(
  xmlPath: string
): Promise<RekordboxLibrary> {
  const xmlContent = await readTextFile(xmlPath);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => {
      // Ensure TRACK and NODE are always arrays for consistency
      return name === "TRACK" || name === "NODE";
    },
  });

  const parsed = parser.parse(xmlContent);
  const djPlaylists = parsed["DJ_PLAYLISTS"];

  if (!djPlaylists) {
    throw new Error("Invalid Rekordbox XML: missing DJ_PLAYLISTS root");
  }

  // Parse collection
  const tracks = new Map<string, Track>();
  const collection = djPlaylists["COLLECTION"];
  if (collection) {
    const trackNodes = collection["TRACK"];
    if (trackNodes) {
      const trackArray = Array.isArray(trackNodes) ? trackNodes : [trackNodes];
      for (const trackNode of trackArray) {
        const track = parseTrack(trackNode);
        tracks.set(track.id, track);
      }
    }
  }

  // Create a map from TrackID to TrackID (identity for now, but could map Key -> TrackID)
  const trackIdMap = new Map<string, string>();
  for (const id of tracks.keys()) {
    trackIdMap.set(id, id);
  }

  // Parse playlists
  const playlistsSection = djPlaylists["PLAYLISTS"];
  let playlists: PlaylistNode = {
    name: "ROOT",
    type: "folder",
    children: [],
    trackIds: [],
  };

  if (playlistsSection) {
    const rootNode = playlistsSection["NODE"];
    if (rootNode) {
      const rootArray = Array.isArray(rootNode) ? rootNode : [rootNode];
      // Usually there's a single ROOT node
      if (rootArray.length > 0) {
        playlists = parsePlaylistNode(rootArray[0], trackIdMap);
      }
    }
  }

  return { tracks, playlists };
}

/**
 * Get all track IDs from a playlist and its children recursively
 */
export function getAllTrackIdsFromPlaylist(node: PlaylistNode): string[] {
  if (node.type === "playlist") {
    return node.trackIds;
  }

  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(...getAllTrackIdsFromPlaylist(child));
  }
  return [...new Set(ids)]; // Dedupe
}
