import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  ipcMain,
  screen,
} from 'electron';
import { join } from 'path';
import { assertSecureWebPreferences } from '../web-preferences-guard';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { isAppOriginUrl } from '../navigation-guard';

let calendarWidgetWin: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;
let isListenerRegistered = false;

export const setCalendarWidgetMainWindow = (mainWindow: BrowserWindow): void => {
  mainWindowRef = mainWindow;
};

const getCalendarWidgetUrl = (mainWindow: BrowserWindow): string => {
  const url = new URL(mainWindow.webContents.getURL());
  url.searchParams.set('calendarWidget', '1');
  url.hash = '/schedule';
  return url.href;
};

export const openCalendarWidget = (): void => {
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    calendarWidgetWin.show();
    calendarWidgetWin.focus();
    return;
  }

  const mainWindow = mainWindowRef;
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(960, Math.max(640, workArea.width - 48));
  const height = Math.min(680, Math.max(480, workArea.height - 96));
  const webPreferences: BrowserWindowConstructorOptions['webPreferences'] = {
    preload: join(__dirname, '..', 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    backgroundThrottling: false,
  };
  assertSecureWebPreferences(webPreferences, 'calendar-widget');

  calendarWidgetWin = new BrowserWindow({
    width,
    height,
    x: workArea.x + Math.max(24, workArea.width - width - 24),
    y: workArea.y + 24,
    title: 'Super Productivity 月历',
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 640,
    minHeight: 480,
    maxWidth: 1600,
    maxHeight: 1100,
    autoHideMenuBar: true,
    webPreferences,
  });
  const widgetUrl = getCalendarWidgetUrl(mainWindow);
  const guardNavigation = (event: { preventDefault: () => void }, url: string): void => {
    if (isAppOriginUrl(url, widgetUrl)) {
      return;
    }
    event.preventDefault();
  };
  calendarWidgetWin.webContents.on('will-navigate', guardNavigation);
  calendarWidgetWin.webContents.on('will-redirect', guardNavigation);
  calendarWidgetWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  calendarWidgetWin.webContents.on('did-create-window', (childWindow) => {
    childWindow.destroy();
  });
  calendarWidgetWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  calendarWidgetWin.loadURL(widgetUrl);
  calendarWidgetWin.on('closed', () => {
    calendarWidgetWin = null;
  });
};

export const initCalendarWidgetListener = (): void => {
  if (isListenerRegistered) {
    return;
  }
  isListenerRegistered = true;
  ipcMain.on(IPC.OPEN_CALENDAR_WIDGET, openCalendarWidget);
  ipcMain.on(IPC.CLOSE_CALENDAR_WIDGET, destroyCalendarWidget);
};

export const destroyCalendarWidget = (): void => {
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    calendarWidgetWin.destroy();
  }
  calendarWidgetWin = null;
};
