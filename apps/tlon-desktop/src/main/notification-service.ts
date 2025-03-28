import { BrowserWindow, Notification, ipcMain, app } from 'electron';

let unreadNotificationCount = 0;

function updateDockBadge() {
  if (unreadNotificationCount > 0) {
    app.setBadgeCount(unreadNotificationCount);
  } else {
    app.setBadgeCount(0);
  }
}

export function clearNotifications() {
  unreadNotificationCount = 0;
  updateDockBadge();
}

export function setupNotificationService(mainWindow: BrowserWindow) {
  ipcMain.handle('show-notification', (event, { title, body, data }) => {
    // Don't show notifications if window is focused and visible
    if (mainWindow.isFocused() && mainWindow.isVisible()) {
      return false;
    }
    
    const notification = new Notification({
      title,
      body,
      silent: false
    });
    
    notification.on('click', () => {
      // Focus window when notification is clicked
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // Send notification data back to renderer for navigation
      mainWindow.webContents.send('notification-clicked', data);
    });
    
    notification.show();
    
    unreadNotificationCount++;
    updateDockBadge();
    
    return true;
  });
  
  mainWindow.on('focus', () => {
    clearNotifications();
  });
}
