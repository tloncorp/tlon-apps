import { useCallback } from 'react';
import { NavigateOptions, To, useLocation, useNavigate } from 'react-router';

export interface ModalLocationState {
  backgroundLocation: Location;
}

/**
 * Returns an imperative method for navigating while preserving the navigation
 * state underneath the overlay
 */
export function useModalNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (to: To, opts?: NavigateOptions) => {
      if (location.state) {
        navigate(to, { ...(opts || {}), state: location.state });
        return;
      }
      navigate(to, opts);
    },
    [navigate, location.state]
  );
}

export function useDismissNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ModalLocationState | null;

  return useCallback(() => {
    console.log('BL: DISMISS CALLED', state?.backgroundLocation.pathname);
    if (state?.backgroundLocation) {
      // we want to replace the current location with the background location
      // so that the user won't navigate back to the modal if they hit the back button
      console.log('BL: FOUND', state.backgroundLocation.pathname);
      navigate(state.backgroundLocation, { replace: true });
    }
  }, [navigate, state]);
}
