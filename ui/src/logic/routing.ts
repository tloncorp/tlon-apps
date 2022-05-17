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
    if (state?.backgroundLocation) {
      navigate(state.backgroundLocation);
    }
  }, [navigate, state]);
}
