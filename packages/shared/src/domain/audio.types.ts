export interface NormalizedTrack {
  id: string; // Format: "release:{releaseKey}:track:{trackNumber}"
  releaseId: string; // Original release public key
  title: string; // Track title
  artist: string; // Artist name from release
  albumTitle: string; // Full release/album title
  trackNumber: number; // Position in album/release
  totalTracks: number; // Total tracks in release
  duration: number; // Duration in seconds
  audioUrl: string; // Direct audio file URL
  coverArt: string; // Album/release cover art
  releaseDate: string; // Original release date
  isAlbumTrack: boolean; // Whether this is part of a multi-track release
}

export interface AudioPlayer {
  playTrack: (track: NormalizedTrack) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  isPlaying: boolean;
  currentTrack: NormalizedTrack | null;
}
