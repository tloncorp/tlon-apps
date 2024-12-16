const MUSIC_ENDPOINT = 'https://api.ninaprotocol.com/v1';

interface MusicSearchResult {
  releases: MusicReleasePreview[];
}

interface MusicReleasePreview {
  title: string;
  publicKey: string;
  image: string;
}

interface ReleaseFile {
  uri: string;
  track: number;
  track_title: string;
  duration: number;
  type: string;
}

interface ReleaseMetadata {
  name: string;
  description: string;
  image: string;
  properties?: {
    files?: ReleaseFile[];
    date: string;
    tags?: string[];
  };
}

interface Release {
  publicKey: string;
  hub?: {
    data?: {
      displayName: string;
      image?: string;
    };
  };
  metadata: ReleaseMetadata;
  datetime: string;
  publisherAccount: {
    displayName: string;
    handle: string;
    publicKey: string;
  };
  price: string;
  archived: boolean;
}

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

// Helper for consistent ID generation
const createTrackId = (releaseKey: string, trackNumber: number): string =>
  `release:${releaseKey}:track:${trackNumber}`;

function normalizeReleasePreview(release: MusicReleasePreview): Release {
  return {
    publicKey: release.publicKey,
    metadata: {
      name: release.title,
      image: release.image,
      description: '',
    },
    datetime: Date.now().toString(),
    publisherAccount: {
      displayName: '',
      handle: '',
      publicKey: '',
    },
    price: '0',
    archived: false,
  };
}

function normalizeRelease(release: Release): NormalizedTrack[] {
  console.log('normalizeRelease', release);
  const tracks: NormalizedTrack[] = [];
  console.log(`release meta`, release.metadata);

  const artist =
    release.hub?.data?.displayName ?? release.metadata.name.split('-')[0];
  const albumTitle = release.metadata.name.split('-')[1];

  const files = release.metadata.properties?.files ?? [];
  const totalTracks = files.length;
  files.forEach((file) => {
    tracks.push({
      id: createTrackId(release.publicKey, file.track),
      releaseId: release.publicKey,
      title: file.track_title,
      artist,
      albumTitle,
      trackNumber: file.track,
      totalTracks,
      duration: file.duration,
      audioUrl: file.uri,
      coverArt: release.metadata.image,
      releaseDate: release.metadata.properties?.date ?? Date.now().toString(),
      isAlbumTrack: totalTracks > 1,
    });
  });

  return tracks;
}

const utils = {
  parseTrackId: (id: string) => {
    const [_, releaseKey, __, trackNumber] = id.split(':');
    return {
      releaseKey,
      trackNumber: parseInt(trackNumber),
    };
  },

  isTrackFromRelease: (trackId: string, releaseId: string): boolean => {
    const { releaseKey } = utils.parseTrackId(trackId);
    return releaseKey === releaseId;
  },
};

export async function searchMusic(query: string) {
  console.log(`searchMusic`, query);
  try {
    const results: MusicSearchResult = await musicPost('/search', { query });
    return results.releases ?? [];
  } catch (e) {
    console.log(`Failed to search for music`, e);
    return [];
  }
  // const results: MusicSearchResult = await musicPost('/search', { query });

  // if (results.releases.length > 0) {
  //   console.log(`got results`, results.releases);
  //   const firstResults = results.releases.slice(0, 5);
  //   const releaseRequests = firstResults.map((release) =>
  //     getRelease(release.publicKey)
  //   );
  //   const releases = await Promise.all(releaseRequests);
  //   // console.log(`got releases`, releases);
  //   const allTracks = releases.map((r) => r.release).flatMap(normalizeRelease);
  //   console.log(`got tracks`, allTracks.length);
  //   return allTracks;
  // }

  return [];
}

export async function getReleaseTracks(releaseId: string) {
  console.log(`getReleaseTracks`, releaseId);
  try {
    const results = await musicFetch(`/releases/${releaseId}`, {});
    console.log(`${releaseId} release data`, results.release);
    return normalizeRelease(results.release);
  } catch (e) {
    console.log(`Failed to get release tracks`, e);
    return [];
  }
}

export async function getRelease(releaseId: string) {
  console.log(`getRelease`, releaseId);
  const results = await musicFetch(`/releases/${releaseId}`, {});
  console.log(`got release result`, results);
  return results;
}

// Welcome to my client lol
async function musicPost(path: string, body: any) {
  const response = await fetch(`${MUSIC_ENDPOINT}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function musicFetch(path: string, query: any) {
  const response = await fetch(`${MUSIC_ENDPOINT}/${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}
