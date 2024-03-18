import { useCallback, useEffect, useState } from 'react';

export function useAvatar(src: string) {
  // This hook is used to load an image and determine if it has loaded
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(() => {
    // Create a new image object
    const img = new Image();

    // Set the hasLoaded state based on the image load
    img.onload = () => {
      setHasLoaded(true);
    };

    // Set the hasLoaded state to false if the image fails to load
    img.onerror = () => {
      setHasLoaded(false);
    };

    // Set the src of the image to the src passed to the hook
    img.src = src;

    // If the src is not defined, set hasLoaded to false
    if (!src) {
      setHasLoaded(false);
    }
  }, [src]);

  // Load the image when the component mounts
  useEffect(() => {
    load();
  }, [load]);

  // Reset the hasLoaded state when the src changes
  useEffect(() => {
    setHasLoaded(false);
  }, [src]);

  // Return the hasLoaded state and the load function
  return { hasLoaded, load };
}

export default useAvatar;
