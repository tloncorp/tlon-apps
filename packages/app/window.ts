interface ElectronAPI {
  setUrbitShip: (shipUrl: string) => Promise<boolean>;
  getVersion: () => Promise<string>;
  loginToShip: (shipUrl: string, accessCode: string) => Promise<string>;
  storeAuthInfo: (authInfo: any) => Promise<boolean>;
  getAuthInfo: () => Promise<any>;
  clearAuthInfo: () => Promise<boolean>;

  // Notification functions
  showNotification: (options: {
    title: string;
    body: string;
    data?: any;
  }) => Promise<boolean>;
  onNotificationClicked: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    our: string;
    electronAPI?: ElectronAPI;
  }
}

export {};
