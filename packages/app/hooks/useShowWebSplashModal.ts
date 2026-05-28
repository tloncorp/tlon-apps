import * as api from '@tloncorp/api';
import { getConstants } from '@tloncorp/api/types/constants';
import * as store from '@tloncorp/shared/store';

// Matches the web app's mobile routing breakpoint.
const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

export const useShowWebSplashModal = () => {
  const { data: wayfinding, isLoading } = store.useWayfindingCompletion();
  const { data: personalGroup } = store.usePersonalGroup();

  try {
    const constants = getConstants();
    if (constants.DISABLE_SPLASH_MODAL) {
      return false;
    }
  } catch (e) {
    // Constants unavailable (e.g. test environment); fall through.
  }

  try {
    if (!api.getCurrentUserIsHosted()) {
      return false;
    }
  } catch (e) {
    // getCurrentUserIsHosted() can throw before client init; hide modal until ready.
    return false;
  }

  const isMobileDevice =
    typeof window !== 'undefined' &&
    window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  if (!isMobileDevice) {
    return false;
  }

  return Boolean(
    personalGroup && !isLoading && !(wayfinding?.completedSplash ?? true)
  );
};
