import { useState } from "react";
import { PlaylistNode } from "../lib/rekordbox-parser";
import "./PlaylistBrowser.css";

interface PlaylistBrowserProps {
  root: PlaylistNode;
  selectedPlaylist: PlaylistNode | null;
  onSelectPlaylist: (playlist: PlaylistNode | null) => void;
  totalTracks: number;
  activeTracks: number;
}

interface PlaylistItemProps {
  node: PlaylistNode;
  depth: number;
  selectedPlaylist: PlaylistNode | null;
  onSelect: (playlist: PlaylistNode) => void;
}

function PlaylistItem({
  node,
  depth,
  selectedPlaylist,
  onSelect,
}: PlaylistItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const isSelected = selectedPlaylist === node;
  const hasChildren = node.children.length > 0;

  const handleClick = () => {
    if (node.type === "folder" && hasChildren) {
      setIsExpanded(!isExpanded);
    } else if (node.type === "playlist") {
      onSelect(node);
    }
  };

  return (
    <div className="playlist-item">
      <button
        className={`playlist-row ${isSelected ? "playlist-row--selected" : ""}`}
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
        onClick={handleClick}
      >
        {node.type === "folder" ? (
          <span className={`folder-icon ${isExpanded ? "folder-icon--open" : ""}`}>
            {hasChildren ? (isExpanded ? "▼" : "▶") : "○"}
          </span>
        ) : (
          <span className="playlist-icon">{node.isSmartPlaylist ? "⚡" : "♪"}</span>
        )}
        <span className={`playlist-name ${node.isSmartPlaylist ? "playlist-name--smart" : ""}`}>
          {node.name}
        </span>
        {node.type === "playlist" && (
          <span className="playlist-count">
            {node.isSmartPlaylist ? "—" : node.trackIds.length}
          </span>
        )}
      </button>

      {node.type === "folder" && isExpanded && hasChildren && (
        <div className="playlist-children">
          {node.children.map((child, index) => (
            <PlaylistItem
              key={`${child.name}-${index}`}
              node={child}
              depth={depth + 1}
              selectedPlaylist={selectedPlaylist}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlaylistBrowser({
  root,
  selectedPlaylist,
  onSelectPlaylist,
  totalTracks,
  activeTracks,
}: PlaylistBrowserProps) {
  return (
    <div className="playlist-browser">
      <div className="playlist-header">
        <h3>Playlists</h3>
        <span className="track-count">
          {activeTracks} / {totalTracks} tracks
        </span>
      </div>

      <div className="playlist-list">
        <button
          className={`playlist-row playlist-row--all ${
            selectedPlaylist === null ? "playlist-row--selected" : ""
          }`}
          onClick={() => onSelectPlaylist(null)}
        >
          <span className="playlist-icon">◉</span>
          <span className="playlist-name">All Tracks</span>
          <span className="playlist-count">{totalTracks}</span>
        </button>

        {root.children.map((child, index) => (
          <PlaylistItem
            key={`${child.name}-${index}`}
            node={child}
            depth={0}
            selectedPlaylist={selectedPlaylist}
            onSelect={onSelectPlaylist}
          />
        ))}
      </div>
    </div>
  );
}
