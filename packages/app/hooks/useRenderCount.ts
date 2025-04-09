import { useRef, useEffect } from 'react';

/**
 * Hook to track and log component render counts
 * 
 * @param componentName Name of the component to include in the log message
 * @param enabled Optional flag to enable/disable logging (defaults to true in development)
 * @returns The current render count (useful for testing or conditional logic)
 */
export function useRenderCount(
  componentName: string, 
  enabled = process.env.NODE_ENV === 'development'
): number {
  const renderCount = useRef(0);
  
  useEffect(() => {
    if (!enabled) return;
    
    renderCount.current += 1;
    console.log(`${componentName} rendered:`, renderCount.current);
  });
  
  return renderCount.current;
}
