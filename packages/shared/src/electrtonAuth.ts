// Authentication utility for Electron-specific functionality
import { createDevLogger } from './debug';

const logger = createDevLogger('electronAuth', false);

// Type definitions
export interface AuthInfo {
  ship: string;
  shipUrl: string;
  authCookie: string;
}

// Helper to check if we're in Electron
export const isElectronEnv = (): boolean => {
  if (typeof window !== 'undefined') {
    return 'electronAPI' in window;
  }
  return false;
};

/**
 * Store authentication information
 * @param authInfo Authentication details to store
 * @returns Promise resolving to success status
 */
export const storeAuthInfo = async (authInfo: AuthInfo): Promise<boolean> => {
  if (isElectronEnv()) {
    try {
      // Use type assertion to tell TypeScript to trust us
      const api = (window as any).electronAPI;
      return await api?.storeAuthInfo?.(authInfo) ?? false;
    } catch (error) {
      logger.error('Failed to store auth info:', error);
      return false;
    }
  }
  return false;
};

/**
 * Retrieve stored authentication information
 * @returns Promise resolving to auth info or null if not found
 */
export const getAuthInfo = async (): Promise<AuthInfo | null> => {
  if (isElectronEnv()) {
    try {
      const api = (window as any).electronAPI;
      return await api?.getAuthInfo?.() ?? null;
    } catch (error) {
      logger.error('Failed to get auth info:', error);
      return null;
    }
  }
  return null;
};

/**
 * Clear stored authentication information
 * @returns Promise resolving to success status
 */
export const clearAuthInfo = async (): Promise<boolean> => {
  if (isElectronEnv()) {
    try {
      const api = (window as any).electronAPI;
      return await api?.clearAuthInfo?.() ?? false;
    } catch (error) {
      logger.error('Failed to clear auth info:', error);
      return false;
    }
  }
  return false;
};
