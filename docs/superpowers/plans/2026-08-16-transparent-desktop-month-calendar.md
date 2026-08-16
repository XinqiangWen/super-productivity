# Transparent Desktop Month Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Electron month-calendar companion a transparent,
interactive desktop overlay.

**Architecture:** The current hardened calendar widget continues to load the
existing Angular Schedule route with `calendarWidget=1`. Electron owns native
window transparency; Angular owns the widget-only shell styling and continues
to use the existing task composer and schedule store.

**Tech Stack:** Electron BrowserWindow, Angular standalone Schedule component,
SCSS, Jasmine/Karma.

## Global Constraints

- Keep `contextIsolation: true`, `nodeIntegration: false`, and the existing
  app-origin navigation guard.
- Keep the widget interactive; do not enable click-through window behaviour.
- Do not push or open an upstream pull request.

---

### Task 1: Test widget-specific Schedule rendering

**Files:**

- Modify: `src/app/features/schedule/schedule/schedule.component.spec.ts`
- Modify: `src/app/features/schedule/schedule/schedule.component.html`

**Interfaces:**

- Consumes: `isCalendarWidget: boolean` from the URL query.
- Produces: `.schedule-nav-controls--desktop-widget` hook on the widget header.

- [ ] **Step 1: Write the failing test**

```ts
it('marks the calendar header as a desktop widget for widget-only styling', () => {
  component.isCalendarWidget = true;
  fixture.detectChanges();
  expect(
    fixture.nativeElement.querySelector('.schedule-nav-controls--desktop-widget'),
  ).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include=src/app/features/schedule/schedule/schedule.component.spec.ts`

- [ ] **Step 3: Write minimal implementation**

```html
<div
  class="schedule-nav-controls"
  [class.schedule-nav-controls--desktop-widget]="isCalendarWidget"
></div>
```

- [ ] **Step 4: Run test to verify it passes**

Run the same focused Angular test command and expect success.

### Task 2: Add native transparent window configuration

**Files:**

- Modify: `electron/calendar-widget/calendar-widget.ts`

**Interfaces:**

- Consumes: existing `BrowserWindowConstructorOptions` and app-origin guard.
- Produces: a transparent `BrowserWindow` with an alpha background.

- [ ] **Step 1: Write the failing Electron assertion**

Add an Electron-window test or extract the BrowserWindow options into an
exported `getCalendarWidgetWindowOptions()` and assert `transparent === true`
and `backgroundColor === '#00000000'`.

- [ ] **Step 2: Run the Electron target test and verify it fails**

Run the applicable existing Electron test command for the calendar widget.

- [ ] **Step 3: Implement the minimal native option change**

```ts
transparent: true,
backgroundColor: '#00000000',
```

- [ ] **Step 4: Run Electron TypeScript verification**

Run: `npx tsc -p electron/tsconfig.electron.json --noEmit`

### Task 3: Apply transparent widget layout and visual verification

**Files:**

- Modify: `src/app/app.component.scss`
- Modify: `src/app/features/schedule/schedule/schedule.component.scss`

**Interfaces:**

- Consumes: `.is-calendar-widget` shell class and
  `.schedule-nav-controls--desktop-widget` header class.
- Produces: transparent shell, translucent calendar surface, and no-drag
  controls inside the Electron drag header.

- [ ] **Step 1: Add the minimal widget-only SCSS rules**

```scss
.app-container.is-calendar-widget {
  background: transparent;
}
:host-context(.is-calendar-widget) {
  background: transparent;
}
```

- [ ] **Step 2: Verify no opaque shell remains**

Run the packaged app, open the desktop widget, and inspect the visible window
with the local desktop accessibility/screenshot tool.

- [ ] **Step 3: Run full targeted verification**

Run the Schedule and month component tests, Angular production build, Electron
build, CSS-variable lint, and `git diff --check`.
