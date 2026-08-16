const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const originalModuleLoad = Module._load;
const modulePath = path.resolve(__dirname, 'calendar-widget/calendar-widget.ts');

let createdWindows = [];
let savedStore = {};

class FakeWebContents {
  constructor(url = 'file:///app/index.html#/schedule') {
    this._handlers = new Map();
    this._url = url;
  }

  getURL() {
    return this._url;
  }

  on(name, handler) {
    this._handlers.set(name, handler);
  }

  once(name, handler) {
    this._handlers.set(name, handler);
  }

  emit(name) {
    if (name === 'did-finish-load' && !this._url) {
      this._url = 'file:///app/index.html#/schedule';
    }
    this._handlers.get(name)?.();
  }

  setWindowOpenHandler() {}
  send() {}
}

class FakeBrowserWindow {
  constructor(options) {
    this.options = options;
    this._handlers = new Map();
    this.webContents = new FakeWebContents();
    this.resizable = options.resizable;
    this.movable = true;
    createdWindows.push(this);
  }

  isDestroyed() {
    return false;
  }

  show() {}
  showInactive() {}
  focus() {}
  loadURL() {}
  setVisibleOnAllWorkspaces() {
    throw new Error('Desktop calendar must not be forced onto every workspace');
  }
  setResizable(value) {
    this.resizable = value;
  }
  setMovable(value) {
    this.movable = value;
  }
  getBounds() {
    return { x: 100, y: 120, width: 800, height: 600 };
  }
  on(name, handler) {
    this._handlers.set(name, handler);
  }
  destroy() {}
}

const installMocks = () => {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        BrowserWindow: FakeBrowserWindow,
        ipcMain: { on: () => {} },
        screen: {
          getCursorScreenPoint: () => ({ x: 10, y: 10 }),
          getDisplayNearestPoint: () => ({
            workArea: { x: 0, y: 0, width: 1920, height: 1080 },
          }),
          getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
        },
      };
    }
    if (request.endsWith('web-preferences-guard')) {
      return { assertSecureWebPreferences: () => {} };
    }
    if (request.endsWith('navigation-guard')) {
      return { isAppOriginUrl: () => true };
    }
    if (request.endsWith('common.const')) {
      return { IS_MAC: false };
    }
    if (request.endsWith('simple-store')) {
      return {
        loadSimpleStoreAll: async () => savedStore,
        saveSimpleStore: async (key, value) => {
          savedStore[key] = value;
        },
      };
    }
    return originalModuleLoad.call(this, request, parent, isMain);
  };
};

const loadModule = () => {
  delete require.cache[modulePath];
  return require(modulePath);
};

test.beforeEach(() => {
  createdWindows = [];
  savedStore = {};
  installMocks();
});

test.afterEach(() => {
  Module._load = originalModuleLoad;
});

test('calendar widget is a normal desktop window and restores persisted bounds', async () => {
  savedStore.calendarWidget = {
    bounds: { x: 100, y: 120, width: 800, height: 600 },
    isLocked: false,
  };
  const mod = loadModule();
  mod.setCalendarWidgetMainWindow({ isDestroyed: () => false, webContents: new FakeWebContents() });

  await mod.openCalendarWidget();

  assert.equal(createdWindows.length, 1);
  assert.equal(createdWindows[0].options.alwaysOnTop, false);
  assert.equal(createdWindows[0].options.x, 100);
  assert.equal(createdWindows[0].options.y, 120);
  assert.equal(createdWindows[0].options.width, 800);
  assert.equal(createdWindows[0].options.height, 600);
});

test('locking the calendar window disables moving and resizing', async () => {
  const mod = loadModule();
  mod.setCalendarWidgetMainWindow({ isDestroyed: () => false, webContents: new FakeWebContents() });
  await mod.openCalendarWidget();

  mod.setCalendarWidgetLocked(true);

  assert.equal(createdWindows[0].movable, false);
  assert.equal(createdWindows[0].resizable, false);
});

test('Windows login registration opens the desktop calendar after the main window loads', async () => {
  const loginSettings = [];
  const mainWebContents = new FakeWebContents('');
  const mod = loadModule();
  mod.setCalendarWidgetMainWindow({ isDestroyed: () => false, webContents: mainWebContents });

  mod.configureCalendarWidgetStartup({
    setLoginItemSettings: (settings) => loginSettings.push(settings),
  });
  mod.openCalendarWidgetWhenMainWindowReady({ webContents: mainWebContents });
  mainWebContents.emit('did-finish-load');
  await new Promise((resolve) => setImmediate(resolve));

  // Login-item registration is deliberately Windows-only (configureCalendarWidgetStartup
  // guards on process.platform); on other platforms the startup hook must not touch
  // login items, while the widget still opens.
  if (process.platform === 'win32') {
    assert.deepEqual(loginSettings, [{ openAtLogin: true }]);
  } else {
    assert.deepEqual(loginSettings, []);
  }
  assert.equal(createdWindows.length, 1);
});

test('opens the desktop calendar immediately when the main window already has a URL', async () => {
  const mainWebContents = new FakeWebContents();
  const mod = loadModule();
  mod.setCalendarWidgetMainWindow({ isDestroyed: () => false, webContents: mainWebContents });

  mod.openCalendarWidgetWhenMainWindowReady({ webContents: mainWebContents });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(createdWindows.length, 1);
});
