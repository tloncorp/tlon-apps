declare global {
  interface Window {
    electronAPI?: {
      setUrbitShip: (shipUrl: string) => Promise<boolean>;
      getVersion: () => Promise<string>;
      loginToShip: (shipUrl: string, accessCode: string) => Promise<string>;
    };
  }
}

export const isElectron = () => {
  return window.electronAPI !== undefined;
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

export const loginToShip = async (shipUrl: string, accessCode: string): Promise<string> => {
  if (isElectron()) {
    return window.electronAPI?.loginToShip(shipUrl, accessCode) ?? '';
  }
  throw new Error('loginToShip can only be called in Electron environment');
};
