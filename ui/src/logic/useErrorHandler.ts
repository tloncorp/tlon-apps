import { useErrorHandler as useBoundaryHandler } from 'react-error-boundary';

export default function useErrorHandler() {
  const handle = useBoundaryHandler();

  function handleError(cb: (...args: any[]) => any) {
    return (...args: any[]) => {
      try {
        cb(...args);
      } catch (error) {
        handle(error);
      }
    };
  }

  return handleError;
}
