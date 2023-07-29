import { useCallback, useMemo } from 'react';
import {
  NavigateOptions,
  To,
  useLocation,
  useNavigate,
  matchPath,
} from 'react-router';
import { ReactRouterState } from '@/types/quorum-ui';
import { CHANNEL_PATH } from '@/constants';

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
        navigate(to, {...(opts || {}), state: location.state});
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
  const state = location.state as ReactRouterState | null;

  return useCallback((payload?: string) => {
    if (state?.backgroundLocation) {
      const {backgroundLocation, ...oldState} = state;
      const newPayload = (payload !== undefined) ? {foregroundPayload: payload} : {};
      const newState: ReactRouterState = {...Object.assign({}, oldState, newPayload)};
      navigate(backgroundLocation, {
        replace: true,
        state: Object.keys(newState).length === 0 ? undefined : newState,
      });
    }
  }, [navigate, state]);
}

export function useAnchorLink() {
  const location = useLocation();

  return useMemo(() => {
    const BASE_CHANNEL_PATH = `${CHANNEL_PATH}/*`;
    const BASE_CHANNEL_DEPTH = (BASE_CHANNEL_PATH.match(/\//g) || []).length - 1;

    const currDepth = (location.pathname.replace(/\/+$/, "").match(/\//g) || []).length;
    const depthFromAnchor: number = matchPath(BASE_CHANNEL_PATH, location.pathname)
      ? currDepth - BASE_CHANNEL_DEPTH
      : currDepth;
    const toAnchor = Array(depthFromAnchor).fill("../").join("");

    return `./${toAnchor}`.replace(/\/\//, "");
  }, [location.pathname]);
}

/**
 * Returns an imperative method for navigating relative to the current
 * path anchor (i.e. either the base path for standalone mode, or the
 * board path for embedded mode).
 */
export function useAnchorNavigate() {
  const navigate = useNavigate();
  const anchorLink = useAnchorLink();

  return useCallback(
    (to?: string, opts?: NavigateOptions) => navigate(
      `${anchorLink}/${to || ""}`,
      {...(opts || {}), relative: "path"}
    ),
    [navigate, anchorLink]
  );
}
