declare global {
  interface Window {
    electronAPI?: {
      setUrbitShip: (shipUrl: string) => Promise<boolean>;
      getVersion: () => Promise<string>;
      loginToShip: (shipUrl: string, accessCode: string) => Promise<string>;
      storeAuthInfo: (authInfo: any) => Promise<boolean>;
      getAuthInfo: () => Promise<any>;
      clearAuthInfo: () => Promise<boolean>;

      // Notification functions
      showNotification: (options: { title: string; body: string; data?: any }) => Promise<boolean>;
      onNotificationClicked: (callback: (data: any) => void) => () => void;
    };
    sqliteBridge?: {
      init: () => Promise<boolean>;
      execute: (
        sql: string,
        params: any[],
        method: 'all' | 'run' | 'values' | 'get'
      ) => Promise<any>;
      runMigrations: (migrations: any[]) => Promise<boolean>;
      purgeDb: () => Promise<boolean>;
      getDbPath: () => Promise<string>;
      onDbChange: (callback: (data: any) => void) => () => void;
    };
  }
}

export const isElectron = () => {
  return window.electronAPI !== undefined || window.sqliteBridge !== undefined;
};

export const setUrbitShip = async (shipUrl: string): Promise<boolean> => {
  if (isElectron()) {
    return window.electronAPI?.setUrbitShip(shipUrl) ?? false;
  }
  return false;
};

export const getElectronVersion = async (): Promise<string> => {
  if (isElectron()) {
    return window.electronAPI?.getVersion() ?? '';
  }
  return '';
};

export const loginToShip = async (
  shipUrl: string,
  accessCode: string
): Promise<string> => {
  if (isElectron()) {
    return window.electronAPI?.loginToShip(shipUrl, accessCode) ?? '';
  }
  throw new Error('loginToShip can only be called in Electron environment');
};
