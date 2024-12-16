import _ from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as api from '../api';
import * as domain from '../domain';

interface Release {
  publicKey: string;
  // other release properties
}

export function useMusicSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadedTracks, setLoadedTracks] = useState<domain.NormalizedTrack[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set());

  // Function to load a single release's details
  const loadRelease = useCallback(async (release: Release) => {
    // console.log('loadRelease', release.publicKey);
    try {
      const trackDetails = await api.getReleaseTracks(release.publicKey);
      setLoadedTracks((prev) => [...prev, ...trackDetails]);
    } catch (err) {
      console.error(`Failed to load release ${release.publicKey}:`, err);
    }
  }, []);

  // Move the loadReleases implementation outside the callback
  const loadReleasesImpl = async (
    releasesToLoad: Release[],
    currentLoadedIndices: Set<number>,
    startIdx: number,
    count: number
  ) => {
    // console.log('loadReleases', startIdx, count);
    const endIdx = Math.min(startIdx + count, releasesToLoad.length);
    const newIndices = new Set(currentLoadedIndices);

    const loadPromises = releasesToLoad
      .slice(startIdx, endIdx)
      .map(async (release, idx) => {
        const actualIdx = startIdx + idx;
        if (!currentLoadedIndices.has(actualIdx)) {
          newIndices.add(actualIdx);
          return loadRelease(release);
        }
      });

    await Promise.all(loadPromises);
    setLoadedIndices(newIndices);
  };

  // Simplified loadReleases that doesn't depend on state
  const loadReleases = useCallback(
    (startIdx: number, count: number) =>
      loadReleasesImpl(releases, loadedIndices, startIdx, count),
    [releases, loadRelease] // Remove loadedIndices dependency
  );

  // Search function that doesn't depend on loadReleases
  const performSearch = async (searchQuery: string) => {
    console.log('performing search', searchQuery);
    setIsLoading(true);
    setError(null);
    try {
      const searchResults = await api.searchMusic(searchQuery);
      setReleases(searchResults);
      setLoadedTracks([]);
      setLoadedIndices(new Set());
      if (searchResults.length > 0) {
        await loadReleasesImpl(searchResults, new Set(), 0, 5);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useMemo(
    () => _.debounce(performSearch, 300, { trailing: true }),
    [] // No dependencies needed
  );

  useEffect(() => {
    // console.log('query effect running', query);
    if (query && query.length > 3) {
      debouncedSearch(query);
    } else {
      setReleases([]);
      setLoadedTracks([]);
      setLoadedIndices(new Set());
    }

    return () => debouncedSearch.cancel();
  }, [query]);

  const loadMore = useCallback(
    () => loadReleasesImpl(releases, loadedIndices, loadedIndices.size, 5),
    [releases, loadedIndices, loadRelease]
  );

  return {
    query,
    setQuery,
    tracks: loadedTracks,
    isLoading,
    error,
    hasMore: loadedIndices.size < releases.length,
    loadMore,
  };
}

// export function useMusicSearch(initialQuery: string = '') {
//   // const prevQuery = useRef(query);
//   const [query, setQuery] = useState(initialQuery);
//   const [releases, setReleases] = useState<Release[]>([]);
//   const [loadedTracks, setLoadedTracks] = useState<domain.NormalizedTrack[]>(
//     []
//   );
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<Error | null>(null);

//   // Keep track of which indices we've already loaded
//   const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set());

//   // Function to load a single release's details
//   const loadRelease = useCallback(async (release: Release) => {
//     console.log('loadRelease', release.publicKey);
//     try {
//       const trackDetails = await api.getReleaseTracks(release.publicKey);
//       setLoadedTracks((prev) => [...prev, ...trackDetails]);
//     } catch (err) {
//       console.error(`Failed to load release ${release.publicKey}:`, err);
//     }
//   }, []);

//   // Function to load multiple releases
//   const loadReleases = useCallback(
//     async (startIdx: number, count: number) => {
//       console.log('loadReleases', startIdx, count);
//       const endIdx = Math.min(startIdx + count, releases.length);
//       const newIndices = new Set(loadedIndices);

//       const loadPromises = releases
//         .slice(startIdx, endIdx)
//         .map(async (release, idx) => {
//           const actualIdx = startIdx + idx;
//           if (!loadedIndices.has(actualIdx)) {
//             newIndices.add(actualIdx);
//             return loadRelease(release);
//           }
//         });

//       await Promise.all(loadPromises);
//       setLoadedIndices(newIndices);
//     },
//     [releases, loadedIndices, loadRelease]
//   );

//   // Debounced search function
//   const debouncedSearch = useMemo(
//     () =>
//       _.debounce(async (searchQuery: string) => {
//         console.log('debouncedSearch', searchQuery);
//         setIsLoading(true);
//         setError(null);
//         try {
//           const searchResults = await api.searchMusic(searchQuery);
//           setReleases(searchResults);
//           setLoadedTracks([]);
//           setLoadedIndices(new Set());
//           if (searchResults.length > 0) {
//             await loadReleases(0, 5);
//           }
//         } catch (err) {
//           setError(err instanceof Error ? err : new Error('Search failed'));
//         } finally {
//           setIsLoading(false);
//         }
//       }, 300),
//     [loadReleases]
//   );

//   // Effect to trigger search when query changes
//   useEffect(() => {
//     console.log('query effect running');
//     if (query && query.length > 3) {
//       debouncedSearch(query);
//     } else {
//       setReleases([]);
//       setLoadedTracks([]);
//       setLoadedIndices(new Set());
//     }

//     // Cleanup debounced search on unmount
//     return () => debouncedSearch.cancel();
//   }, [query, debouncedSearch]);

//   const loadMore = useCallback(async () => {
//     console.log(`loading more`);
//     const nextStartIdx = loadedIndices.size;
//     await loadReleases(nextStartIdx, 5);
//   }, [loadedIndices.size, loadReleases]);

//   return {
//     query,
//     setQuery,
//     tracks: loadedTracks,
//     isLoading,
//     error,
//     hasMore: loadedIndices.size < releases.length,
//     loadMore,
//   };
// }
