import {
  App,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  ipcMain,
  screen,
} from 'electron';
import { join } from 'path';
import { assertSecureWebPreferences } from '../web-preferences-guard';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { isAppOriginUrl } from '../navigation-guard';
import { IS_MAC } from '../common.const';
import { loadSimpleStoreAll, saveSimpleStore } from '../simple-store';

let calendarWidgetWin: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;
let isListenerRegistered = false;
let isCalendarWidgetLocked = false;
let boundsPersistTimer: NodeJS.Timeout | null = null;

const CALENDAR_WIDGET_SETTINGS_KEY = 'calendarWidget';
type CalendarWidgetBounds = Readonly<{ x: number; y: number; width: number; height: number }>;
type CalendarWidgetSettings = Readonly<{
  bounds: CalendarWidgetBounds;
  isLocked: boolean;
}>;

export const setCalendarWidgetMainWindow = (mainWindow: BrowserWindow): void => {
  mainWindowRef = mainWindow;
};

export const configureCalendarWidgetStartup = (
  electronApp: Pick<App, 'setLoginItemSettings'>,
): void => {
  if (process.platform === 'win32') {
    electronApp.setLoginItemSettings({ openAtLogin: true });
  }
};

export const openCalendarWidgetWhenMainWindowReady = (
  mainWindow: Pick<BrowserWindow, 'webContents'>,
): void => {
  mainWindow.webContents.once('did-finish-load', () => {
    void openCalendarWidget();
  });
};

const getCalendarWidgetUrl = (mainWindow: BrowserWindow, isLocked: boolean): string => {
  const url = new URL(mainWindow.webContents.getURL());
  url.searchParams.set('calendarWidget', '1');
  url.searchParams.set('calendarWidgetLocked', isLocked ? '1' : '0');
  url.hash = '/schedule';
  return url.href;
};

const getDefaultBounds = (): CalendarWidgetBounds => {
  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(960, Math.max(640, workArea.width - 48));
  const height = Math.min(680, Math.max(480, workArea.height - 96));
  return {
    width,
    height,
    x: workArea.x + Math.max(24, workArea.width - width - 24),
    y: workArea.y + 24,
  };
};

const isVisibleBounds = (bounds: CalendarWidgetBounds): boolean => {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return false;
  }
  const display = screen.getDisplayMatching(bounds);
  return (
    bounds.x + bounds.width > display.bounds.x &&
    bounds.x < display.bounds.x + display.bounds.width &&
    bounds.y + bounds.height > display.bounds.y &&
    bounds.y < display.bounds.y + display.bounds.height
  );
};

const loadCalendarWidgetSettings = async (): Promise<CalendarWidgetSettings> => {
  const defaultBounds = getDefaultBounds();
  try {
    const stored = (await loadSimpleStoreAll())[CALENDAR_WIDGET_SETTINGS_KEY] as
      | Partial<CalendarWidgetSettings>
      | undefined;
    const bounds = stored?.bounds;
    const hasBounds =
      !!bounds &&
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      typeof bounds.width === 'number' &&
      typeof bounds.height === 'number' &&
      isVisibleBounds(bounds as CalendarWidgetBounds);
    return {
      bounds: hasBounds ? (bounds as CalendarWidgetBounds) : defaultBounds,
      isLocked: stored?.isLocked === true,
    };
  } catch {
    return { bounds: defaultBounds, isLocked: false };
  }
};

const persistCalendarWidgetSettings = (): void => {
  if (boundsPersistTimer) {
    clearTimeout(boundsPersistTimer);
  }
  boundsPersistTimer = setTimeout(() => {
    if (!calendarWidgetWin || calendarWidgetWin.isDestroyed()) {
      return;
    }
    void saveSimpleStore(CALENDAR_WIDGET_SETTINGS_KEY, {
      bounds: calendarWidgetWin.getBounds(),
      isLocked: isCalendarWidgetLocked,
    } satisfies CalendarWidgetSettings);
  }, 250);
};

export const setCalendarWidgetLocked = (isLocked: boolean): void => {
  isCalendarWidgetLocked = isLocked;
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    calendarWidgetWin.setMovable(!isLocked);
    calendarWidgetWin.setResizable(!isLocked);
    calendarWidgetWin.webContents.send(IPC.CALENDAR_WIDGET_LOCK_CHANGED, isLocked);
  }
  persistCalendarWidgetSettings();
};

export const openCalendarWidget = async (): Promise<void> => {
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    calendarWidgetWin.show();
    calendarWidgetWin.focus();
    return;
  }

  const mainWindow = mainWindowRef;
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const settings = await loadCalendarWidgetSettings();
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    calendarWidgetWin.show();
    calendarWidgetWin.focus();
    return;
  }
  isCalendarWidgetLocked = settings.isLocked;
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
    ...settings.bounds,
    title: 'Super Productivity 月历',
    frame: false,
    // macOS does not reliably support native drag/edge-resize for transparent
    // frameless windows. Keep its companion window solid so the interactive
    // desktop calendar remains movable and resizable there.
    transparent: !IS_MAC,
    backgroundColor: IS_MAC ? '#f5f7fb' : '#00000000',
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: !settings.isLocked,
    minWidth: 640,
    minHeight: 480,
    maxWidth: 1600,
    maxHeight: 1100,
    hasShadow: IS_MAC,
    roundedCorners: IS_MAC,
    autoHideMenuBar: true,
    webPreferences,
  });
  calendarWidgetWin.setMovable(!settings.isLocked);
  const widgetUrl = getCalendarWidgetUrl(mainWindow, settings.isLocked);
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
  calendarWidgetWin.loadURL(widgetUrl);
  calendarWidgetWin.on('resize', persistCalendarWidgetSettings);
  calendarWidgetWin.on('move', persistCalendarWidgetSettings);
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
  ipcMain.on(IPC.SET_CALENDAR_WIDGET_LOCKED, (_event, isLocked: boolean) =>
    setCalendarWidgetLocked(isLocked),
  );
};

export const destroyCalendarWidget = (): void => {
  if (boundsPersistTimer) {
    clearTimeout(boundsPersistTimer);
    boundsPersistTimer = null;
  }
  if (calendarWidgetWin && !calendarWidgetWin.isDestroyed()) {
    calendarWidgetWin.destroy();
  }
  calendarWidgetWin = null;
};
